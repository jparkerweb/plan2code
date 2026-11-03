//! The launch card's model menu for a built-in agent: the same list the
//! `plan2code` launcher's model question offers (`listModels` in
//! `src/launcher/plan2code.js`). The shipped `bin/models.json` (refreshed by
//! every install, and baked in here as the fallback) comes first, then the
//! user's own additions in `~/.plan2code/models.json` (written by User
//! Preferences) whose ids the shipped list does not already have. Custom
//! agents never come through here: their menu is their own `models` in
//! agents.json.

use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

use crate::agents::CustomModel;

/// The shipped model menu, baked in beside agents.json so the launch card
/// still offers a list when the installed `bin/models.json` cannot be read.
const BAKED_MODELS: &str = include_str!("../../../src/launcher/models.json");

/// The shipped `bin/models.json`: `PLAN2CODE_MODELS_DIR/bin/models.json` when
/// the tests relocate the models home, else the launcher's own
/// `~/.plan2code/bin/models.json` (`PLAN2CODE_LAUNCHER_DIR` still honored).
fn shipped_models_file() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("PLAN2CODE_MODELS_DIR") {
        return Some(PathBuf::from(dir).join("bin").join("models.json"));
    }
    crate::versions::launcher_dir().map(|dir| dir.join("models.json"))
}

/// The user's `models.json`: `PLAN2CODE_MODELS_DIR/models.json` when set, else
/// `~/.plan2code/models.json` (the same file the console's User Preferences
/// writes, `USER_MODELS_FILE` in files.mjs).
fn user_models_file() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("PLAN2CODE_MODELS_DIR") {
        return Some(PathBuf::from(dir).join("models.json"));
    }
    Some(std::env::home_dir()?.join(".plan2code").join("models.json"))
}

/// `[{ id, label }]` from a parsed models file for one agent; anything
/// malformed is skipped (`modelEntries` in plan2code.js: an entry needs a
/// non-empty string `id` and a string `label`; a blank label is no label).
fn model_entries(file: &Value, cli_id: &str) -> Vec<CustomModel> {
    let mut models = Vec::new();
    let Some(items) = file.get(cli_id).and_then(Value::as_array) else {
        return models;
    };
    for item in items {
        let Some(id) = item.get("id").and_then(Value::as_str) else {
            continue;
        };
        let id = id.trim();
        if id.is_empty() {
            continue;
        }
        let Some(label) = item.get("label").and_then(Value::as_str) else {
            continue;
        };
        let label = label.trim();
        models.push(CustomModel {
            id: id.to_string(),
            label: (!label.is_empty()).then(|| label.to_string()),
        });
    }
    models
}

/// The shipped list first, then the user's additions the shipped list does not
/// already have (`mergeModels` in plan2code.js).
fn merge_models(shipped: Vec<CustomModel>, user: Vec<CustomModel>) -> Vec<CustomModel> {
    let mut seen: HashSet<String> = shipped.iter().map(|m| m.id.clone()).collect();
    let mut out = shipped;
    out.extend(user.into_iter().filter(|m| seen.insert(m.id.clone())));
    out
}

fn read_json(file: &Path) -> Option<Value> {
    serde_json::from_str(&std::fs::read_to_string(file).ok()?).ok()
}

/// One built-in's menu from explicit file paths, so tests never touch the real
/// home. A shipped file that is missing or will not parse falls back to the
/// baked list; a user file the same way means no additions.
fn models_for(
    cli_id: &str,
    shipped_file: Option<&Path>,
    user_file: Option<&Path>,
) -> Vec<CustomModel> {
    let shipped = shipped_file
        .and_then(read_json)
        .or_else(|| serde_json::from_str(BAKED_MODELS).ok())
        .unwrap_or(Value::Null);
    let user = user_file.and_then(read_json).unwrap_or(Value::Null);
    merge_models(
        model_entries(&shipped, cli_id),
        model_entries(&user, cli_id),
    )
}

