//! This window's announce endpoint: `console.mjs open`, run by the agent inside
//! the app, POSTs the page it wants shown here instead of opening a browser.
//! Loopback only, one random token per window, so two windows never hear each
//! other's agents. Knows nothing about Tauri: the caller gets each accepted
//! notice through a callback.

use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};

/// The most an announce request may weigh: a URL and two short names.
const MAX_REQUEST: usize = 8 * 1024;
const READ_TIMEOUT: Duration = Duration::from_secs(3);

/// A page the console wants shown: where it is, the session it belongs to and
/// the skill it runs.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PageNotice {
    pub url: String,
    pub sid: String,
    pub workflow: String,
}

/// Says whether the window took the page. Only a page it took becomes the
/// window's current session, so a refused one never steers the next `open`.
pub type OnPage = Arc<dyn Fn(PageNotice) -> bool + Send + Sync>;

pub struct AnnounceServer {
    port: u16,
    token: String,
    /// The page most recently announced: what `GET /session` answers, so an
    /// agent's `open` joins the window's current session whatever its own
    /// environment (fixed when it started) says.
    current: Arc<Mutex<Option<PageNotice>>>,
}

/// What a checked request asks for.
#[derive(Debug, PartialEq, Eq)]
pub enum Request {
    /// `POST /page`: show this page.
    Page(PageNotice),
    /// `GET /session`: name the session the window shows now.
    Session,
}

/// Why a request was refused, as the status the caller answers with.
#[derive(Debug, PartialEq, Eq)]
pub struct Refused(pub u16, pub &'static str);

/// A random token from the OS-seeded hasher: 128 bits as hex. The standard
/// library's `RandomState` keys come from the operating system's random source.
fn random_token() -> String {
    let mut out = String::new();
    for round in 0..2u8 {
        let mut hasher = RandomState::new().build_hasher();
        hasher.write_u8(round);
        hasher.write_u128(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0),
        );
        out.push_str(&format!("{:016x}", hasher.finish()));
    }
    out
}

fn same_token(a: &str, b: &str) -> bool {
    // Compared in full whatever the first difference, so timing says nothing.
    let (a, b) = (a.as_bytes(), b.as_bytes());
    let mut diff = (a.len() != b.len()) as u8;
    for i in 0..a.len().min(b.len()) {
        diff |= a[i] ^ b[i];
    }
    diff == 0
}

/// A console page URL the app may show: plain http on loopback with a port and
/// a `/s/<token>/` path, which is all the console ever hands out.
pub fn acceptable_url(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("http://127.0.0.1:") else {
        return false;
    };
    let Some((port, path)) = rest.split_once('/') else {
        return false;
    };
    port.parse::<u16>().is_ok_and(|p| p > 0) && path.starts_with("s/") && !url.contains(char::is_whitespace)
}

/// Check one request (its head as text, its body as bytes) against `token`.
pub fn check_request(head: &str, body: &[u8], token: &str) -> Result<Request, Refused> {
    let mut lines = head.split("\r\n");
    let request_line = lines.next().unwrap_or("");
    let route = request_line.split(' ').take(2).collect::<Vec<_>>();
    if route != ["POST", "/page"] && route != ["GET", "/session"] {
        return Err(Refused(404, "not found"));
    }
    let mut given = None;
    for line in lines {
        let Some((name, value)) = line.split_once(':') else { continue };
        match name.trim().to_ascii_lowercase().as_str() {
            "x-plan2code-token" => given = Some(value.trim().to_string()),
            // A browser page sending this would be some site guessing at the port.
            "origin" => return Err(Refused(403, "not from a page")),
            _ => {}
        }
    }
    if !given.is_some_and(|given| same_token(&given, token)) {
        return Err(Refused(403, "bad token"));
    }
    if route[0] == "GET" {
        return Ok(Request::Session);
    }
    let notice: PageNotice = serde_json::from_slice(body).map_err(|_| Refused(400, "bad body"))?;
    if !acceptable_url(&notice.url) || notice.sid.len() > 128 || notice.workflow.len() > 64 {
        return Err(Refused(400, "bad page"));
    }
    Ok(Request::Page(notice))
}

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        403 => "Forbidden",
        _ => "Not Found",
    }
}

