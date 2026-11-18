# The plan2code command and other agents

The command-line side of Plan2Code: what `plan2code` does when you run it, and how to use an agent other than Claude Code, Devin or Codex. Back to the [README](../README.md#install-and-start).

## About the plan2code command

Install (`I`) adds `plan2code` as a global command (Advanced `A` → `D` adds just the command). Run it from any project and the Plan2Code
dashboard opens right there, in **Claude Code**, **Devin** or **Codex**. With more than one installed it asks which and
remembers your pick; `plan2code --cli claude`, `--cli devin` or `--cli codex` skips the question, and `--model <name>`
chooses the model. It works in cmd, PowerShell, Git Bash, macOS and Linux shells, and needs the
Claude Code, Devin or Codex CLI on your `PATH`. After you pick the agent it asks whether to turn its
permission prompts off (Yes by default; `--permission-mode bypassPermissions` in Claude Code, `--permission-mode bypass`
in Devin, `--dangerously-bypass-approvals-and-sandbox` in Codex, a custom agent's bypass arguments, and no question for a
custom agent that has none; for Codex the question names its sandbox, which that flag turns off too). It asks on every
launch and remembers no answer. `plan2code --keep-permissions` keeps the prompts without asking, and
`plan2code --bypass-permissions` turns them off without asking. With no terminal to ask on (a script or a pipe) the
prompts stay on unless `--bypass-permissions` is given. The installer then offers a desktop shortcut (answer `y`),
which opens a folder menu first: Choose a folder, with the project folders you opened lately under it (with none yet, it goes straight to the folder dialog). In a terminal, `plan2code` offers the same recent folders as a numbered menu. Uninstalling (`U`, or `plan2code uninstall` from any terminal) removes both.

## Using another agent CLI, or none yet

Plan2Code runs inside an AI coding agent CLI. With no agent it can run (none of Claude Code,
Devin or Codex, and no working custom agent),
`plan2code` opens a setup page in your browser (the web console runs it, so no agent is needed).
The page lists each agent as **Found**, **Found outside PATH** or **Not found**, with its install
commands for your system, a Copy button per command and an **Install page** link. Install one and
press **Check again**: no restart needed. An agent found outside `PATH` gets **Use it from here**,
which saves where it was found so you never touch `PATH` yourself. Below the list sit five starter
templates (GitHub Copilot CLI, OpenCode, Gemini CLI, Pi and Cursor CLI) for agents Plan2Code does not ship.
**Start with this agent** carries the run straight on in the same tab, onto the new agent's
dashboard. Naming a built-in that is missing with `--cli <name>` opens the same page on that agent
(a missing custom agent prints its own steps and exits 127). In the
desktop app a **Set up an agent** button opens the same page in the window and returns to the
launch card with the found agent picked. Where no page can open, such as over SSH or with no
display, `plan2code` prints the install commands and install pages and exits with code 127.

Once an agent is running, to use a different agent CLI, open the web console's **User Preferences → Agents & models** and add it: a name, the
command, and (optionally) its arguments, the start prompt, arguments for skipping permission prompts, and
how it takes a model. Custom agents are saved in `~/.plan2code/agents.json` and used by both the
`plan2code` command (listed after the built-ins; `--cli <id>` picks one) and the desktop app's picker. The
`/plan2code` start prompt only does something in an agent that loads the installed Plan2Code skills; for
any other, leave the start prompt blank and start a skill yourself. Details in
[web-console.md](web-console.md#agents--models).