/// The launch card's model menu for the built-in `cli_id` (empty when it has
/// none, like the launcher's skipped question; `models` on a custom agent's
/// agents.json entry covers customs).
pub fn models_for_builtin(cli_id: &str) -> Vec<CustomModel> {
    models_for(
        cli_id,
        shipped_models_file().as_deref(),
        user_models_file().as_deref(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn model(id: &str, label: Option<&str>) -> CustomModel {
        CustomModel {
            id: id.to_string(),
            label: label.map(str::to_string),
        }
    }

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("models-test-{}-{tag}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("bin")).unwrap();
        dir
    }

    #[test]
    fn model_entries_keeps_only_id_and_label_pairs() {
        let file = json!({
            "_note": "not a list",
            "claude": [
                { "id": "sonnet", "label": "Sonnet - latest" },
                { "id": "opus" },
                { "id": " ", "label": "blank id" },
                { "label": "no id" },
                "not an object",
                { "id": "haiku", "label": "  " },
                { "id": "fable", "label": "Fable" }
            ]
        });
        assert_eq!(
            model_entries(&file, "claude"),
            vec![
                model("sonnet", Some("Sonnet - latest")),
                model("haiku", None),
                model("fable", Some("Fable")),
            ]
        );
        assert!(model_entries(&file, "codex").is_empty());
        assert!(model_entries(&Value::Null, "claude").is_empty());
    }

    #[test]
    fn merge_models_appends_only_the_user_ids_the_shipped_list_lacks() {
        let shipped = vec![model("a", Some("A")), model("b", Some("B"))];
        let user = vec![
            model("b", Some("user's B")),
            model("c", Some("C")),
            model("c", Some("dupe")),
        ];
        assert_eq!(
            merge_models(shipped, user),
            vec![
                model("a", Some("A")),
                model("b", Some("B")),
                model("c", Some("C"))
            ]
        );
    }

    #[test]
    fn models_for_merges_the_shipped_and_user_files() {
        let dir = temp_dir("merge");
        std::fs::write(
            dir.join("bin").join("models.json"),
            r#"{ "claude": [{ "id": "sonnet", "label": "Sonnet" }] }"#,
        )
        .unwrap();
        std::fs::write(
            dir.join("models.json"),
            r#"{ "claude": [
                { "id": "sonnet", "label": "ignored dupe" },
                { "id": "my-new", "label": "Mine" }
            ] }"#,
        )
        .unwrap();
        assert_eq!(
            models_for(
                "claude",
                Some(&dir.join("bin").join("models.json")),
                Some(&dir.join("models.json"))
            ),
            vec![
                model("sonnet", Some("Sonnet")),
                model("my-new", Some("Mine"))
            ]
        );
    }

    #[test]
    fn models_for_falls_back_to_the_baked_list() {
        // No shipped file at all (or one that will not parse): the baked copy
        // of src/launcher/models.json still offers its list.
        let dir = temp_dir("baked");
        let missing = dir.join("bin").join("models.json");
        let baked = models_for("claude", Some(&missing), Some(&missing));
        assert_eq!(baked.first().map(|m| m.id.as_str()), Some("default"));
        assert!(baked.len() > 1);
        std::fs::write(&missing, "{ nope").unwrap();
        assert!(models_for("claude", Some(&missing), Some(&missing)).len() > 1);
        assert!(models_for("codex", Some(&missing), Some(&missing)).is_empty());
    }

    #[test]
    fn models_for_ignores_an_unreadable_user_file() {
        let dir = temp_dir("user");
        let shipped = dir.join("bin").join("models.json");
        let user = dir.join("models.json");
        std::fs::write(
            &shipped,
            r#"{ "claude": [{ "id": "sonnet", "label": "S" }] }"#,
        )
        .unwrap();
        std::fs::write(&user, "{ nope").unwrap();
        assert_eq!(
            models_for("claude", Some(&shipped), Some(&user)),
            vec![model("sonnet", Some("S"))]
        );
        assert_eq!(
            models_for("claude", Some(&shipped), None),
            vec![model("sonnet", Some("S"))]
        );
    }
}
