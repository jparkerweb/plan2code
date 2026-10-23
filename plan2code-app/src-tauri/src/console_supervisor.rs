//! The Node web console as a supervised child: `console.mjs open` starts a
//! detached server and prints the session's JSON, `stop` ends it, and a plain
//! GET on the session URL is the health check. Knows nothing about Tauri.

use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use serde::Serialize;

/// How long a health check waits for the console before calling it dead. The
/// server is on loopback, so anything longer is a hang, not a slow network.
const HEALTH_TIMEOUT: Duration = Duration::from_secs(3);

/// A running console session, as `console.mjs open` reports it.
#[derive(Clone, Serialize)]
pub struct ConsoleSession {
    pub sid: String,
    pub url: String,
    pub pid: u32,
    pub port: u16,
    /// The console says it can be framed by the app. An older one does not
    /// print this, and its page would be refused in the frame.
    pub embed: bool,
}

/// What the person is told when the installed console is too old for the app.
pub const OLD_CONSOLE: &str =
    "The installed Plan2Code console is too old to show inside the app. Press Update skills, then try again.";

/// One supervised console for one project folder.
pub struct ConsoleSupervisor {
    console_dir: PathBuf,
    project_dir: PathBuf,
    embed_origin: String,
    session: ConsoleSession,
    stopped: bool,
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

/// A `node console.mjs ...` call with no console window on Windows: the app is
/// a GUI program, so a bare Command would flash one open per call.
fn node_command(console_dir: &Path) -> Command {
    let mut command = Command::new("node");
    // A Dock or Start-menu launch often lacks nvm, Homebrew or Volta's
    // directories (Task 9.9): run `node` with the PATH that finds it anyway.
    command.env("PATH", crate::node_check::resolved_path());
    command.arg(console_dir.join("console.mjs"));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    command
}

/// The origin the app's own page has, which is what the console's embed mode
/// must be told to allow as the frame parent. Tauri serves the page on
/// `http://tauri.localhost` on Windows (and Android) and `tauri://localhost`
/// on macOS and Linux.
pub fn app_origin() -> &'static str {
    if cfg!(windows) {
        "http://tauri.localhost"
    } else {
        "tauri://localhost"
    }
}

/// The origin (`scheme://host[:port]`) of the app page's own URL, which is what
/// the console's embed mode must allow as the frame parent. In a release build
/// that is `app_origin()`, but `tauri dev` serves the page from its own dev
/// server on a loopback port, so the real URL is asked rather than assumed.
pub fn origin_of(url: &str) -> Option<String> {
    let (scheme, rest) = url.split_once("://")?;
    let authority = rest.split(['/', '?', '#']).next()?;
    if authority.is_empty() || !matches!(scheme, "http" | "https" | "tauri") {
        return None;
    }
    Some(format!("{scheme}://{authority}"))
}

/// Where the installed console lives: an explicit override first (tests and
/// dev), then the file the console keeps for the app, then the skill install.
pub fn find_console_dir() -> Result<PathBuf, String> {
    let has_console = |dir: &Path| dir.join("console.mjs").is_file();
    if let Ok(dir) = std::env::var("PLAN2CODE_CONSOLE_DIR") {
        let dir = PathBuf::from(dir);
        if has_console(&dir) {
            return Ok(dir);
        }
    }
    // The console writes its pointer under PLAN2CODE_CONSOLE_HOME when that
    // relocates it, else under ~/.plan2code/console.
    let pointer = match std::env::var("PLAN2CODE_CONSOLE_HOME") {
        Ok(home) => PathBuf::from(home).join("console-dir"),
        Err(_) => {
            let home = std::env::home_dir().ok_or("no home folder found")?;
            home.join(".plan2code").join("console").join("console-dir")
        }
    };
    if let Ok(text) = std::fs::read_to_string(&pointer) {
        let dir = PathBuf::from(text.trim());
        if has_console(&dir) {
            return Ok(dir);
        }
    }
    let dir = std::env::home_dir()
        .ok_or("no home folder found")?
        .join(".agents")
        .join("skills")
        .join("plan2code")
        .join("references")
        .join("web-console");
    if has_console(&dir) {
        return Ok(dir);
    }
    Err(format!(
        "the web console is not installed (looked in $PLAN2CODE_CONSOLE_DIR, {} and {})",
        pointer.display(),
        dir.display()
    ))
}

