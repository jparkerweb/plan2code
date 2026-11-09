//! The Implementation Loop's notification to a web address the person chose,
//! when it needs them or ends: a plain GET with the message in the query
//! string, or a POST in the shape a chat service's webhook wants. The kind, the
//! address and the name come from `loop-setup.json` and the app names them in
//! its own Start confirm; the message is written by the loop. A failed call
//! never changes what the loop does, and its reason never repeats the address,
//! which may hold a token.

use reqwest::{blocking::Client, header::CONTENT_TYPE, redirect::Policy, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

/// How the message reaches the address. To add a service: a variant here, its
/// body in `request_for`, its words in `describe`, and its row in the setup
/// screen's `NOTIFY_KINDS` and `loop-setup.mjs`'s list.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NotifyKind {
    /// A GET with the message in a query string parameter the person names.
    #[default]
    Query,
    /// A POST of a JSON object with the message in a field the person names.
    Json,
    Discord,
    Slack,
    Teams,
    GoogleChat,
}

impl NotifyKind {
    /// Whether the person names the parameter or field that holds the message.
    pub fn uses_param(self) -> bool {
        matches!(self, NotifyKind::Query | NotifyKind::Json)
    }
}

pub const DEFAULT_PARAM: &str = "message";
const MAX_URL: usize = 2000;
const MAX_PARAM: usize = 64;
const CALL_LIMIT: Duration = Duration::from_secs(10);

/// Whether `url` is an http or https address the app may call: printable ASCII
/// (anything else percent-encoded), a host, and no user name or password.
pub fn valid_url(url: &str) -> bool {
    if url.len() > MAX_URL || !url.chars().all(|c| ('!'..='~').contains(&c)) {
        return false;
    }
    let lower = url.to_ascii_lowercase();
    let Some(rest) = lower
        .strip_prefix("http://")
        .or_else(|| lower.strip_prefix("https://"))
    else {
        return false;
    };
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    !authority.is_empty()
        && !authority.contains('@')
        && Url::parse(url).is_ok_and(|u| u.host_str().is_some())
}

/// Whether `name` can stand as a query parameter's name without being encoded.
pub fn valid_param(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_PARAM
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '~'))
}

fn encode(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            out.push(char::from(byte));
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

/// `url` with `param=message` in its query. The address's other parameters and
/// fragment stay; a parameter of the same name is replaced.
pub fn target_url(url: &str, param: &str, message: &str) -> String {
    let (rest, fragment) = match url.split_once('#') {
        Some((rest, fragment)) => (rest, Some(fragment)),
        None => (url, None),
    };
    let (base, query) = rest.split_once('?').unwrap_or((rest, ""));
    let mut pairs: Vec<String> = query
        .split('&')
        .filter(|pair| !pair.is_empty() && pair.split('=').next() != Some(param))
        .map(str::to_string)
        .collect();
    pairs.push(format!("{param}={}", encode(message)));
    let mut out = format!("{base}?{}", pairs.join("&"));
    if let Some(fragment) = fragment {
        out.push('#');
        out.push_str(fragment);
    }
    out
}

/// Whether the setup's notification fields can be used, for an address that is set.
pub fn valid_setup(kind: NotifyKind, url: &str, param: &str) -> bool {
    valid_url(url) && (!kind.uses_param() || valid_param(param))
}

/// What an outcome looks like on a card.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tone {
    Done,
    Waiting,
    Stopped,
    Plain,
}

/// A loop message read into the parts of a card.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Look {
    pub tone: Tone,
    pub title: String,
    pub description: String,
    /// Project, Spec and Elapsed, in that order, each only when the message has it.
    pub fields: Vec<(&'static str, String)>,
}

impl Tone {
    fn discord_color(self) -> u32 {
        match self {
            Tone::Done => 0x57F287,
            Tone::Waiting => 0xFEE75C,
            Tone::Stopped => 0xED4245,
            Tone::Plain => 0x5865F2,
        }
    }

