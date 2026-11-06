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
        // No mentions, whatever a spec is called: this must never ping a channel.
        NotifyKind::Discord => json!({ "content": message, "allowed_mentions": { "parse": [] } }),
        NotifyKind::Slack => json!({ "text": slack_escaped(message) }),
        NotifyKind::GoogleChat => json!({ "text": message }),
        // A Teams workflow's "when a webhook request is received" trigger.
        NotifyKind::Teams => json!({
            "type": "message",
            "attachments": [{
                "contentType": "application/vnd.microsoft.card.adaptive",
                "contentUrl": null,
                "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": [{ "type": "TextBlock", "text": message, "wrap": true }],
                },
            }],
        }),
    };
    (url.to_string(), Some(body))
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
        assert_eq!(body["content"], "all done");
    }

    #[test]
    fn each_service_gets_the_shape_it_wants() {
        let body = |kind, message| {
            request_for(kind, "https://e.com/x", "note", message)
                .1
                .unwrap()
        };
        assert_eq!(body(NotifyKind::Json, "hi"), json!({ "note": "hi" }));
        assert_eq!(
            body(NotifyKind::Discord, "@everyone hi"),
            json!({ "content": "@everyone hi", "allowed_mentions": { "parse": [] } }),
            "a mention in a spec's name pings nobody"
        );
        assert_eq!(
            body(NotifyKind::Slack, "a <b> & c"),
            json!({ "text": "a &lt;b&gt; &amp; c" })
        );
        assert_eq!(body(NotifyKind::GoogleChat, "hi"), json!({ "text": "hi" }));
        let teams = body(NotifyKind::Teams, "hi");
        assert_eq!(teams["type"], "message");
        let attachment = &teams["attachments"][0];
        assert_eq!(
            attachment["contentType"],
            "application/vnd.microsoft.card.adaptive"
        );
        assert_eq!(attachment["content"]["type"], "AdaptiveCard");
        assert_eq!(attachment["content"]["body"][0]["text"], "hi");
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
