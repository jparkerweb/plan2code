//! A command running in a pseudo-terminal, so full-screen agent programs see a
//! real terminal. Knows nothing about Tauri: output goes to a callback.

use std::io::{Read, Write};
use std::path::PathBuf;
#[cfg(unix)]
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, MasterPty, PtySize};

/// Output is sent to the page at most once per this long, so a flood of text
/// does not stall the web view.
pub const BATCH_INTERVAL: Duration = Duration::from_millis(16);

/// On macOS and Linux the kill is a hang-up signal, which a program can ignore.
/// This long after it, a command that is still running is killed outright.
#[cfg(unix)]
const HANGUP_GRACE: Duration = Duration::from_secs(2);

/// What to run, where, and how big the terminal starts.
pub struct StartOptions {
    pub program: String,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
    pub cwd: Option<PathBuf>,
    pub cols: u16,
    pub rows: u16,
}

/// A running command in a pseudo-terminal.
pub struct PtyHost {
    master: Mutex<Box<dyn MasterPty + Send>>,
    writer: Mutex<Box<dyn Write + Send>>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    #[cfg(unix)]
    pid: Option<u32>,
    /// Set once the command has been waited for, so a late kill never signals
    /// a process id that may have been given to something else.
    #[cfg(unix)]
    exited: Arc<AtomicBool>,
    /// A Windows Job Object the spawned process was assigned to, so ending
    /// it (`kill`, or this host simply being dropped) ends every process
    /// still in it, not just the one directly spawned: a `cmd /c` npm shim's
    /// real agent process is a child of that child, invisible to a plain
    /// `TerminateProcess`. A raw handle value, not `HANDLE`, so the struct
    /// stays `Send`. `None` when the job could not be made; `kill` then
    /// falls back to ending just the one process, as before.
    #[cfg(windows)]
    job: Option<usize>,
}

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

impl PtyHost {
    /// Start the command. `on_output` gets the output in chunks, at most one per
    /// `BATCH_INTERVAL`, until the command's output ends.
    pub fn start<F>(options: StartOptions, mut on_output: F) -> Result<PtyHost, String>
    where
        F: FnMut(Vec<u8>) + Send + 'static,
    {
        let pair = native_pty_system()
            .openpty(size(options.cols, options.rows))
            .map_err(err)?;

        let mut command = CommandBuilder::new(&options.program);
        command.args(&options.args);
        // What the agent CLIs expect from a terminal that can show color.
        command.env("TERM", "xterm-256color");
        command.env("COLORTERM", "truecolor");
        for (key, value) in &options.env {
            command.env(key, value);
        }
        if let Some(cwd) = &options.cwd {
            command.cwd(cwd);
        }
        let child = pair.slave.spawn_command(command).map_err(err)?;
        // The child holds its own end; keeping ours open would stop the reader
        // from ever seeing the end of the output.
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader().map_err(err)?;
        let writer = pair.master.take_writer().map_err(err)?;
        let killer = child.clone_killer();
        #[cfg(unix)]
        let pid = child.process_id();
        #[cfg(windows)]
        let job = windows_job::assign(child.as_ref());

        // One thread reads as fast as the terminal produces; another gathers
        // what arrived into one send per interval.
        let (tx, rx) = mpsc::channel::<Vec<u8>>();
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        if tx.send(buf[..n].to_vec()).is_err() {
                            break;
                        }
                    }
                }
            }
        });
        thread::spawn(move || {
            // Blocks for the first chunk, then collects until the interval is up.
            while let Ok(first) = rx.recv() {
                let mut batch = first;
                let deadline = Instant::now() + BATCH_INTERVAL;
                loop {
                    let left = deadline.saturating_duration_since(Instant::now());
                    if left.is_zero() {
                        break;
                    }
                    match rx.recv_timeout(left) {
                        Ok(more) => batch.extend_from_slice(&more),
                        Err(mpsc::RecvTimeoutError::Timeout) => break,
                        Err(mpsc::RecvTimeoutError::Disconnected) => {
                            on_output(batch);
                            return;
                        }
                    }
                }
                on_output(batch);
            }
        });

        Ok(PtyHost {
            master: Mutex::new(pair.master),
            writer: Mutex::new(writer),
            child: Arc::new(Mutex::new(child)),
            killer: Mutex::new(killer),
            #[cfg(unix)]
            pid,
            #[cfg(unix)]
            exited: Arc::new(AtomicBool::new(false)),
            #[cfg(windows)]
            job,
        })
    }

    /// Send keystrokes (or pasted text) to the command.
    pub fn write(&self, bytes: &[u8]) -> Result<(), String> {
        let mut writer = self.writer.lock().map_err(err)?;
        writer.write_all(bytes).map_err(err)?;
        writer.flush().map_err(err)
    }

    /// Tell the command the terminal changed size.
    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.master
            .lock()
            .map_err(err)?
            .resize(size(cols, rows))
            .map_err(err)
    }

    /// End the command. Safe to call while `wait` is blocked in another thread.
    pub fn kill(&self) -> Result<(), String> {
        let result = self.killer.lock().map_err(err)?.kill().map_err(err);
        // The job object, when there is one, ends the whole process tree:
        // killing just the directly spawned process (above) leaves a
        // `cmd /c` npm shim's real agent process running.
        #[cfg(windows)]
        if let Some(job) = self.job {
            windows_job::terminate(job);
        }
        // portable-pty 0.9 on Windows has the TerminateProcess result inverted: it
        // returns Err (a stale error) when the kill worked and Ok when it failed, so
        // its answer says nothing there.
        if cfg!(windows) {
            return Ok(());
        }
        // portable-pty only sends SIGHUP on macOS and Linux; follow it with
        // SIGKILL if the command is still there after the grace period.
        #[cfg(unix)]
        if let Some(pid) = self.pid {
            let exited = Arc::clone(&self.exited);
            thread::spawn(move || {
                thread::sleep(HANGUP_GRACE);
                if !exited.load(Ordering::SeqCst) {
                    // SAFETY: plain signal to a process id the command still holds.
                    unsafe { libc::kill(pid as i32, libc::SIGKILL) };
                }
            });
        }
        result
    }

    /// Block until the command ends and return its exit code. A command ended by
    /// a signal reports 1.
    pub fn wait(&self) -> Result<u32, String> {
        self.wait_described().map(|(code, _)| code)
    }

    /// Like `wait`, with the name of the signal that ended the command, when
    /// there was one (macOS and Linux).
    pub fn wait_described(&self) -> Result<(u32, Option<String>), String> {
        let child = Arc::clone(&self.child);
        let mut child = child.lock().map_err(err)?;
        let status = child.wait().map_err(err)?;
        #[cfg(unix)]
        self.exited.store(true, Ordering::SeqCst);
        Ok((status.exit_code(), status.signal().map(str::to_string)))
    }
}

