//! The words the quit check shows while an agent runs. Most of the time the
//! agent is not mid-step at all but waiting on the person's answer in the web
//! console, so the check reads the page's last taskbar signal (attention.rs)
//! and says which case it is. Anything it cannot be sure of is the working
//! case, the safer warning. While the Implementation Loop builds a phase the
//! words are the loop's own (`loop_quit_prompt`). Knows nothing about Tauri;
//! main.rs shows it.

use crate::attention::Signal;

/// Whether quitting would stop the agent partway through something.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum QuitCase {
    /// The person's move, or nothing left to do: nothing is half done.
    Waiting,
    /// Busy, quiet for too long, gone, or not known yet.
    Working,
}

/// Everything the box says.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct QuitPrompt {
    pub case: QuitCase,
    pub title: String,
    pub heading: String,
    pub message: String,
    pub quit: String,
    pub stay: String,
}

fn words(case: QuitCase, heading: &str, message: &str, quit: &str) -> QuitPrompt {
    QuitPrompt {
        case,
        title: "Plan2Code".to_string(),
        heading: heading.to_string(),
        message: message.to_string(),
        quit: quit.to_string(),
        stay: "Stay".to_string(),
    }
}

/// The prompt for the page's last signal (`None` before the page has sent one).
pub fn quit_prompt(last: Option<Signal>) -> QuitPrompt {
    match last {
        Some(Signal::Ready | Signal::Plain) => words(
            QuitCase::Waiting,
            "Done for now?",
            "Your agent is just waiting on your next answer. Quit and this session ends.",
            "Quit",
        ),
        Some(Signal::Busy | Signal::Attention) | None => words(
            QuitCase::Working,
            "Leave while your agent is busy?",
            "If you quit now, the agent stops mid-step. Everything it has saved so far stays put.",
            "Quit and stop it",
        ),
    }
}

/// "Phase 1", "Phases 1 and 2", "Phases 1, 2 and 3".
fn phase_list(committed: &[u32]) -> String {
    let numbers: Vec<String> = committed.iter().map(u32::to_string).collect();
    match numbers.as_slice() {
        [] => String::new(),
        [one] => format!("Phase {one}"),
        [init @ .., last] => format!("Phases {} and {last}", init.join(", ")),
    }
}

/// The words for quitting while the Implementation Loop builds a phase.
/// `committed` lists the phase numbers already committed.
pub fn loop_quit_prompt(phase: u32, phases: u32, committed: &[u32]) -> QuitPrompt {
    let done = match committed.len() {
        0 => "No phase is committed yet".to_string(),
        1 => format!("{} is committed", phase_list(committed)),
        _ => format!("{} are committed", phase_list(committed)),
    };
    words(
        QuitCase::Working,
        "Stop the loop and quit?",
        &format!(
            "Phase {phase} of {phases} is mid-build. {done}; this phase's changes stay uncommitted."
        ),
        "Quit and stop the loop",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_persons_move_and_nothing_left_are_the_waiting_case() {
        assert_eq!(quit_prompt(Some(Signal::Ready)).case, QuitCase::Waiting);
        assert_eq!(quit_prompt(Some(Signal::Plain)).case, QuitCase::Waiting);
    }

    #[test]
    fn busy_attention_and_unknown_are_the_working_case() {
        assert_eq!(quit_prompt(Some(Signal::Busy)).case, QuitCase::Working);
        assert_eq!(
            quit_prompt(Some(Signal::Attention)).case,
            QuitCase::Working,
            "attention covers a quiet agent that may still be mid-step"
        );
        assert_eq!(quit_prompt(None).case, QuitCase::Working);
    }

    #[test]
    fn each_case_has_its_own_words() {
        let waiting = quit_prompt(Some(Signal::Ready));
        assert_eq!(waiting.heading, "Done for now?");
        assert_eq!(waiting.quit, "Quit");
        let working = quit_prompt(Some(Signal::Busy));
        assert_eq!(working.heading, "Leave while your agent is busy?");
        assert_eq!(working.quit, "Quit and stop it");
        assert!(working.message.contains("mid-step"));
    }

    #[test]
    fn stay_is_never_mistaken_for_quit() {
        for last in [None, Some(Signal::Busy), Some(Signal::Ready)] {
            let prompt = quit_prompt(last);
            assert_eq!(prompt.stay, "Stay");
            assert_ne!(prompt.stay, prompt.quit);
            assert_eq!(prompt.title, "Plan2Code");
        }
    }

    #[test]
    fn no_text_carries_an_em_dash() {
        let mut all = vec![loop_quit_prompt(2, 4, &[1]), loop_quit_prompt(1, 4, &[])];
        all.extend([None, Some(Signal::Busy), Some(Signal::Ready)].map(quit_prompt));
        for p in all {
            for text in [&p.title, &p.heading, &p.message, &p.quit, &p.stay] {
                assert!(!text.contains('\u{2014}'), "{text}");
            }
        }
    }

    #[test]
    fn the_loop_wording_names_what_is_committed() {
        let none = loop_quit_prompt(1, 4, &[]);
        assert_eq!(none.heading, "Stop the loop and quit?");
        assert_eq!(none.title, "Plan2Code");
        assert_eq!(none.quit, "Quit and stop the loop");
        assert_eq!(none.stay, "Stay");
        assert_eq!(none.case, QuitCase::Working);
        assert_eq!(
            none.message,
            "Phase 1 of 4 is mid-build. No phase is committed yet; this phase's changes stay uncommitted."
        );
        assert_eq!(
            loop_quit_prompt(2, 4, &[1]).message,
            "Phase 2 of 4 is mid-build. Phase 1 is committed; this phase's changes stay uncommitted."
        );
        assert_eq!(
            loop_quit_prompt(3, 4, &[1, 2]).message,
            "Phase 3 of 4 is mid-build. Phases 1 and 2 are committed; this phase's changes stay uncommitted."
        );
        assert_eq!(
            loop_quit_prompt(4, 4, &[1, 2, 3]).message,
            "Phase 4 of 4 is mid-build. Phases 1, 2 and 3 are committed; this phase's changes stay uncommitted."
        );
    }
}