fn respond(stream: &mut TcpStream, status: u16, body: &str) {
    let _ = write!(
        stream,
        "HTTP/1.1 {status} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        reason(status),
        body.len()
    );
}

/// Read one request: the head up to the blank line, then the body the
/// `Content-Length` header names. Anything over `MAX_REQUEST` is refused.
fn read_request(stream: &mut TcpStream) -> Result<(String, Vec<u8>), Refused> {
    let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
    let mut buf = Vec::new();
    let mut chunk = [0u8; 1024];
    let split = loop {
        if let Some(at) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
            break at;
        }
        if buf.len() > MAX_REQUEST {
            return Err(Refused(400, "too big"));
        }
        match stream.read(&mut chunk) {
            Ok(0) | Err(_) => return Err(Refused(400, "incomplete")),
            Ok(n) => buf.extend_from_slice(&chunk[..n]),
        }
    };
    let head = String::from_utf8_lossy(&buf[..split]).into_owned();
    let length = head
        .split("\r\n")
        .filter_map(|line| line.split_once(':'))
        .find(|(name, _)| name.trim().eq_ignore_ascii_case("content-length"))
        .and_then(|(_, value)| value.trim().parse::<usize>().ok())
        .unwrap_or(0);
    if length > MAX_REQUEST {
        return Err(Refused(400, "too big"));
    }
    let mut body = buf[split + 4..].to_vec();
    while body.len() < length {
        match stream.read(&mut chunk) {
            Ok(0) | Err(_) => return Err(Refused(400, "incomplete")),
            Ok(n) => body.extend_from_slice(&chunk[..n]),
        }
    }
    body.truncate(length);
    Ok((head, body))
}