/// Closing the job's last handle ends every process still in it (`job` was
/// made with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`): a safety net for a host
/// dropped without `kill` ever being called, on top of `kill`'s own explicit
/// `TerminateJobObject`.
#[cfg(windows)]
impl Drop for PtyHost {
    fn drop(&mut self) {
        if let Some(job) = self.job {
            windows_job::close(job);
        }
    }
}

/// A Windows Job Object groups a spawned process with every process it goes
/// on to spawn itself (a child joins its parent's job automatically, unless
/// it asks to break away, which `cmd /c` does not), so ending the job ends
/// the whole tree. Nothing here calls back into `PtyHost`.
#[cfg(windows)]
mod windows_job {
    use portable_pty::Child;
    use std::os::windows::io::RawHandle;
    use winapi::shared::minwindef::DWORD;
    use winapi::shared::ntdef::HANDLE;
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::jobapi2::{
        AssignProcessToJobObject, CreateJobObjectW, SetInformationJobObject, TerminateJobObject,
    };
    use winapi::um::winnt::{
        JobObjectExtendedLimitInformation, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    /// Create a job, set it to kill everything in it when its last handle
    /// closes, and assign `child` to it. `None` on any failure (an older
    /// Windows without nested-job support, say): `kill` then falls back to
    /// ending just the one process, as it always did.
    pub fn assign(child: &(dyn Child + Send + Sync)) -> Option<usize> {
        let process: RawHandle = child.as_raw_handle()?;
        unsafe {
            let job = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
            if job.is_null() {
                return None;
            }
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let set = SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &mut info as *mut _ as *mut _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as DWORD,
            );
            if set == 0 || AssignProcessToJobObject(job, process as HANDLE) == 0 {
                CloseHandle(job);
                return None;
            }
            Some(job as usize)
        }
    }

    pub fn terminate(job: usize) {
        unsafe {
            TerminateJobObject(job as HANDLE, 1);
        }
    }

    pub fn close(job: usize) {
        unsafe {
            CloseHandle(job as HANDLE);
        }
    }
}
