//! The app's own settings file, `~/.plan2code/app.json`. It holds what only the
//! app remembers (today: the agent last picked in the bar). The console's
//! folders under `~/.plan2code/console/` are never written to from here.

use std::path::{Path, PathBuf};

const LAST_AGENT_KEY: &str = "lastAgent";
const TERM_DOCK_KEY: &str = "termDock";
const TERM_FRACTION_KEY: &str = "termFraction";
const TERM_COLLAPSED_KEY: &str = "termCollapsed";
const FIRST_RUN_DONE_KEY: &str = "firstRunDone";
const TASKBAR_SIGNAL_KEY: &str = "taskbarSignal";

/// The terminal pane's remembered shape: which edge it docks to, how much of
/// the window it takes (a fraction, not collapsed or maximized), and whether
/// it was left collapsed.
#[derive(Clone, Debug, PartialEq, serde::Serialize)]
pub struct TermPanelSettings {
    pub dock: String,
    pub fraction: f64,
    pub collapsed: bool,
}

pub const DEFAULT_TERM_DOCK: &str = "bottom";
pub const DEFAULT_TERM_FRACTION: f64 = 0.25;
const TERM_FRACTION_MIN: f64 = 0.05;
const TERM_FRACTION_MAX: f64 = 0.9;

pub fn settings_file() -> Option<PathBuf> {
    Some(std::env::home_dir()?.join(".plan2code").join("app.json"))
}