    fn slack_color(self) -> &'static str {
        match self {
            Tone::Done => "#2EB67D",
            Tone::Waiting => "#ECB22E",
            Tone::Stopped => "#E01E5A",
            Tone::Plain => "#5865F2",
        }
    }

    /// An Adaptive Card text color.
    fn teams_color(self) -> &'static str {
        match self {
            Tone::Done => "Good",
            Tone::Waiting => "Warning",
            Tone::Stopped => "Attention",
            Tone::Plain => "Accent",
        }
    }
}

const FOOTER: &str = "Plan2Code loop";
/// Discord stops an embed's description at 4096 characters.
const MAX_DESCRIPTION: usize = 4000;

/// Read a message the loop wrote (`loop_driver.rs`) into a card: its outcome
/// from the words it always uses, and the trailing "Elapsed: ..." as a field.
/// A message it does not know stays whole, as a plain card.
pub fn look(message: &str) -> Look {
    // Elapsed ends every message; the last one is the real one, whatever a
    // commit subject or an agent's line said before it.
    let (description, elapsed) = match message.rsplit_once("Elapsed: ") {
        Some((before, after)) => (
            before.trim(),
            Some(after.trim().trim_end_matches('.').to_string()).filter(|e| !e.is_empty()),
        ),
        None => (message.trim(), None),
    };
    // The outcome is in the message's leading words, never in the free text
    // after them (a commit subject, an agent's line).
    let (tone, title) = if description.starts_with("Plan2Code loop is waiting on") {
        (Tone::Waiting, "❓ Waiting for you")
    } else if description.starts_with("Plan2Code loop stopped on") {
        if description.ends_with("has a question for you to answer.") {
            (Tone::Waiting, "❓ Stopped on a question")
        } else {
            (Tone::Stopped, "🛑 Loop stopped")
        }
    } else if description.starts_with("Plan2Code loop complete on") {
        (Tone::Done, "✅ Loop complete")
    } else if description.starts_with("Plan2Code loop on") && description.contains(" is complete.")
    {
        (Tone::Done, "✅ Phase complete")
    } else {
        (Tone::Plain, "📣 Plan2Code loop")
    };
    let mut fields = Vec::new();
    if let Some((project, spec)) = label(message) {
        if !project.is_empty() {
            fields.push(("Project", project));
        }
        fields.push(("Spec", spec));
    }
    fields.extend(elapsed.map(|e| ("Elapsed", e)));
    Look {
        tone,
        title: title.to_string(),
        description: description.chars().take(MAX_DESCRIPTION).collect(),
        fields,
    }
}

/// The "project / spec" the loop's messages name after " on " (`Where::label`
/// in `loop_driver.rs`), as (project, spec); the project is empty when the
/// folder has no name. None for a message that does not name one.
fn label(message: &str) -> Option<(String, String)> {
    let (_, after) = message.split_once(" on ")?;
    let end = [": ", " at Phase "]
        .iter()
        .filter_map(|stop| after.find(stop))
        .min()?;
    let label = after[..end].trim();
    if label.is_empty() {
        return None;
    }
    Some(match label.split_once(" / ") {
        Some((project, spec)) => (project.to_string(), spec.to_string()),
        None => (String::new(), label.to_string()),
    })
}

