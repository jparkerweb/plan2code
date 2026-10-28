//! The words the quit check shows while an agent runs. Most of the time the
//! agent is not mid-step at all but waiting on the person's answer in the web
//! console, so the check reads the page's last taskbar signal (attention.rs)
//! and says which case it is. Anything it cannot be sure of is the working
//! case, the safer warning. Knows nothing about Tauri; main.rs shows it.

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
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct QuitPrompt {
    pub case: QuitCase,
    pub title: &'static str,
    pub heading: &'static str,
    pub message: &'static str,
    pub quit: &'static str,
    pub stay: &'static str,
}

/// The prompt for the page's last signal (`None` before the page has sent one).
pub fn quit_prompt(last: Option<Signal>) -> QuitPrompt {
    match last {
        Some(Signal::Ready | Signal::Plain) => QuitPrompt {
            case: QuitCase::Waiting,
            title: "Plan2Code",
            heading: "Done for now?",
            message: "Your agent is just waiting on your next answer. Quit and this session ends.",
            quit: "Quit",
            stay: "Stay",
        },
        Some(Signal::Busy | Signal::Attention) | None => QuitPrompt {
            case: QuitCase::Working,
            title: "Plan2Code",
            heading: "Leave while your agent is busy?",
            message: "If you quit now, the agent stops mid-step. Everything it has saved so far stays put.",
            quit: "Quit and stop it",
            stay: "Stay",
        },
    }
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
        for last in [None, Some(Signal::Busy), Some(Signal::Ready)] {
            let p = quit_prompt(last);
            for text in [p.title, p.heading, p.message, p.quit, p.stay] {
                assert!(!text.contains('\u{2014}'), "{text}");
            }
        }
    }
}
