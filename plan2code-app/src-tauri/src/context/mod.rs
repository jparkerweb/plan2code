//! How full the agent's context is. A reader says one of four things: a real
//! number (`Real`, documented by the agent and verified), a best-effort number
//! (`BestEffort`, works today but undocumented), a labeled estimate (`Estimate`)
//! or `Unknown`. Knows nothing about Tauri: the page asks for a reading and
//! draws what it gets.

pub mod claude;
pub mod codex;

use std::time::SystemTime;

use serde::Serialize;

use crate::agents::AgentKind;

/// A rough token window used only by the estimate, and by `claude.rs` when no
/// window comes with the signal it reads. The estimate is labeled as one
/// everywhere it is shown, so the exact size does not have to be right.
pub const ESTIMATE_TOKEN_WINDOW: u64 = 200_000;

/// The window for a model whose id names it a long-context one (Claude Code's
/// `[1m]` model id suffix).
pub const LONG_CONTEXT_TOKEN_WINDOW: u64 = 1_000_000;

/// The usual rule of thumb: about four characters of text per token.
pub const BYTES_PER_TOKEN: u64 = 4;

/// The context window to read `kind`'s usage against, or `None` when no
/// window is documented for it at all (Devin today), in which case a byte
/// count is not even a meaningful guess. `model` is the id the person picked,
/// if any; one naming a long-context model (Claude Code's `[1m]` suffix) gets
/// the bigger window.
pub fn window_for(kind: Option<AgentKind>, model: Option<&str>) -> Option<u64> {
    match kind {
        Some(AgentKind::Claude) | Some(AgentKind::Codex) => {
            let long_context = model.is_some_and(|m| m.to_ascii_lowercase().contains("[1m]"));
            Some(if long_context { LONG_CONTEXT_TOKEN_WINDOW } else { ESTIMATE_TOKEN_WINDOW })
        }
        Some(AgentKind::Devin) | None => None,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ContextReading {
    Real { percent: u8 },
    BestEffort { percent: u8 },
    Estimate { percent: u8 },
    Unknown,
}

/// One agent's way of reading its context. The estimate is the fallback every
/// agent has; a reader for an agent that documents its usage returns `Real`.
pub trait ContextReader {
    fn read(&self) -> ContextReading;
}

/// The percent of `window` that `bytes` of text fills, capped at 100 and
/// rounded up: any text at all reads as at least 1 percent, never a flat 0
/// while the agent is working.
pub fn estimate_percent(bytes: u64, window: u64) -> u8 {
    let tokens = bytes / BYTES_PER_TOKEN;
    if tokens == 0 || window == 0 {
        return 0;
    }
    tokens.saturating_mul(100).div_ceil(window).min(100) as u8
}

/// Where the output scan is inside a terminal control sequence.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
enum Escape {
    #[default]
    None,
    Esc,
    Intermediate,
    Csi,
    Osc,
    OscEnd,
}

/// Counts the text an agent run has produced and been given. A new agent
/// (a new `generation`) starts the count over, and nothing is counted while
/// no agent runs.
#[derive(Debug, Default)]
pub struct Meter {
    generation: u64,
    seen: bool,
    running: bool,
    bytes: u64,
    escape: Escape,
    kind: Option<AgentKind>,
    // When the current agent run began: its own log must be written after this.
    since: Option<SystemTime>,
}

impl Meter {
    /// Called on every agent state change: a new generation resets the count.
    pub fn observe(&mut self, generation: u64, running: bool) {
        if !self.seen || generation != self.generation {
            self.generation = generation;
            self.seen = true;
            self.bytes = 0;
            self.escape = Escape::None;
            self.since = Some(SystemTime::now());
        }
        self.running = running;
    }

    pub fn set_kind(&mut self, kind: Option<AgentKind>) {
        self.kind = kind;
    }

    pub fn kind(&self) -> Option<AgentKind> {
        self.kind
    }

    pub fn since(&self) -> Option<SystemTime> {
        self.since
    }

    /// Output from the agent, or text typed to it, while it runs.
    /// Output from the agent. Terminal control sequences (colours, cursor
    /// moves, window titles) are not text the agent holds, so only the visible
    /// bytes count. A sequence cut across two chunks is still skipped whole.
    pub fn add_output(&mut self, chunk: &[u8]) {
        let mut visible = 0usize;
        for &byte in chunk {
            self.escape = match self.escape {
                Escape::None => match byte {
                    0x1b => Escape::Esc,
                    b'\n' | b'\t' => {
                        visible += 1;
                        Escape::None
                    }
                    0x20..=0x7e | 0x80..=0xff => {
                        visible += 1;
                        Escape::None
                    }
                    _ => Escape::None,
                },
                Escape::Esc => match byte {
                    b'[' => Escape::Csi,
                    // OSC, and the other strings that end the same way: DCS, SOS, PM, APC.
                    b']' | b'P' | b'X' | b'^' | b'_' => Escape::Osc,
                    // `ESC ( B` and the like: intermediate bytes, then one final byte.
                    0x20..=0x2f => Escape::Intermediate,
                    _ => Escape::None,
                },
                Escape::Intermediate => match byte {
                    0x20..=0x2f => Escape::Intermediate,
                    _ => Escape::None,
                },
                Escape::Csi => match byte {
                    0x40..=0x7e => Escape::None,
                    _ => Escape::Csi,
                },
                Escape::Osc => match byte {
                    0x07 => Escape::None,
                    0x1b => Escape::OscEnd,
                    _ => Escape::Osc,
                },
                Escape::OscEnd => Escape::None,
            };
        }
        self.add(visible);
    }

    /// Text typed to the agent, or any count of visible bytes.
    pub fn add(&mut self, bytes: usize) {
        if self.running {
            self.bytes = self.bytes.saturating_add(bytes as u64);
        }
    }

    pub fn reading(&self) -> ContextReading {
        if !self.seen || !self.running {
            return ContextReading::Unknown;
        }
        match window_for(self.kind, None) {
            Some(window) => ContextReading::Estimate { percent: estimate_percent(self.bytes, window) },
            None => ContextReading::Unknown,
        }
    }
}

impl ContextReader for Meter {
    fn read(&self) -> ContextReading {
        self.reading()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_text_is_zero_percent() {
        assert_eq!(estimate_percent(0, ESTIMATE_TOKEN_WINDOW), 0);
    }

    #[test]
    fn half_the_window_is_fifty_percent() {
        assert_eq!(estimate_percent(ESTIMATE_TOKEN_WINDOW * BYTES_PER_TOKEN / 2, ESTIMATE_TOKEN_WINDOW), 50);
    }

    #[test]
    fn more_than_the_window_caps_at_one_hundred() {
        assert_eq!(estimate_percent(u64::MAX / 2, ESTIMATE_TOKEN_WINDOW), 100);
    }

    #[test]
    fn any_text_at_all_rounds_up_instead_of_reading_zero() {
        assert_eq!(estimate_percent(BYTES_PER_TOKEN, ESTIMATE_TOKEN_WINDOW), 1);
    }

    #[test]
    fn a_long_context_model_gets_the_bigger_window() {
        assert_eq!(window_for(Some(AgentKind::Claude), Some("claude-sonnet-4-5-20250929[1m]")), Some(LONG_CONTEXT_TOKEN_WINDOW));
        assert_eq!(window_for(Some(AgentKind::Claude), Some("sonnet")), Some(ESTIMATE_TOKEN_WINDOW));
        assert_eq!(window_for(Some(AgentKind::Claude), None), Some(ESTIMATE_TOKEN_WINDOW));
    }

    #[test]
    fn devin_and_an_unknown_agent_have_no_basis_for_a_window() {
        assert_eq!(window_for(Some(AgentKind::Devin), None), None);
        assert_eq!(window_for(None, None), None);
    }

    fn counted(chunks: &[&[u8]]) -> u64 {
        let mut meter = Meter::default();
        meter.observe(1, true);
        for chunk in chunks {
            meter.add_output(chunk);
        }
        meter.bytes
    }

    #[test]
    fn plain_text_counts_and_control_sequences_do_not() {
        assert_eq!(counted(&[b"hello\n"]), 6);
        assert_eq!(counted(&[b"\x1b[31mred\x1b[0m"]), 3);
        assert_eq!(counted(&[b"\x1b[2K\x1b[1A\x1b[Gx"]), 1);
        assert_eq!(counted(&[b"\x1b]0;a title\x07ok"]), 2);
        assert_eq!(counted(&[b"\x1b]0;a title\x1b\\ok"]), 2);
    }

    #[test]
    fn charset_and_string_sequences_are_skipped() {
        assert_eq!(counted(&[b"\x1b(Bok"]), 2);
        assert_eq!(counted(&[b"\x1bPq#0;2;0;0;0\x1b\\ok"]), 2);
    }

    #[test]
    fn a_sequence_split_across_chunks_is_still_skipped() {
        assert_eq!(counted(&[b"ab\x1b[3", b"1mcd"]), 4);
        assert_eq!(counted(&[b"\x1b", b"[0m", b"z"]), 1);
    }

    #[test]
    fn nothing_running_is_unknown() {
        let mut meter = Meter::default();
        assert_eq!(meter.reading(), ContextReading::Unknown);
        meter.observe(1, false);
        meter.add(10_000);
        assert_eq!(meter.reading(), ContextReading::Unknown);
    }

    #[test]
    fn a_running_agent_is_an_estimate_of_what_it_has_seen() {
        let mut meter = Meter::default();
        meter.set_kind(Some(AgentKind::Claude));
        meter.observe(1, true);
        meter.add((ESTIMATE_TOKEN_WINDOW * BYTES_PER_TOKEN / 4) as usize);
        assert_eq!(meter.reading(), ContextReading::Estimate { percent: 25 });
    }

    #[test]
    fn a_fresh_agent_starts_the_count_over() {
        let mut meter = Meter::default();
        meter.set_kind(Some(AgentKind::Claude));
        meter.observe(1, true);
        meter.add(400_000);
        meter.observe(2, true);
        assert_eq!(meter.reading(), ContextReading::Estimate { percent: 0 });
    }

    #[test]
    fn a_stopped_agent_is_unknown_again() {
        let mut meter = Meter::default();
        meter.set_kind(Some(AgentKind::Claude));
        meter.observe(1, true);
        meter.add(400_000);
        meter.observe(1, false);
        assert_eq!(meter.reading(), ContextReading::Unknown);
    }

    #[test]
    fn an_agent_with_no_documented_window_is_unknown_not_a_guess() {
        let mut meter = Meter::default();
        meter.set_kind(Some(AgentKind::Devin));
        meter.observe(1, true);
        meter.add(400_000);
        assert_eq!(meter.reading(), ContextReading::Unknown);
    }

    #[test]
    fn no_kind_set_yet_is_unknown_not_a_guess() {
        let mut meter = Meter::default();
        meter.observe(1, true);
        meter.add(400_000);
        assert_eq!(meter.reading(), ContextReading::Unknown);
    }
}