impl AnnounceServer {
    /// Listen on a random loopback port. `on_page` runs on the server's own
    /// thread for every accepted notice.
    pub fn start(on_page: OnPage) -> Result<AnnounceServer, String> {
        let listener = TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0))).map_err(|e| e.to_string())?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let token = random_token();
        let expected = token.clone();
        let current: Arc<Mutex<Option<PageNotice>>> = Arc::new(Mutex::new(None));
        let shared = Arc::clone(&current);
        thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { continue };
                let (status, body) = match read_request(&mut stream)
                    .and_then(|(head, body)| check_request(&head, &body, &expected))
                {
                    Ok(Request::Page(notice)) => {
                        if on_page(notice.clone()) {
                            if let Ok(mut slot) = shared.lock() {
                                *slot = Some(notice);
                            }
                            (204, String::new())
                        } else {
                            // `open` reads anything but 2xx as "the app did not take the page".
                            (409, String::new())
                        }
                    }
                    Ok(Request::Session) => {
                        let now = shared.lock().ok().and_then(|slot| slot.clone());
                        (200, serde_json::to_string(&now).unwrap_or_else(|_| "null".to_string()))
                    }
                    Err(Refused(status, _)) => (status, String::new()),
                };
                respond(&mut stream, status, &body);
            }
        });
        Ok(AnnounceServer { port, token, current })
    }

    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}/page", self.port)
    }

    pub fn token(&self) -> &str {
        &self.token
    }

    /// The page most recently announced, if any.
    pub fn current(&self) -> Option<PageNotice> {
        self.current.lock().ok().and_then(|slot| slot.clone())
    }

    /// Forget the page most recently announced, so the next agent's `open`
    /// starts a session of its own instead of joining that one. New Session
    /// does this: a fresh agent's session meter starts over with it.
    pub fn forget_current(&self) {
        if let Ok(mut slot) = self.current.lock() {
            *slot = None;
        }
    }

    /// What goes on the agent's process so its `console.mjs open` shows pages
    /// here. Every value belongs to this window. `embed_origin` is the origin of
    /// the app page, so a console the agent starts allows being framed by it.
    pub fn agent_env(&self, embed_origin: &str, app_version: &str) -> Vec<(String, String)> {
        vec![
            ("PLAN2CODE_IN_APP".to_string(), "1".to_string()),
            ("PLAN2CODE_APP_VERSION".to_string(), app_version.to_string()),
            ("PLAN2CODE_EMBED_ORIGIN".to_string(), embed_origin.to_string()),
            ("PLAN2CODE_APP_ANNOUNCE".to_string(), self.url()),
            ("PLAN2CODE_APP_TOKEN".to_string(), self.token.clone()),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc::channel;
    use std::sync::Mutex;

    fn request(token: &str, body: &str) -> (String, Vec<u8>) {
        (
            format!("POST /page HTTP/1.1\r\nHost: 127.0.0.1\r\nx-plan2code-token: {token}\r\ncontent-length: {}", body.len()),
            body.as_bytes().to_vec(),
        )
    }

    const GOOD: &str = r#"{"url":"http://127.0.0.1:5000/s/abc/","sid":"s1","workflow":"plan"}"#;

    #[test]
    fn accepts_a_good_notice() {
        let (head, body) = request("t", GOOD);
        let Ok(Request::Page(notice)) = check_request(&head, &body, "t") else { panic!("not accepted") };
        assert_eq!((notice.sid.as_str(), notice.workflow.as_str()), ("s1", "plan"));
        let get = "GET /session HTTP/1.1\r\nx-plan2code-token: t";
        assert_eq!(check_request(get, b"", "t"), Ok(Request::Session));
        assert_eq!(check_request(get, b"", "other"), Err(Refused(403, "bad token")));
    }

    #[test]
    fn refuses_a_wrong_or_missing_token() {
        let (head, body) = request("nope", GOOD);
        assert_eq!(check_request(&head, &body, "t"), Err(Refused(403, "bad token")));
        let head = "POST /page HTTP/1.1\r\nHost: x";
        assert_eq!(check_request(head, GOOD.as_bytes(), "t"), Err(Refused(403, "bad token")));
    }

    #[test]
    fn refuses_a_browser_origin_and_other_routes() {
        let (head, body) = request("t", GOOD);
        let with_origin = format!("{head}\r\nOrigin: http://evil.example");
        assert_eq!(check_request(&with_origin, &body, "t"), Err(Refused(403, "not from a page")));
        let other = head.replace("/page", "/other");
        assert_eq!(check_request(&other, &body, "t"), Err(Refused(404, "not found")));
        let get = head.replace("POST", "GET");
        assert_eq!(check_request(&get, &body, "t"), Err(Refused(404, "not found")), "GET is for /session only");
    }

    #[test]
    fn refuses_a_bad_body_and_a_url_that_is_not_the_console() {
        let (head, _) = request("t", "x");
        assert_eq!(check_request(&head, b"not json", "t"), Err(Refused(400, "bad body")));
        for url in ["http://example.com/s/abc/", "https://127.0.0.1:5/s/a/", "http://127.0.0.1:5/other", "javascript:alert(1)", "http://127.0.0.1:0/s/a/"] {
            let body = format!(r#"{{"url":"{url}","sid":"s","workflow":"w"}}"#);
            assert_eq!(check_request(&head, body.as_bytes(), "t"), Err(Refused(400, "bad page")), "{url}");
        }
    }

    #[test]
    fn tokens_differ_between_windows() {
        assert_ne!(random_token(), random_token());
        assert_eq!(random_token().len(), 32);
        assert!(same_token("abc", "abc") && !same_token("abc", "abd") && !same_token("abc", "ab"));
    }

    fn post(port: u16, token: &str, body: &str) -> u16 {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        write!(
            stream,
            "POST /page HTTP/1.1\r\nHost: 127.0.0.1\r\nx-plan2code-token: {token}\r\ncontent-length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .unwrap();
        let mut answer = String::new();
        stream.read_to_string(&mut answer).unwrap();
        answer.split(' ').nth(1).unwrap().parse().unwrap()
    }

    #[test]
    fn two_windows_hear_only_their_own_agent() {
        let (tx_a, rx_a) = channel();
        let (tx_b, rx_b) = channel();
        let (tx_a, tx_b) = (Mutex::new(tx_a), Mutex::new(tx_b));
        let a = AnnounceServer::start(Arc::new(move |n| tx_a.lock().unwrap().send(n).is_ok())).unwrap();
        let b = AnnounceServer::start(Arc::new(move |n| tx_b.lock().unwrap().send(n).is_ok())).unwrap();
        assert_ne!(a.url(), b.url());
        let port = |s: &AnnounceServer| s.url().rsplit_once(':').unwrap().1.trim_end_matches("/page").parse::<u16>().unwrap();

        assert_eq!(post(port(&a), a.token(), GOOD), 204);
        assert_eq!(post(port(&b), a.token(), GOOD), 403, "window A's token does nothing in window B");
        assert_eq!(rx_a.recv_timeout(Duration::from_secs(3)).unwrap().sid, "s1");
        assert!(rx_b.recv_timeout(Duration::from_millis(300)).is_err());
    }

    #[test]
    fn agent_env_names_this_windows_values() {
        let server = AnnounceServer::start(Arc::new(|_| true)).unwrap();
        let env = server.agent_env("http://127.0.0.1:1430", "3.0.0");
        let get = |key: &str| env.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone());
        assert_eq!(get("PLAN2CODE_IN_APP").as_deref(), Some("1"));
        assert_eq!(get("PLAN2CODE_EMBED_ORIGIN").as_deref(), Some("http://127.0.0.1:1430"));
        assert_eq!(get("PLAN2CODE_APP_VERSION").as_deref(), Some("3.0.0"));
        assert_eq!(get("PLAN2CODE_APP_ANNOUNCE"), Some(server.url()));
        assert_eq!(get("PLAN2CODE_APP_TOKEN").as_deref(), Some(server.token()));
        assert_eq!(get("PLAN2CODE_CONSOLE_SID"), None, "the window's session is asked for, not fixed at start");
    }

    #[test]
    fn the_current_session_is_what_was_announced_last() {
        let server = AnnounceServer::start(Arc::new(|_| true)).unwrap();
        let port: u16 = server.url().rsplit_once(':').unwrap().1.trim_end_matches("/page").parse().unwrap();
        let ask = |token: &str| {
            let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
            write!(stream, "GET /session HTTP/1.1\r\nHost: 127.0.0.1\r\nx-plan2code-token: {token}\r\nConnection: close\r\n\r\n").unwrap();
            let mut answer = String::new();
            stream.read_to_string(&mut answer).unwrap();
            answer
        };
        assert!(ask(server.token()).ends_with("null"), "nothing announced yet");
        assert_eq!(post(port, server.token(), GOOD), 204);
        assert!(ask(server.token()).contains(r#""sid":"s1""#));
        assert!(ask("wrong").starts_with("HTTP/1.1 403"));
        assert_eq!(server.current().unwrap().workflow, "plan");
        server.forget_current();
        assert!(ask(server.token()).ends_with("null"), "forgotten: the next open starts its own session");
        assert_eq!(server.current(), None);
    }

    #[test]
    fn a_page_the_window_refuses_is_not_its_session() {
        // A test's throwaway console: remembered, it would steer the next
        // agent `open` away from the window's real session.
        let server = AnnounceServer::start(Arc::new(|_| false)).unwrap();
        let port: u16 = server.url().rsplit_once(':').unwrap().1.trim_end_matches("/page").parse().unwrap();
        assert_eq!(post(port, server.token(), GOOD), 409, "open hears that the app did not take it");
        assert_eq!(server.current(), None);
    }
}