/// Parse the one JSON object `console.mjs open` prints on stdout.
fn parse_open_output(stdout: &[u8]) -> Result<ConsoleSession, String> {
    let text = String::from_utf8_lossy(stdout);
    let line = text
        .lines()
        .rev()
        .find(|l| l.trim_start().starts_with('{'))
        .ok_or_else(|| format!("console open printed no JSON: {}", text.trim()))?;
    let value: serde_json::Value = serde_json::from_str(line.trim()).map_err(err)?;
    let get = |key: &str| value.get(key).and_then(|v| v.as_str().map(String::from));
    let num = |key: &str| value.get(key).and_then(|v| v.as_u64());
    Ok(ConsoleSession {
        sid: get("sid").ok_or("console open: no sid in output")?,
        url: get("url").ok_or("console open: no url in output")?,
        pid: num("pid").ok_or("console open: no pid in output")? as u32,
        port: num("port").ok_or("console open: no port in output")? as u16,
        embed: num("embed").is_some_and(|n| n >= 1),
    })
}

/// Split `http://<host>:<port><path>` into its parts; the console only ever
/// listens on loopback http.
fn split_url(url: &str) -> Result<(String, u16, String), String> {
    let rest = url.strip_prefix("http://").ok_or_else(|| format!("not an http url: {url}"))?;
    let (authority, path) = match rest.split_once('/') {
        Some((a, p)) => (a, format!("/{p}")),
        None => (rest, "/".to_string()),
    };
    let (host, port) = authority
        .rsplit_once(':')
        .ok_or_else(|| format!("no port in url: {url}"))?;
    let port: u16 = port.parse().map_err(|_| format!("bad port in url: {url}"))?;
    Ok((host.to_string(), port, path))
}

impl ConsoleSupervisor {
    /// Find the installed console, run `open --workflow dashboard --no-open` in
    /// the project folder with `PLAN2CODE_EMBED_ORIGIN` set, and keep the
    /// session it prints.
    pub fn start(project_dir: PathBuf, embed_origin: String) -> Result<ConsoleSupervisor, String> {
        let console_dir = find_console_dir()?;
        let session = Self::open_session(&console_dir, &project_dir, &embed_origin, None)?;
        Ok(ConsoleSupervisor { console_dir, project_dir, embed_origin, session, stopped: false })
    }

    /// `open` for the dashboard, or, with `resume`, the same session again on
    /// a new server (so the page and its place in a skill survive a dead server).
    /// A console the agent's `open` started and announced: this supervisor
    /// now owns its health and its stop, though it did not start it.
    pub fn adopt(
        project_dir: PathBuf,
        embed_origin: String,
        url: &str,
        sid: &str,
    ) -> Result<ConsoleSupervisor, String> {
        let console_dir = find_console_dir()?;
        let (_, port, _) = split_url(url)?;
        let session = ConsoleSession { sid: sid.to_string(), url: url.to_string(), pid: 0, port, embed: true };
        Ok(ConsoleSupervisor { console_dir, project_dir, embed_origin, session, stopped: false })
    }

