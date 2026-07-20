# Plan2Code Status Line (Claude CLI)

A persistent three-line status bar for Claude Code that displays model info, project context, context window usage, usage stats (rate limits or token counts), and git diff stats.

## Example Output

**Pro / Max / Teams** — rate limits segment:

```
╭─╮  Opus 4.6 | High │ plan2code │ feature/statusline │ +12 -3
│★│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
╰─╯  3h 5m ($4.62) │ ▰▰▰▰▰▱▱▱▱▱▱▱ 42% (84k) │ 5h: 28% · 7d: 61%
```

**Enterprise / Bedrock / Vertex / PAYG** — session token counts (no `rate_limits` in stdin):

```
╭─╮  Sonnet 4.5 | Medium │ plan2code │ main │ +12 -3
│★│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
╰─╯  2m ($0.18) │ ▰▰▱▱▱▱▱▱▱▱▱▱ 18% (36k) │ 88k in · 3k out
```

**Line 1:** Planny icon | Model name + reasoning effort | Project name | Git branch | Uncommitted changes
**Line 2:** Planny icon | Gray separator
**Line 3:** Planny icon | Session duration + cost | Context window bar | Usage (rate limits or token counts)

## Installation

### Via install.js (Recommended)

```bash
node install.js
# Select A (Install All + dev tools) or C (Custom) → S (Status Line)
```

This automatically:
1. Copies `statusline.js` → `~/.claude/plan2code-statusline.js`
2. Creates default config at `~/.claude/statusline-config.json` (preserves existing)
3. Registers the status line in `~/.claude/settings.json` (atomic write)

### Manual Setup

1. Copy `statusline.js` → `~/.claude/plan2code-statusline.js`
2. Copy `statusline-config.json` → `~/.claude/statusline-config.json`
3. Add to `~/.claude/settings.json`:
   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "node /path/to/home/.claude/plan2code-statusline.js"
     }
   }
   ```

## Configuration

Edit `~/.claude/statusline-config.json`:

```json
{
  "autocompactBuffer": 33000,
  "color": true,
  "compact": false,
  "items": {
    "model": true,
    "effort": true,
    "project": true,
    "branch": true,
    "contextBar": true,
    "planUsage": true,
    "linesChanged": true,
    "duration": true,
    "sessionCost": true
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `autocompactBuffer` | `33000` | Autocompact buffer size in tokens. Context bar scales usable window = total − buffer. Adjust to match your model's autocompact buffer. |
| `color` | `true` | Enable ANSI color output. Set `false` for monochrome. The `NO_COLOR` environment variable (per [no-color.org](https://no-color.org)) also disables color. |
| `compact` | `false` | Two-line mode — drops the mascot icons and the separator line. Goes from 3 lines to 2, no horizontal truncation. |
| `items.model` | `true` | Show model name (Opus, Sonnet, Haiku) |
| `items.effort` | `true` | Append the current reasoning effort level (Low/Medium/High/XHigh/Max) to the model segment, e.g. `Sonnet 5 \| High`. Reads `effort.level` from stdin; hidden when the current model doesn't support an effort parameter (field absent from stdin). |
| `items.project` | `true` | Show project directory name |
| `items.branch` | `true` | Show current git branch (falls back to short SHA when detached HEAD) |
| `items.contextBar` | `true` | Show context window usage bar with percentage |
| `items.contextTokens` | `true` | Append raw tokens used in the context window next to the percentage, e.g. `42% (84k)`. Reads `context_window.total_input_tokens` (the same input-token count `used_percentage` is derived from — excludes output tokens). Requires `items.contextBar` to also be enabled. |
| `items.planUsage` | `true` | Show usage info: rate limits (Pro/Max) or token counts (Bedrock/Vertex/PAYG) |
| `items.linesChanged` | `true` | Show uncommitted git diff stats (+added -removed) |
| `items.duration` | `true` | Show session duration |
| `items.sessionCost` | `true` | Append estimated session cost in parens next to duration (e.g. `49m ($4.62)`). Reads `cost.total_cost_usd` from Claude Code stdin — client-side estimate, not billing-exact. Session-scoped only; monthly enterprise totals are not exposed by Claude Code. Hidden when cost is 0 or unavailable. |

Malformed config falls back to defaults silently. Type errors on individual keys also fall back to defaults.

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Claude Code | Supported | Full feature set via `settings.json` registration |
| Copilot CLI | Planned | Deferred — CLI lacks status line script support as of v0.0.421 |
| Others | Not supported | Codex CLI, Gemini CLI have built-in status, not scriptable |

## Usage Display

The usage segment reads data directly from Claude Code's stdin JSON — no API calls, no auth needed, no background processes.

Two display modes are automatically selected based on the data present in stdin:

| User Type | Condition | Display Format | Data Source |
|-----------|-----------|----------------|-------------|
| Pro/Max/Teams | `rate_limits` present in stdin | `5h: 28% · 7d: 61%` | `rate_limits.five_hour.used_percentage`, `rate_limits.seven_day.used_percentage` |
| Bedrock/Vertex/PAYG | No `rate_limits` in stdin | `12k in · 4k out` | `context_window.total_input_tokens`, `context_window.total_output_tokens` |

### Color Thresholds

- Rate limits: green < 60%, yellow 60–79%, red 80%+
- Token counts: neutral/white (no thresholds)
- Context bar: green < 50%, yellow 50–69%, red 70%+

## Debugging

The bundled script accepts two diagnostic flags for local testing:

```bash
# Print parsed stdin and merged config to stderr
echo '{"model":{"display_name":"Opus 4.6"}}' | node ~/.claude/plan2code-statusline.js --debug

# Load a fixture file instead of reading from stdin
node ~/.claude/plan2code-statusline.js --fixture ./fixture.json
node ~/.claude/plan2code-statusline.js --fixture ./fixture.json --debug
```

Fixture format = whatever Claude Code sends on stdin (JSON with `model`, `workspace`, `context_window`, `rate_limits`, `cost.total_duration_ms`).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Garbled ANSI codes in output | Set `"color": false` in config, or export `NO_COLOR=1` |
| Status line not appearing | Verify `~/.claude/settings.json` has `statusLine` key with correct path to `plan2code-statusline.js` |
| Slow execution (>100ms) | Git calls are timeout-bounded to 1.5s each; non-repos short-circuit via `.git` directory check. If still slow, disable `branch` or `linesChanged`. |
| Usage segment not showing | Rate limits require Pro/Max/Teams plan. Token counts require at least one assistant message. Use `--debug` to inspect stdin. |
| Wrong context bar percentage | Adjust `autocompactBuffer` to match your model. Default 33000 tokens. |
| Three lines take too much space | Set `"compact": true` to drop the mascot icons + separator line (3 lines → 2). |

## Architecture

```
src/statusline-claude/
├── statusline.js           # Self-contained: config, git, formatters, render
└── statusline-config.json  # Default config template
```

Single-file design — `statusline.js` is copied verbatim to `~/.claude/plan2code-statusline.js` on install. No bundler, no runtime dependencies.

## Uninstalling

### Via install.js

```bash
node install.js
# Select U (Uninstall) → confirms removal
```

### Manual Removal

1. Remove `statusLine` key from `~/.claude/settings.json`
2. Delete `~/.claude/plan2code-statusline.js`
3. Optionally delete `~/.claude/statusline-config.json`
