//! Confirms the Rust side asks the person, drawn by the shell's own modal (`ui/app.js`
//! `confirmModal`) instead of the OS message box: one look, Stay or Cancel first and focused,
//! `role="alertdialog"`. This module is the request's shape and the table of waiting answers; it
//! knows nothing about Tauri. main.rs emits a `confirm-request` event with a [`ConfirmRequest`]
//! and blocks on the [`Receiver`] until the page calls `confirm_answer`.

use std::collections::HashMap;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Mutex;
use std::time::Duration;

/// How long a confirm may stay unanswered before it counts as Cancel (a reloaded window would
/// otherwise leave its thread waiting for good).
pub const ANSWER_TIMEOUT: Duration = Duration::from_secs(15 * 60);

/// One line of a confirm's body: plain text, a code block or an amber callout.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct ConfirmLine {
    pub kind: &'static str,
    pub text: String,
}

impl ConfirmLine {
    pub fn text(text: impl Into<String>) -> Self {
        Self {
            kind: "text",
            text: text.into(),
        }
    }
    pub fn code(text: impl Into<String>) -> Self {
        Self {
            kind: "code",
            text: text.into(),
        }
    }
    pub fn callout(text: impl Into<String>) -> Self {
        Self {
            kind: "callout",
            text: text.into(),
        }
    }
}

/// What the modal shows. `safe_first` puts Cancel (or Stay) first and gives it focus; `danger`
/// colors the primary as the named danger verb.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmRequest {
    pub id: String,
    pub title: String,
    pub lines: Vec<ConfirmLine>,
    pub primary: String,
    pub cancel: String,
    pub danger: bool,
    pub safe_first: bool,
}

/// The answers still to come, by request id.
#[derive(Default)]
pub struct Pending {
    waiting: Mutex<HashMap<String, Sender<bool>>>,
    next: Mutex<u64>,
}

impl Pending {
    /// A new request id and the receiver its answer arrives on.
    pub fn register(&self) -> (String, Receiver<bool>) {
        let id = {
            let mut next = self.next.lock().unwrap_or_else(|e| e.into_inner());
            *next += 1;
            format!("confirm-{}", *next)
        };
        let (tx, rx) = channel();
        self.waiting
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(id.clone(), tx);
        (id, rx)
    }

    /// The page's answer. False when no such request is waiting (a stale or invented id), which
    /// changes nothing.
    pub fn answer(&self, id: &str, yes: bool) -> bool {
        let tx = self
            .waiting
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(id);
        tx.is_some_and(|tx| tx.send(yes).is_ok())
    }

    /// Answers every waiting request with Cancel: a page that has just started listening is not
    /// showing an older modal, so whatever was asked before it listened will never be answered.
    pub fn cancel_all(&self) {
        let waiting = std::mem::take(&mut *self.waiting.lock().unwrap_or_else(|e| e.into_inner()));
        for tx in waiting.into_values() {
            let _ = tx.send(false);
        }
    }

    /// Forgets a request that was never answered (a timeout, or a window that could not be told).
    pub fn forget(&self, id: &str) {
        self.waiting
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(id);
    }
}

/// Waits for an answer: true only for an explicit yes; a timeout, a dropped sender or a no is Cancel.
pub fn wait_for(rx: &Receiver<bool>, timeout: Duration) -> bool {
    rx.recv_timeout(timeout).unwrap_or(false)
}

/// The quit check's request: the safe answer (Stay) first and focused, the quit verb last.
pub fn quit_request(
    id: String,
    heading: &str,
    message: &str,
    quit: &str,
    stay: &str,
) -> ConfirmRequest {
    ConfirmRequest {
        id,
        title: heading.to_string(),
        lines: vec![ConfirmLine::text(message)],
        primary: quit.to_string(),
        cancel: stay.to_string(),
        danger: true,
        safe_first: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_answer_reaches_the_waiting_request_once() {
        let pending = Pending::default();
        let (id, rx) = pending.register();
        assert!(pending.answer(&id, true));
        assert!(wait_for(&rx, Duration::from_millis(50)));
        assert!(
            !pending.answer(&id, true),
            "answered already: a second answer finds nothing"
        );
    }

    #[test]
    fn ids_are_distinct_and_an_unknown_id_answers_nothing() {
        let pending = Pending::default();
        let (a, _ra) = pending.register();
        let (b, _rb) = pending.register();
        assert_ne!(a, b);
        assert!(!pending.answer("confirm-999", true));
    }

    #[test]
    fn cancel_all_answers_every_waiting_request_with_cancel() {
        let pending = Pending::default();
        let (a, ra) = pending.register();
        let (b, rb) = pending.register();
        pending.cancel_all();
        assert!(!wait_for(&ra, Duration::from_millis(50)));
        assert!(!wait_for(&rb, Duration::from_millis(50)));
        assert!(
            !pending.answer(&a, true) && !pending.answer(&b, true),
            "nothing is left waiting"
        );
        pending.cancel_all();
    }

    #[test]
    fn no_answer_in_time_is_cancel_and_so_is_a_no() {
        let pending = Pending::default();
        let (id, rx) = pending.register();
        assert!(
            !wait_for(&rx, Duration::from_millis(10)),
            "timeout is Cancel"
        );
        let (id2, rx2) = pending.register();
        pending.answer(&id2, false);
        assert!(!wait_for(&rx2, Duration::from_millis(50)));
        pending.forget(&id);
        assert!(
            !pending.answer(&id, true),
            "a forgotten request takes no answer"
        );
    }

    #[test]
    fn the_quit_request_puts_stay_first_and_quit_last_as_the_danger_verb() {
        let request = quit_request("c1".into(), "Done for now?", "It ends.", "Quit", "Stay");
        assert!(request.safe_first && request.danger);
        assert_eq!(
            (request.primary.as_str(), request.cancel.as_str()),
            ("Quit", "Stay")
        );
        let json = serde_json::to_value(&request).unwrap();
        assert_eq!(json["safeFirst"], true, "camelCase for the page");
        assert_eq!(json["lines"][0]["kind"], "text");
    }

    #[test]
    fn no_text_carries_an_em_dash() {
        let request = quit_request("c1".into(), "Done for now?", "It ends.", "Quit", "Stay");
        for text in [
            &request.title,
            &request.lines[0].text,
            &request.primary,
            &request.cancel,
        ] {
            assert!(!text.contains('\u{2014}'));
        }
    }
}