    fn open_session(
        console_dir: &Path,
        project_dir: &Path,
        embed_origin: &str,
        resume: Option<&str>,
    ) -> Result<ConsoleSession, String> {
        let mut command = node_command(console_dir);
        command.arg("open");
        match resume {
            Some(sid) => command.args(["--resume", sid, "--no-open"]),
            None => command.args(["--workflow", "dashboard", "--no-open"]),
        };
        let output = command
            .current_dir(project_dir)
            .env("PLAN2CODE_EMBED_ORIGIN", embed_origin)
            .output()
            .map_err(err)?;
        if !output.status.success() {
            return Err(format!(
                "console open failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        let session = parse_open_output(&output.stdout)?;
        if !session.embed {
            // Do not leave an old console running that the frame cannot show.
            let _ = node_command(console_dir)
                .args(["stop", "--session", &session.sid])
                .current_dir(project_dir)
                .output();
            return Err(OLD_CONSOLE.to_string());
        }
        Ok(session)
    }

    pub fn session(&self) -> &ConsoleSession {
        &self.session
    }

    /// The console moved to another address or session (an announced page that
    /// is not the one this supervisor opened): health, stop and the restart
    /// brief follow it from now on.
    pub fn follow(&mut self, url: &str, sid: &str) {
        if self.session.url == url && self.session.sid == sid {
            return;
        }
        if let Ok((_, port, _)) = split_url(url) {
            self.session.port = port;
        }
        self.session.url = url.to_string();
        self.session.sid = sid.to_string();
    }

    /// Was `stop()` called on this supervisor.
    pub fn stopped(&self) -> bool {
        self.stopped
    }

    /// A GET on the session URL: any HTTP answer means the server is alive.
    pub fn health(&self) -> bool {
        if self.stopped {
            return false;
        }
        let Ok((host, port, path)) = split_url(&self.session.url) else {
            return false;
        };
        let Some(addr) = (host.as_str(), port).to_socket_addrs().ok().and_then(|mut a| a.next())
        else {
            return false;
        };
        let Ok(mut stream) = TcpStream::connect_timeout(&addr, HEALTH_TIMEOUT) else {
            return false;
        };
        let _ = stream.set_read_timeout(Some(HEALTH_TIMEOUT));
        let _ = stream.set_write_timeout(Some(HEALTH_TIMEOUT));
        let request = format!("GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n");
        if stream.write_all(request.as_bytes()).is_err() {
            return false;
        }
        let mut status = [0u8; 64];
        match stream.read(&mut status) {
            Ok(n) => String::from_utf8_lossy(&status[..n]).starts_with("HTTP/"),
            Err(_) => false,
        }
    }

    /// Health check plus a fresh `open` when the server is gone. Returns true
    /// when a new session was started. Never loops: the caller (the bar) asks
    /// and shows the outcome.
    pub fn restart_if_dead(&mut self) -> Result<bool, String> {
        if self.stopped || self.health() {
            return Ok(false);
        }
        // The same session first, so the page and a skill's place in it survive;
        // a session that cannot be resumed (gone from disk) starts a new one.
        let sid = self.session.sid.clone();
        self.session = Self::open_session(&self.console_dir, &self.project_dir, &self.embed_origin, Some(&sid))
            .or_else(|_| Self::open_session(&self.console_dir, &self.project_dir, &self.embed_origin, None))?;
        self.stopped = false;
        Ok(true)
    }

    /// `console.mjs stop --session <sid>`: the console's own orderly shutdown.
    pub fn stop(&mut self) -> Result<(), String> {
        if self.stopped {
            return Ok(());
        }
        let output = node_command(&self.console_dir)
            .args(["stop", "--session", &self.session.sid])
            .current_dir(&self.project_dir)
            .output()
            .map_err(err)?;
        self.stopped = true;
        if !output.status.success() {
            return Err(format!(
                "console stop failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        Ok(())
    }
}

impl Drop for ConsoleSupervisor {
    /// The app going away takes the console it started with it. `stop` is
    /// idempotent, so a session ended by hand just returns early here.
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_the_session_url() {
        let (host, port, path) = split_url("http://127.0.0.1:51617/s/abc/").unwrap();
        assert_eq!((host.as_str(), port, path.as_str()), ("127.0.0.1", 51617, "/s/abc/"));
        let (_, _, path) = split_url("http://localhost:9").unwrap();
        assert_eq!(path, "/");
        assert!(split_url("https://127.0.0.1:1/x").is_err());
        assert!(split_url("http://127.0.0.1/x").is_err());
    }

    #[test]
    fn origin_comes_from_the_pages_own_url() {
        assert_eq!(origin_of("http://127.0.0.1:1430/index.html").as_deref(), Some("http://127.0.0.1:1430"));
        assert_eq!(origin_of("http://tauri.localhost/").as_deref(), Some("http://tauri.localhost"));
        assert_eq!(origin_of("https://tauri.localhost").as_deref(), Some("https://tauri.localhost"));
        assert_eq!(origin_of("tauri://localhost/index.html?x=1").as_deref(), Some("tauri://localhost"));
        assert_eq!(origin_of("file:///x"), None);
        assert_eq!(origin_of("not a url"), None);
        assert_eq!(origin_of("http:///x"), None);
    }

    #[test]
    fn an_announced_console_is_adopted_with_its_port() {
        // Only needs a console to be installed; skipped where there is none.
        let Ok(dir) = find_console_dir() else { return };
        let _ = dir;
        let mut sup = ConsoleSupervisor::adopt(PathBuf::from("."), "http://tauri.localhost".into(), "http://127.0.0.1:5555/s/t/", "sid-9").unwrap();
        assert_eq!((sup.session().port, sup.session().sid.as_str()), (5555, "sid-9"));
        assert!(sup.session().embed);
        assert!(ConsoleSupervisor::adopt(PathBuf::from("."), String::new(), "https://x/", "s").is_err());
        sup.follow("http://127.0.0.1:6000/s/u/", "sid-10");
        assert_eq!((sup.session().port, sup.session().sid.as_str()), (6000, "sid-10"));
        // Never started a server here: nothing for Drop to stop.
        sup.stopped = true;
    }

    #[test]
    fn parses_open_output() {
        let json = br#"{"ok":true,"sid":"s1","url":"http://127.0.0.1:5/s/t/","port":5,"pid":42,"embed":1}
"#;
        let session = parse_open_output(json).unwrap();
        assert_eq!((session.sid.as_str(), session.port, session.pid), ("s1", 5, 42));
        assert!(session.embed);
        let old = br#"{"ok":true,"sid":"s1","url":"http://127.0.0.1:5/s/t/","port":5,"pid":42}"#;
        assert!(!parse_open_output(old).unwrap().embed, "a console that does not say it embeds is too old");
        assert!(parse_open_output(b"not json\n").is_err());
        assert!(parse_open_output(br#"{"ok":true,"sid":"s1"}"#).is_err());
    }
}