/// Slack treats these three as its own markup in message text.
fn slack_escaped(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// The address to call and, for a POST, the JSON body.
pub fn request_for(
    kind: NotifyKind,
    url: &str,
    param: &str,
    message: &str,
) -> (String, Option<Value>) {
    let body = match kind {
        NotifyKind::Query => return (target_url(url, param, message), None),
        NotifyKind::Json => json!({ param: message }),
        NotifyKind::Discord => discord_card(&look(message)),
        NotifyKind::Slack => slack_card(&look(message)),
        NotifyKind::GoogleChat => google_chat_card(&look(message)),
        NotifyKind::Teams => teams_card(&look(message)),
    };
    (url.to_string(), Some(body))
}

/// An embed: a colored bar, a title, the message, an Elapsed field and a footer.
fn discord_card(look: &Look) -> Value {
    let mut embed = json!({
        "title": look.title,
        "description": look.description,
        "color": look.tone.discord_color(),
        "footer": { "text": FOOTER },
    });
    if !look.fields.is_empty() {
        embed["fields"] = look
            .fields
            .iter()
            .map(|(name, value)| json!({ "name": name, "value": value, "inline": true }))
            .collect();
    }
    // No mentions, whatever a spec is called: this must never ping a channel.
    json!({ "embeds": [embed], "allowed_mentions": { "parse": [] } })
}

/// An attachment: the same parts, in Slack's own markup rules.
fn slack_card(look: &Look) -> Value {
    let mut attachment = json!({
        "fallback": slack_escaped(&look.description),
        "color": look.tone.slack_color(),
        "title": slack_escaped(&look.title),
        "text": slack_escaped(&look.description),
        "footer": FOOTER,
    });
    if !look.fields.is_empty() {
        attachment["fields"] = look
            .fields
            .iter()
            .map(|(title, value)| json!({ "title": title, "value": slack_escaped(value), "short": true }))
            .collect();
    }
    json!({ "attachments": [attachment] })
}

/// A Google Chat card has no color bar, so the title's emoji carries the outcome.
/// Its text paragraphs read a little HTML, so the message is escaped as for Slack.
fn google_chat_card(look: &Look) -> Value {
    let mut widgets =
        vec![json!({ "textParagraph": { "text": slack_escaped(&look.description) } })];
    for (label, value) in &look.fields {
        widgets
            .push(json!({ "decoratedText": { "topLabel": label, "text": slack_escaped(value) } }));
    }
    json!({
        "cardsV2": [{
            "cardId": "plan2code-loop",
            "card": {
                "header": { "title": look.title, "subtitle": FOOTER },
                "sections": [{ "widgets": widgets }],
            },
        }],
    })
}

/// A Teams workflow's "when a webhook request is received" trigger.
fn teams_card(look: &Look) -> Value {
    let mut body = vec![
        json!({
            "type": "TextBlock",
            "text": look.title,
            "weight": "Bolder",
            "size": "Medium",
            "color": look.tone.teams_color(),
            "wrap": true,
        }),
        json!({ "type": "TextBlock", "text": look.description, "wrap": true }),
    ];
    if !look.fields.is_empty() {
        let facts: Vec<Value> = look
            .fields
            .iter()
            .map(|(title, value)| json!({ "title": title, "value": value }))
            .collect();
        body.push(json!({ "type": "FactSet", "facts": facts }));
    }
    json!({
        "type": "message",
        "attachments": [{
            "contentType": "application/vnd.microsoft.card.adaptive",
            "contentUrl": null,
            "content": {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": body,
            },
        }],
    })
}

/// The Start confirm's words for what the app will do.
pub fn describe(kind: NotifyKind, url: &str, param: &str) -> String {
    match kind {
        NotifyKind::Query => format!("the app calls: {url} with a message in {param}"),
        NotifyKind::Json => format!("the app posts to: {url} with a message in {param}"),
        NotifyKind::Discord => format!("the app posts to Discord at: {url}"),
        NotifyKind::Slack => format!("the app posts to Slack at: {url}"),
        NotifyKind::Teams => format!("the app posts to Microsoft Teams at: {url}"),
        NotifyKind::GoogleChat => format!("the app posts to Google Chat at: {url}"),
    }
}

/// Send the message, within ten seconds. Any 2xx answer counts as sent. The
/// error is safe to show: it never holds the address.
pub fn send(kind: NotifyKind, url: &str, param: &str, message: &str) -> Result<(), String> {
    let client = Client::builder()
        .timeout(CALL_LIMIT)
        .redirect(Policy::limited(5))
        .build()
        .map_err(|_| "the app could not prepare the call".to_string())?;
    let (address, body) = request_for(kind, url, param, message);
    let request = match body {
        None => client.get(address),
        Some(body) => client
            .post(address)
            .header(CONTENT_TYPE, "application/json")
            .body(body.to_string()),
    };
    let response = request.send().map_err(|e| {
        if e.is_timeout() {
            "it did not answer within 10 seconds".to_string()
        } else if e.is_connect() {
            "the app could not connect to it".to_string()
        } else {
            "the call failed".to_string()
        }
    })?;
    let status = response.status();
    if status.is_success() {
        Ok(())
    } else {
        Err(format!("it answered {}", status.as_u16()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    /// Answer one request with `status` on a local port; gives back the whole request.
    fn one_call(status: &'static str) -> (String, thread::JoinHandle<String>) {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = String::new();
            let mut buf = [0u8; 4096];
            loop {
                let n = stream.read(&mut buf).unwrap();
                request.push_str(&String::from_utf8_lossy(&buf[..n]));
                let Some((head, body)) = request.split_once("\r\n\r\n") else {
                    continue;
                };
                let length = head
                    .lines()
                    .find_map(|l| {
                        l.to_ascii_lowercase()
                            .strip_prefix("content-length: ")
                            .map(str::to_string)
                    })
                    .and_then(|l| l.parse::<usize>().ok())
                    .unwrap_or(0);
                if n == 0 || body.len() >= length {
                    break;
                }
            }
            let answer =
                format!("HTTP/1.1 {status}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
            stream.write_all(answer.as_bytes()).unwrap();
            request
        });
        (format!("http://127.0.0.1:{port}/hook?team=a"), handle)
    }

    #[test]
    fn only_http_and_https_addresses_with_a_host_are_valid() {
        for good in [
            "http://example.com",
            "https://example.com/hook?x=1#top",
            "HTTPS://EXAMPLE.COM/a%20b",
            "http://127.0.0.1:8080/",
        ] {
            assert!(valid_url(good), "{good}");
        }
        for bad in [
            "",
            "example.com",
            "ftp://example.com",
            "file:///c:/x",
            "javascript:alert(1)",
            "https:/example.com",
            "https://",
            "https://?x=1",
            "https://exa mple.com",
            "https://example.com/é",
            "https://me:secret@example.com/",
            "https://example.com/\nx",
        ] {
            assert!(!valid_url(bad), "{bad}");
        }
        assert!(!valid_url(&format!(
            "https://e.com/{}",
            "x".repeat(MAX_URL)
        )));
    }

    #[test]
    fn a_parameter_name_needs_no_encoding() {
        for good in ["message", "msg_1", "a-b.c~d", "M"] {
            assert!(valid_param(good), "{good}");
        }
        for bad in ["", "a b", "a=b", "a&b", "a?b", "a#b", "a%20b", "é", "[x]"] {
            assert!(!valid_param(bad), "{bad}");
        }
        assert!(!valid_param(&"x".repeat(MAX_PARAM + 1)));
    }

    #[test]
    fn the_message_lands_encoded_in_the_query_beside_what_is_there() {
        assert_eq!(
            target_url("https://e.com/hook", "message", "a b&c=d/é"),
            "https://e.com/hook?message=a%20b%26c%3Dd%2F%C3%A9"
        );
        assert_eq!(
            target_url("https://e.com/hook?t=1&x=2#top", "msg", "hi"),
            "https://e.com/hook?t=1&x=2&msg=hi#top"
        );
        assert_eq!(
            target_url("https://e.com/?msg=old&t=1", "msg", "new"),
            "https://e.com/?t=1&msg=new",
            "a parameter of the same name is replaced"
        );
    }

    #[test]
    fn the_call_is_a_get_with_the_message_in_the_query() {
        let (url, server) = one_call("200 OK");
        assert_eq!(send(NotifyKind::Query, &url, "message", "all done"), Ok(()));
        assert_eq!(
            server.join().unwrap().lines().next().unwrap(),
            "GET /hook?team=a&message=all%20done HTTP/1.1"
        );
    }

    #[test]
    fn a_webhook_gets_a_post_of_json_at_the_address_as_given() {
        let (url, server) = one_call("204 No Content");
        assert_eq!(
            send(NotifyKind::Discord, &url, "ignored", "all done"),
            Ok(())
        );
        let request = server.join().unwrap();
        assert_eq!(
            request.lines().next().unwrap(),
            "POST /hook?team=a HTTP/1.1"
        );
        assert!(request
            .to_ascii_lowercase()
            .contains("content-type: application/json"));
        let (_, body) = request.split_once("\r\n\r\n").unwrap();
        let body: Value = serde_json::from_str(body).unwrap();
        assert_eq!(body["embeds"][0]["description"], "all done");
    }

    const DONE: &str =
        "Plan2Code loop complete on plan2code / lunch: all 4 phases built. Elapsed: 14m.";
    const PHASE: &str = "Plan2Code loop on plan2code / lunch: Phase 2 of 4 (Setup) is complete. Done: 6 tasks. Next: Phase 3. Elapsed: phase 6m, run 14m.";
    const ASKED: &str = "Plan2Code loop is waiting on plan2code / lunch: Phase 2 of 4 has a question for you to answer. Elapsed: phase 1m, run 3m.";
    const ASKED_STOP: &str = "Plan2Code loop stopped on plan2code / lunch: Phase 2 of 4 has a question for you to answer. Elapsed: phase 1m, run 3m.";
    const STOPPED: &str = "Plan2Code loop stopped on plan2code / lunch at Phase 2 of 4: the agent crashed (exit 1). Elapsed: phase 1m, run 3m.";

    #[test]
    fn a_message_reads_into_a_tone_a_title_and_an_elapsed_time() {
        for (message, tone, title, elapsed) in [
            (DONE, Tone::Done, "✅ Loop complete", "14m"),
            (PHASE, Tone::Done, "✅ Phase complete", "phase 6m, run 14m"),
            (
                ASKED,
                Tone::Waiting,
                "❓ Waiting for you",
                "phase 1m, run 3m",
            ),
            (
                ASKED_STOP,
                Tone::Waiting,
                "❓ Stopped on a question",
                "phase 1m, run 3m",
            ),
            (
                STOPPED,
                Tone::Stopped,
                "🛑 Loop stopped",
                "phase 1m, run 3m",
            ),
        ] {
            let got = look(message);
            assert_eq!(got.tone, tone, "{message}");
            assert_eq!(got.title, title, "{message}");
            assert_eq!(
                got.fields,
                vec![
                    ("Project", "plan2code".to_string()),
                    ("Spec", "lunch".to_string()),
                    ("Elapsed", elapsed.to_string()),
                ],
                "{message}"
            );
            assert!(!got.description.contains("Elapsed"), "{message}");
            assert!(got.description.starts_with("Plan2Code loop"), "{message}");
        }
        let plain = look("A test message from Plan2Code");
        assert_eq!(plain.tone, Tone::Plain);
        assert_eq!(plain.title, "📣 Plan2Code loop");
        assert_eq!(plain.description, "A test message from Plan2Code");
        assert!(plain.fields.is_empty());
        let bare = look("Plan2Code loop complete on lunch: 1 phase built. Elapsed: 2m.");
        assert_eq!(
            bare.fields,
            vec![("Spec", "lunch".to_string()), ("Elapsed", "2m".to_string())],
            "a spec with no project folder name shows only the spec"
        );
    }

    #[test]
    fn words_inside_the_message_do_not_change_what_it_is() {
        // A phase's commit subject is free text: it may say anything.
        let phase = look(
            "Plan2Code loop on plan2code / lunch: Phase 1 of 2 is complete. Done: committed \"Fix loop stopped on error: has a question, Elapsed: 3\" (abc1234). Next: Phase 2. Elapsed: phase 1m, run 2m.",
        );
        assert_eq!(phase.tone, Tone::Done);
        assert_eq!(phase.title, "✅ Phase complete");
        assert!(
            phase.description.contains("Elapsed: 3"),
            "{}",
            phase.description
        );
        assert!(phase.description.ends_with("Next: Phase 2."));
        assert_eq!(
            phase.fields.last(),
            Some(&("Elapsed", "phase 1m, run 2m".to_string()))
        );
        let crash = look(
            "Plan2Code loop stopped on plan2code / lunch at Phase 2 of 4: the work is complete. Elapsed: phase 1m, run 3m.",
        );
        assert_eq!(crash.tone, Tone::Stopped);
    }

    #[test]
    fn discord_gets_an_embed_with_a_colored_bar_and_no_pings() {
        let body = request_for(NotifyKind::Discord, "https://e.com/x", "n", DONE)
            .1
            .unwrap();
        assert_eq!(body["allowed_mentions"], json!({ "parse": [] }));
        let embed = &body["embeds"][0];
        assert_eq!(embed["title"], "✅ Loop complete");
        assert_eq!(embed["color"], 0x57F287);
        assert_eq!(
            embed["description"],
            "Plan2Code loop complete on plan2code / lunch: all 4 phases built."
        );
        assert_eq!(
            embed["fields"],
            json!([
                { "name": "Project", "value": "plan2code", "inline": true },
                { "name": "Spec", "value": "lunch", "inline": true },
                { "name": "Elapsed", "value": "14m", "inline": true },
            ])
        );
        assert_eq!(embed["footer"]["text"], "Plan2Code loop");
        let stopped = request_for(NotifyKind::Discord, "https://e.com/x", "n", STOPPED)
            .1
            .unwrap();
        assert_eq!(stopped["embeds"][0]["color"], 0xED4245);
        let mention = request_for(NotifyKind::Discord, "https://e.com/x", "n", "@everyone hi")
            .1
            .unwrap();
        assert_eq!(mention["allowed_mentions"], json!({ "parse": [] }));
        assert!(mention["embeds"][0].get("fields").is_none());
        let long = "x".repeat(5000);
        let body = request_for(NotifyKind::Discord, "https://e.com/x", "n", &long)
            .1
            .unwrap();
        assert!(
            body["embeds"][0]["description"]
                .as_str()
                .unwrap()
                .chars()
                .count()
                <= 4000
        );
    }

    #[test]
    fn each_service_gets_the_shape_it_wants() {
        let body = |kind, message| {
            request_for(kind, "https://e.com/x", "note", message)
                .1
                .unwrap()
        };
        assert_eq!(body(NotifyKind::Json, "hi"), json!({ "note": "hi" }));
        let slack = body(NotifyKind::Slack, "a <b> & c");
        assert!(slack.get("text").is_none());
        let attachment = &slack["attachments"][0];
        assert_eq!(attachment["text"], "a &lt;b&gt; &amp; c");
        assert_eq!(attachment["fallback"], "a &lt;b&gt; &amp; c");
        assert_eq!(attachment["title"], "📣 Plan2Code loop");
        assert_eq!(attachment["color"], "#5865F2");
        assert_eq!(attachment["footer"], "Plan2Code loop");
        assert_eq!(
            body(NotifyKind::Slack, ASKED)["attachments"][0]["color"],
            "#ECB22E"
        );
        assert_eq!(
            body(NotifyKind::Teams, ASKED)["attachments"][0]["content"]["body"][0]["color"],
            "Warning"
        );
        assert_eq!(
            body(NotifyKind::Discord, ASKED)["embeds"][0]["color"],
            0xFEE75C
        );
        let slack = body(NotifyKind::Slack, STOPPED);
        assert_eq!(slack["attachments"][0]["color"], "#E01E5A");
        assert_eq!(
            slack["attachments"][0]["fields"],
            json!([
                { "title": "Project", "value": "plan2code", "short": true },
                { "title": "Spec", "value": "lunch", "short": true },
                { "title": "Elapsed", "value": "phase 1m, run 3m", "short": true },
            ])
        );
        let chat = body(NotifyKind::GoogleChat, PHASE);
        let card = &chat["cardsV2"][0]["card"];
        assert_eq!(card["header"]["title"], "✅ Phase complete");
        let widgets = &card["sections"][0]["widgets"];
        assert_eq!(
            widgets[0]["textParagraph"]["text"],
            "Plan2Code loop on plan2code / lunch: Phase 2 of 4 (Setup) is complete. Done: 6 tasks. Next: Phase 3."
        );
        assert_eq!(widgets[1]["decoratedText"]["topLabel"], "Project");
        assert_eq!(widgets[1]["decoratedText"]["text"], "plan2code");
        assert_eq!(widgets[3]["decoratedText"]["topLabel"], "Elapsed");
        assert_eq!(widgets[3]["decoratedText"]["text"], "phase 6m, run 14m");
        let teams = body(NotifyKind::Teams, DONE);
        assert_eq!(teams["type"], "message");
        let attachment = &teams["attachments"][0];
        assert_eq!(
            attachment["contentType"],
            "application/vnd.microsoft.card.adaptive"
        );
        assert_eq!(attachment["content"]["type"], "AdaptiveCard");
        let card = &attachment["content"]["body"];
        assert_eq!(card[0]["text"], "✅ Loop complete");
        assert_eq!(card[0]["color"], "Good");
        assert_eq!(card[0]["weight"], "Bolder");
        assert_eq!(
            card[1]["text"],
            "Plan2Code loop complete on plan2code / lunch: all 4 phases built."
        );
        assert_eq!(
            card[2]["facts"],
            json!([
                { "title": "Project", "value": "plan2code" },
                { "title": "Spec", "value": "lunch" },
                { "title": "Elapsed", "value": "14m" },
            ])
        );
        assert_eq!(
            request_for(NotifyKind::Slack, "https://e.com/x", "n", "m").0,
            "https://e.com/x"
        );
        assert_eq!(
            request_for(NotifyKind::Query, "https://e.com/x", "n", "m"),
            ("https://e.com/x?n=m".to_string(), None)
        );
    }

    #[test]
    fn a_kind_reads_by_its_saved_name_and_only_some_need_a_name() {
        for (name, kind) in [
            ("query", NotifyKind::Query),
            ("json", NotifyKind::Json),
            ("discord", NotifyKind::Discord),
            ("slack", NotifyKind::Slack),
            ("teams", NotifyKind::Teams),
            ("google-chat", NotifyKind::GoogleChat),
        ] {
            assert_eq!(
                serde_json::from_value::<NotifyKind>(json!(name)).unwrap(),
                kind
            );
        }
        assert!(valid_setup(NotifyKind::Slack, "https://e.com/", "a b"));
        assert!(!valid_setup(NotifyKind::Query, "https://e.com/", "a b"));
        assert!(!valid_setup(NotifyKind::Json, "https://e.com/", ""));
        assert!(!valid_setup(NotifyKind::Slack, "e.com", "message"));
    }

    // Needs the internet, so only by hand: `cargo test live_https -- --ignored`.
    #[test]
    #[ignore]
    fn live_https_reaches_a_real_certificate() {
        assert_eq!(
            send(NotifyKind::Query, "https://example.com/", "message", "test"),
            Ok(())
        );
    }

    #[test]
    fn a_failed_call_says_why_without_the_address() {
        let (url, server) = one_call("503 Service Unavailable");
        assert_eq!(
            send(NotifyKind::Query, &url, "message", "x"),
            Err("it answered 503".to_string())
        );
        server.join().unwrap();

        // A port nothing listens on.
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        let err = send(
            NotifyKind::Slack,
            &format!("http://127.0.0.1:{port}/secret-token"),
            "message",
            "x",
        )
        .unwrap_err();
        assert!(!err.contains("secret-token"), "{err}");
    }
}