fn read(file: &Path) -> serde_json::Map<String, serde_json::Value> {
    std::fs::read_to_string(file)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

/// The agent id saved in `file` (built-in or custom). Whether it still
/// resolves is the caller's check (`agents::find_agent`).
pub fn load_last_agent(file: &Path) -> Option<String> {
    Some(read(file).get(LAST_AGENT_KEY)?.as_str()?.to_string()).filter(|id| !id.is_empty())
}

/// Save the pick, keeping any other key the file holds.
pub fn save_last_agent(file: &Path, id: &str) -> Result<(), String> {
    let mut settings = read(file);
    settings.insert(
        LAST_AGENT_KEY.to_string(),
        serde_json::Value::String(id.to_string()),
    );
    write(file, settings)
}

/// The terminal pane's shape, from the file or the defaults. A dock other
/// than `bottom` or `right`, or a fraction outside its range, is the default.
pub fn load_term_panel(file: &Path) -> TermPanelSettings {
    let settings = read(file);
    let dock = settings
        .get(TERM_DOCK_KEY)
        .and_then(|v| v.as_str())
        .filter(|d| *d == "bottom" || *d == "right")
        .unwrap_or(DEFAULT_TERM_DOCK)
        .to_string();
    let fraction = settings
        .get(TERM_FRACTION_KEY)
        .and_then(|v| v.as_f64())
        .filter(|f| (TERM_FRACTION_MIN..=TERM_FRACTION_MAX).contains(f))
        .unwrap_or(DEFAULT_TERM_FRACTION);
    let collapsed = settings
        .get(TERM_COLLAPSED_KEY)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    TermPanelSettings {
        dock,
        fraction,
        collapsed,
    }
}

/// Save the terminal pane's shape, keeping any other key the file holds. An
/// invalid dock or an out-of-range fraction is rejected rather than saved.
pub fn save_term_panel(
    file: &Path,
    dock: &str,
    fraction: f64,
    collapsed: bool,
) -> Result<(), String> {
    if dock != "bottom" && dock != "right" {
        return Err(format!("unknown dock: {dock}"));
    }
    if !(TERM_FRACTION_MIN..=TERM_FRACTION_MAX).contains(&fraction) {
        return Err(format!("fraction out of range: {fraction}"));
    }
    let mut settings = read(file);
    settings.insert(
        TERM_DOCK_KEY.to_string(),
        serde_json::Value::String(dock.to_string()),
    );
    settings.insert(
        TERM_FRACTION_KEY.to_string(),
        serde_json::Number::from_f64(fraction)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
    );
    settings.insert(
        TERM_COLLAPSED_KEY.to_string(),
        serde_json::Value::Bool(collapsed),
    );
    write(file, settings)
}

/// Whether the first-run checklist has already passed once. Once it has,
/// later launches go straight to the launch card (Task 9.4).
pub fn load_first_run_done(file: &Path) -> bool {
    read(file)
        .get(FIRST_RUN_DONE_KEY)
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

/// Remember that the checklist passed, keeping any other key the file holds.
pub fn save_first_run_done(file: &Path) -> Result<(), String> {
    let mut settings = read(file);
    settings.insert(
        FIRST_RUN_DONE_KEY.to_string(),
        serde_json::Value::Bool(true),
    );
    write(file, settings)
}

/// Whether the taskbar entry shows when Plan2Code needs the person (the
/// Desktop app switch in the console's User Preferences). On unless the file
/// says `false`; anything but a boolean reads as on.
pub fn load_taskbar_signal(file: &Path) -> bool {
    read(file)
        .get(TASKBAR_SIGNAL_KEY)
        .and_then(|v| v.as_bool())
        .unwrap_or(true)
}

/// Save the switch, keeping any other key the file holds.
pub fn save_taskbar_signal(file: &Path, on: bool) -> Result<(), String> {
    let mut settings = read(file);
    settings.insert(TASKBAR_SIGNAL_KEY.to_string(), serde_json::Value::Bool(on));
    write(file, settings)
}

fn write(file: &Path, settings: serde_json::Map<String, serde_json::Value>) -> Result<(), String> {
    if let Some(parent) = file.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&serde_json::Value::Object(settings))
        .map_err(|e| e.to_string())?;
    std::fs::write(file, json).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_file(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("plan2code-settings-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir.join("app.json")
    }

    #[test]
    fn a_missing_file_has_no_choice() {
        assert_eq!(load_last_agent(&temp_file("missing")), None);
    }

    #[test]
    fn the_choice_round_trips_and_other_keys_survive() {
        let file = temp_file("round-trip");
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, r#"{"other": 1}"#).unwrap();
        save_last_agent(&file, "devin").unwrap();
        assert_eq!(load_last_agent(&file), Some("devin".to_string()));
        save_last_agent(&file, "goose").unwrap();
        assert_eq!(
            load_last_agent(&file),
            Some("goose".to_string()),
            "a custom id round-trips"
        );
        assert!(std::fs::read_to_string(&file)
            .unwrap()
            .contains("\"other\""));
        let _ = std::fs::remove_dir_all(file.parent().unwrap());
    }

    #[test]
    fn an_id_is_returned_as_stored_and_the_caller_checks_it() {
        let file = temp_file("unknown");
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, r#"{"lastAgent": "nope"}"#).unwrap();
        assert_eq!(load_last_agent(&file), Some("nope".to_string()));
        assert!(crate::agents::find_agent_in("nope", None).is_none());
        let _ = std::fs::remove_dir_all(file.parent().unwrap());
    }

    #[test]
    fn the_term_panel_defaults_to_bottom_at_a_quarter() {
        let want = TermPanelSettings {
            dock: "bottom".into(),
            fraction: 0.25,
            collapsed: false,
        };
        assert_eq!(load_term_panel(&temp_file("term-missing")), want);
    }

    #[test]
    fn the_term_panel_round_trips_and_other_keys_survive() {
        let file = temp_file("term-round-trip");
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, r#"{"other": 1}"#).unwrap();
        save_term_panel(&file, "right", 0.4, true).unwrap();
        assert_eq!(
            load_term_panel(&file),
            TermPanelSettings {
                dock: "right".into(),
                fraction: 0.4,
                collapsed: true
            }
        );
        assert!(std::fs::read_to_string(&file)
            .unwrap()
            .contains("\"other\""));
        let _ = std::fs::remove_dir_all(file.parent().unwrap());
    }

    #[test]
    fn an_unknown_dock_or_an_out_of_range_fraction_is_refused() {
        let file = temp_file("term-bad-save");
        assert!(save_term_panel(&file, "top", 0.3, false).is_err());
        assert!(save_term_panel(&file, "bottom", 0.0, false).is_err());
        assert!(save_term_panel(&file, "bottom", 1.0, false).is_err());
        assert!(!file.exists());
    }

    #[test]
    fn first_run_is_not_done_until_it_is_saved() {
        let file = temp_file("first-run");
        assert!(!load_first_run_done(&file));
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, r#"{"other": 1}"#).unwrap();
        save_first_run_done(&file).unwrap();
        assert!(load_first_run_done(&file));
        assert!(std::fs::read_to_string(&file)
            .unwrap()
            .contains("\"other\""));
        let _ = std::fs::remove_dir_all(file.parent().unwrap());
    }

    #[test]
    fn the_taskbar_signal_is_on_until_it_is_switched_off() {
        assert!(load_taskbar_signal(&temp_file("taskbar-missing")));
        let file = temp_file("taskbar");
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, r#"{"other": 1, "taskbarSignal": "no"}"#).unwrap();
        assert!(load_taskbar_signal(&file), "not a boolean reads as on");
        save_taskbar_signal(&file, false).unwrap();
        assert!(!load_taskbar_signal(&file));
        save_taskbar_signal(&file, true).unwrap();
        assert!(load_taskbar_signal(&file));
        assert!(std::fs::read_to_string(&file)
            .unwrap()
            .contains("\"other\""));
        let _ = std::fs::remove_dir_all(file.parent().unwrap());
    }

    #[test]
    fn a_bad_dock_or_out_of_range_fraction_on_disk_reads_as_the_default() {
        let file = temp_file("term-bad-load");
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, r#"{"termDock": "top", "termFraction": 5}"#).unwrap();
        let loaded = load_term_panel(&file);
        assert_eq!(loaded.dock, "bottom");
        assert_eq!(loaded.fraction, 0.25);
        let _ = std::fs::remove_dir_all(file.parent().unwrap());
    }
}
