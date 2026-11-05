//! The launch card's model menu for a built-in agent: the same list the
//! `plan2code` launcher's model question offers (`listModels` in
//! `src/launcher/plan2code.js`). The shipped `bin/models.json` (refreshed by
//! every install, and baked in here as the fallback) comes first, then the
//! user's own additions in `~/.plan2code/models.json` (written by User
//! Preferences) whose ids the shipped list does not already have. Custom
//! agents never come through here: their menu is their own `models` in
//! agents.json.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashSet};
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

/// The loop's strength words, lightest first (`STRENGTH_ORDER` in
/// src/web-console/strengths.mjs).
pub const STRENGTH_ORDER: [&str; 3] = ["thrifty", "balanced", "best"];

/// One strength's model, and the effort when the agent takes one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrengthRow {
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effort: Option<String>,
}

/// A row as the resolver keeps it, or None when it is not usable: the model
/// must be a string in `models`; an effort survives only when the agent takes
/// one and it is low, medium or high (`validRow` in strengths.mjs).
fn valid_strength_row(
    row: Option<&Value>,
    models: &[String],
    has_effort: bool,
) -> Option<StrengthRow> {
    let row = row?.as_object()?;
    let model = row.get("model")?.as_str()?;
    if !models.iter().any(|m| m == model) {
        return None;
    }
    let effort = row
        .get("effort")
        .and_then(Value::as_str)
        .filter(|e| has_effort && matches!(*e, "low" | "medium" | "high"))
        .map(str::to_string);
    Some(StrengthRow {
        model: model.to_string(),
        effort,
    })
}

/// `{ thrifty?, balanced?, best? }` for one agent from the shipped and the
/// user's `strengths` objects (each keyed by agent id): per word the user's row
/// if it is valid, else the shipped row if it is valid; a word with neither is
/// left out. The twin of `resolveStrengths` in strengths.mjs, held to
/// scripts/fixtures/strength-cases.json.
pub fn resolve_strengths(
    shipped: &Value,
    user: &Value,
    agent: &str,
    models: &[String],
    has_effort: bool,
) -> BTreeMap<String, StrengthRow> {
    let mut resolved = BTreeMap::new();
    for word in STRENGTH_ORDER {
        let row = valid_strength_row(
            user.get(agent).and_then(|a| a.get(word)),
            models,
            has_effort,
        )
        .or_else(|| {
            valid_strength_row(
                shipped.get(agent).and_then(|a| a.get(word)),
                models,
                has_effort,
            )
        });
        if let Some(row) = row {
            resolved.insert(word.to_string(), row);
        }
    }
    resolved
}

/// The first mapped word after `word` in `STRENGTH_ORDER`, else None
/// (`nextStrength` in strengths.mjs).
pub fn next_strength(resolved: &BTreeMap<String, StrengthRow>, word: &str) -> Option<String> {
    let at = STRENGTH_ORDER.iter().position(|w| *w == word)?;
    STRENGTH_ORDER[at + 1..]
        .iter()
        .find(|w| resolved.contains_key(**w))
        .map(|w| w.to_string())
}

/// `strengths_for` from explicit file paths, so tests never touch the real
/// home. The shipped file falls back to the baked list, like `models_for`.
fn strengths_from(
    agent: &str,
    models: &[String],
    has_effort: bool,
    shipped_file: Option<&Path>,
    user_file: Option<&Path>,
) -> BTreeMap<String, StrengthRow> {
    let shipped = shipped_file
        .and_then(read_json)
        .or_else(|| serde_json::from_str(BAKED_MODELS).ok())
        .unwrap_or(Value::Null);
    let user = user_file.and_then(read_json).unwrap_or(Value::Null);
    resolve_strengths(
        shipped.get("strengths").unwrap_or(&Value::Null),
        user.get("strengths").unwrap_or(&Value::Null),
        agent,
        models,
        has_effort,
    )
}

