# Security

## Reporting a vulnerability

Please report a vulnerability privately, not as a public issue. Use GitHub's private reporting: open the repository's **Security** tab and choose **Report a vulnerability** (or go to <https://github.com/jparkerweb/plan2code/security/advisories/new>).

Include what you found, the version (`version.json`, or the bottom of the web console's Help dialog), your system, and the steps to reproduce it. You can expect a first reply within a few days. Once a fix is released, the report is published with credit to you if you want it.

## What is in scope

Plan2Code runs on your own machine: the installer, the `plan2code` command, the local web console (served on `127.0.0.1` with a per-session token) and the desktop app. Reports about any of these are welcome, in particular anything that lets a web page or another local user reach the console, read or write files outside the project, or run a command the person did not approve.

The desktop app is not code-signed; that is documented in [docs/desktop-app.md](docs/desktop-app.md#the-app-is-not-code-signed) and is not a vulnerability report.