/// What each strength word maps to for the built-in `agent`, from the same
/// shipped and user files as `models_for_builtin`. `models` is the ids of the
/// agent's menu; a row naming a model outside it reads unmapped.
pub fn strengths_for(
    agent: &str,
    models: &[String],
    has_effort: bool,
) -> BTreeMap<String, StrengthRow> {
    strengths_from(
        agent,
        models,
        has_effort,
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
        assert!(models_for("nonesuch", Some(&missing), Some(&missing)).is_empty());
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

    /// Every case in the shared strength fixture: the same file drives
    /// scripts/test-web-console-strengths.mjs, so the console's resolver and
    /// this one stay the one rule.
    #[test]
    fn the_shared_strength_cases_all_resolve_the_same() {
        let cases: Value = serde_json::from_str(include_str!(
            "../../../scripts/fixtures/strength-cases.json"
        ))
        .unwrap();
        assert_eq!(cases["schema"], 1);
        let list = cases["cases"].as_array().unwrap();
        assert!(list.len() >= 10);
        for case in list {
            let name = case["name"].as_str().unwrap();
            let agent = case["agent"].as_str().unwrap();
            let models: Vec<String> = case["models"]
                .as_array()
                .unwrap()
                .iter()
                .map(|m| m.as_str().unwrap().to_string())
                .collect();
            // The fixture holds one agent's rows; the resolver reads them by agent id.
            let wrap = |rows: &Value| json!({ agent: rows.clone() });
            let resolved = resolve_strengths(
                &wrap(&case["shipped"]),
                &wrap(&case["user"]),
                agent,
                &models,
                case["hasEffort"].as_bool().unwrap(),
            );
            let got = serde_json::to_value(&resolved).unwrap();
            assert_eq!(got, case["expect"]["resolved"], "{name}: resolved");
            for word in STRENGTH_ORDER {
                let want = case["expect"]["next"][word].as_str().map(str::to_string);
                assert_eq!(
                    next_strength(&resolved, word),
                    want,
                    "{name}: next after {word}"
                );
            }
        }
    }

    #[test]
    fn next_strength_of_an_unknown_word_is_none() {
        let mut resolved = BTreeMap::new();
        resolved.insert(
            "best".to_string(),
            StrengthRow {
                model: "x".to_string(),
                effort: None,
            },
        );
        assert_eq!(next_strength(&resolved, "cheap"), None);
        assert_eq!(
            next_strength(&resolved, "thrifty"),
            Some("best".to_string())
        );
    }

    #[test]
    fn strengths_for_reads_the_shipped_and_user_files() {
        let dir = temp_dir("strengths");
        let shipped = dir.join("bin").join("models.json");
        let user = dir.join("models.json");
        std::fs::write(
            &shipped,
            r#"{ "claude": [{ "id": "sonnet", "label": "S" }, { "id": "opus", "label": "O" }],
                 "strengths": { "claude": {
                   "thrifty": { "model": "sonnet", "effort": "low" },
                   "best": { "model": "opus", "effort": "medium" } } } }"#,
        )
        .unwrap();
        std::fs::write(
            &user,
            r#"{ "strengths": { "claude": { "best": { "model": "sonnet", "effort": "high" } } } }"#,
        )
        .unwrap();
        let models = vec!["sonnet".to_string(), "opus".to_string()];
        let got = strengths_from("claude", &models, true, Some(&shipped), Some(&user));
        assert_eq!(got["thrifty"].model, "sonnet");
        assert_eq!(got["best"].model, "sonnet");
        assert_eq!(got["best"].effort.as_deref(), Some("high"));
        assert!(!got.contains_key("balanced"));
        // No user file: the shipped rows alone.
        let got = strengths_from("claude", &models, true, Some(&shipped), None);
        assert_eq!(got["best"].model, "opus");
        // An agent with no rows anywhere has none.
        assert!(strengths_from("codex", &models, false, Some(&shipped), Some(&user)).is_empty());
    }

    #[test]
    fn the_baked_copy_ships_the_claude_and_devin_strengths() {
        let dir = temp_dir("baked-strengths");
        let missing = dir.join("bin").join("models.json");
        let ids = |agent: &str| -> Vec<String> {
            models_for(agent, Some(&missing), Some(&missing))
                .into_iter()
                .map(|m| m.id)
                .collect()
        };
        let claude = strengths_from(
            "claude",
            &ids("claude"),
            true,
            Some(&missing),
            Some(&missing),
        );
        assert_eq!(claude.len(), 3);
        let devin = strengths_from(
            "devin",
            &ids("devin"),
            false,
            Some(&missing),
            Some(&missing),
        );
        assert_eq!(devin.len(), 3);
        assert!(strengths_from(
            "codex",
            &ids("codex"),
            false,
            Some(&missing),
            Some(&missing)
        )
        .is_empty());
    }

    /// A `strengths` key beside the agents' lists is never read as a model
    /// list: the menus come out as they did without it.
    #[test]
    fn a_strengths_key_leaves_the_model_menus_unchanged() {
        let dir = temp_dir("strengths-menu");
        let shipped = dir.join("bin").join("models.json");
        let user = dir.join("models.json");
        std::fs::write(
            &shipped,
            r#"{ "claude": [{ "id": "sonnet", "label": "S" }],
                 "strengths": { "claude": { "best": { "model": "sonnet" } } } }"#,
        )
        .unwrap();
        std::fs::write(
            &user,
            r#"{ "claude": [{ "id": "mine", "label": "M" }],
                 "strengths": { "claude": { "best": { "model": "mine" } } } }"#,
        )
        .unwrap();
        assert_eq!(
            models_for("claude", Some(&shipped), Some(&user)),
            vec![model("sonnet", Some("S")), model("mine", Some("M"))]
        );
        assert!(models_for("strengths", Some(&shipped), Some(&user)).is_empty());
    }
}
