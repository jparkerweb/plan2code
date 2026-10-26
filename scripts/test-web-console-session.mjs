// Web console tests, the first shared session: open, auth, sends, serving, uploads, patches.
// Run with: node --test scripts/test-web-console-session.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
// The page's pure answer-shaping logic. app.js itself cannot be imported here
// (it touches `document` at module scope and starts a session on import), which
// is exactly why this lives in its own file.
import {
  IMAGE_LONG_EDGE,
  MAX_ATTACHMENTS,
  MAX_DOC_BYTES,
  DASHBOARD_REPLY,
  HOME_REPLY,
  homeButtonState,
  noteAction,
  noteReplyLines,
  staleLaunchFeedback,
  REVIEW_REPLY,
  STOP_REPLY,
  STOP_HANDOFF_REPLY,
  threadText,
  threadWho,
  turnGate,
} from "../src/web-console/public/answers.js";
import { CHAT_LIMIT, CHAT_MAX_CHARS } from "../src/web-console/public/chat.js";
import { ACCENTS, CARD_WIDTHS, SOUND_EVENTS, soundKey, soundPrefs } from "../src/web-console/public/palette.js";
import { HELP_TABS, helpTabFor, helpKeyTarget } from "../src/web-console/public/help.js";
import { RED_AT, YELLOW_AT } from "../src/web-console/public/meter.js";
import { REMOTE_FOLD } from "../src/web-console/public/git-board.js";
import { readLedger, SESSION_MAX_AGE_MS, sweepUploads, UPLOAD_MAX_AGE_MS } from "../src/web-console/sessions.mjs";
import { applyPatch, validate } from "../src/web-console/patches.mjs";
import { joinedCss } from "./css-helpers.mjs";
import {
  ROOT,
  HOME,
  cookieFor,
  cli,
  payload,
  BASE,
  helpTemplate,
  JPEG,
  PDF,
  readState,
  ask,
  until,
  clientFor,
} from "./web-console-test-helpers.mjs";

let sid;
let session;
let baseUrl;
let token;
const { post, raw } = clientFor(() => ({ baseUrl, token }));

test("open starts a detached server and prints a loopback URL", () => {
  const res = cli(["open", "--file", payload("p1.json", BASE), "--no-open", "--title", "Test session"]);
  assert.equal(res.json.ok, true);
  sid = res.json.sid;
  session = res.json.session;
  assert.match(res.json.url, /^http:\/\/127\.0\.0\.1:\d+\/s\/[A-Za-z0-9_-]{22}\//);
  const m = res.json.url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
  baseUrl = m[1];
  token = m[2];
});

test("health reports the session id", async () => {
  const res = await fetch(baseUrl + "/health");
  const body = await res.json();
  assert.equal(body.sid, sid);
});

// fetch() silently drops a Host header (it is a forbidden header name), so this
// has to go out over a raw socket or it asserts nothing.
function rawGet(pathname, host) {
  const port = Number(new URL(baseUrl).port);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: pathname, method: "GET", headers: { Host: host } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      }
    );
    req.on("error", reject);
    req.end();
  });
}

test("rejects a mismatched Host header (DNS rebinding)", async () => {
  assert.equal(await rawGet("/health", "evil.example.com"), 403);
  assert.equal(await rawGet("/health", `127.0.0.1:${new URL(baseUrl).port}`), 200);
});

test("rejects an unauthenticated read and a bad token", async () => {
  assert.equal((await fetch(baseUrl + "/state")).status, 403);
  assert.equal((await fetch(baseUrl + "/s/not-the-token/", { redirect: "manual" })).status, 403);
});

test("the token path sets a cookie and redirects", async () => {
  const res = await fetch(`${baseUrl}/s/${token}/`, { redirect: "manual" });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/");
  assert.match(res.headers.get("set-cookie"), /HttpOnly/);
  assert.match(res.headers.get("set-cookie"), /SameSite=Strict/);
  assert.ok(res.headers.get("set-cookie").startsWith(`${cookieFor(baseUrl, token)};`), "named for the port");
});

test("the page is served with a CSP that forbids inline script", async () => {
  const res = await fetch(baseUrl + "/", { headers: { cookie: cookieFor(baseUrl, token) } });
  const csp = res.headers.get("content-security-policy");
  assert.ok(csp.includes("script-src 'self'"));
  assert.ok(!csp.includes("unsafe-inline"));
  // The two chime files load as media: without this, default-src 'none' blocks them.
  assert.ok(csp.includes("media-src 'self'"));
});

test("wait returns 10 with a progress summary while nobody has answered", () => {
  const res = cli(["wait", "--session", sid, "--seconds", "5"]);
  assert.equal(res.status, 10);
  assert.equal(res.json.status, "waiting");
  assert.equal(res.json.total, 1);
});

test("a submit round-trips to the agent with the literal reply token", async () => {
  await post("/submit", {
    actions: [{ i: "q1", type: "answer", kind: "choice", k: "B" }],
    reply: "Export format: b",
  });
  const res = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(res.status, 0);
  assert.equal(res.json.type, "submit");
  assert.equal(res.json.reply, "Export format: b");
  assert.equal(res.json.actions[0].k, "B");
});

test("a collected answer is written to the meter ledger once, and a button press is not", async () => {
  const answers = () => readLedger(session).filter((e) => e.kind === "answer");
  const mine = answers().filter((e) => e.id.endsWith(":q1"));
  assert.equal(mine.length, 1, "the round-trip above left one answer for q1");
  assert.match(mine[0].id, /^L\d+:answer:.+:q1$/);
  // Collecting the same send again (a kill before consumedAt) adds nothing.
  const resultFile = path.join(session, "result.json");
  const collected = JSON.parse(fs.readFileSync(resultFile, "utf8"));
  const before = answers().length;
  fs.writeFileSync(resultFile, JSON.stringify({ ...collected, consumedAt: undefined }));
  assert.equal(cli(["wait", "--session", sid, "--seconds", "5"]).status, 0);
  assert.equal(new Set(answers().map((e) => e.id)).size, before, "a re-collected send dedupes by id");
});

// The page shows a settled question's answer back to the person. If it had to
// wait for the agent to record one, a model that forgot would leave someone
// looking at a card marked "Settled" with nothing in it.
test("a submit is recorded on the item, so the page can show the answer back", () => {
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  const q1 = state.items.find((i) => i.id === "q1");
  assert.equal(q1.submitted.k, "B");
  assert.ok(q1.submitted.at, "the server stamps the time, the client never does");
  assert.equal(q1.status, "open", "only the agent settles a question");
});

// The Brief button is a send like any other, which is the whole reason it needs
// no new transport. What matters is that the range reaches the agent in the
// grammar its playbook parses.
test("a brief request round-trips with a range the playbook can read", async () => {
  await post("/submit", {
    actions: [{ i: "__brief", type: "brief", range: "since 2026-09-15" }],
    reply: "Write a brief covering everything since 2026-09-15.",
  });
  const res = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(res.status, 0);
  assert.equal(res.json.actions[0].type, "brief");
  assert.equal(res.json.actions[0].range, "since 2026-09-15");
  assert.match(res.json.reply, /since 2026-09-15/);

  // `__brief` is not an item, so nothing on the board may have been touched.
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.ok(state.items.every((i) => i.id !== "__brief"), "a brief must not become a question");
  assert.equal(state.items.find((i) => i.id === "q1").status, "open");
});

// The review button on a finished build is a send like the brief: it names no
// question, and it reaches the agent through the same wait loop.
test("a review request round-trips without touching any question", async () => {
  await post("/submit", {
    actions: [{ i: "__review", type: "review" }],
    reply: REVIEW_REPLY,
  });
  const res = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(res.status, 0);
  assert.equal(res.json.actions[0].i, "__review");
  assert.equal(res.json.reply, REVIEW_REPLY);
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.ok(state.items.every((i) => i.id !== "__review"), "a review request must not become a question");
  assert.equal(state.items.find((i) => i.id === "q1").status, "open");
});

// The dashboard's card click is a send like the brief and the review button:
// it names no question, and the skill it carries reaches the agent through
// the same wait loop.
test("a launch request round-trips with the skill the dashboard resumes as", async () => {
  await post("/submit", {
    actions: [{ i: "__launch", type: "launch", skill: "plan2code-3-implement", workflow: "implement" }],
    reply: "Start Implement (/plan2code-3-implement), right here in this session.",
  });
  const res = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(res.status, 0);
  assert.equal(res.json.actions[0].i, "__launch");
  assert.equal(res.json.actions[0].skill, "plan2code-3-implement");
  assert.equal(res.json.actions[0].workflow, "implement");
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.ok(state.items.every((i) => i.id !== "__launch"), "a launch must not become a question");
});

// Continue here sends the same launch from a finished screen, so the hop's
// resume names the next skill's workflow and the spec, and the skill file to read.
test("a launch sent from a finished screen carries the resume for the next skill and spec", async () => {
  await post("/submit", {
    actions: [{ i: "__launch", type: "launch", skill: "plan2code-2-document", workflow: "document", spec: "specs/lunch-vote" }],
    reply: "Start Document (/plan2code-2-document) for specs/lunch-vote, right here in this session.",
  });
  const res = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(res.status, 0);
  assert.equal(res.json.actions[0].i, "__launch");
  assert.match(res.json.resume, /--no-open --workflow document --spec specs\/lunch-vote$/);
});

// The page tells the person the hop gives the next skill a clean page: a resume
// into a different workflow drops the finish it was launched from.
test("resuming into another skill after Continue here drops the finish", async () => {
  const stateFile = path.join(session, "state.json");
  const readState = () => JSON.parse(fs.readFileSync(stateFile, "utf8"));
  cli(["post", "--session", sid, "--file", payload("fin-continue.json", {
    finish: { headline: "The plan is documented", command: "/plan2code-5-changelog", dashboard: true },
  })]);
  const snapshot = fs.readFileSync(stateFile, "utf8");
  await post("/submit", {
    actions: [{ i: "__launch", type: "launch", skill: "plan2code-changelog", workflow: "changelog" }],
    reply: "Start Changelog (/plan2code-changelog), right here in this session.",
  });
  const res = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(res.status, 0);
  cli(["open", "--resume", sid, "--no-open", "--workflow", "changelog"]);
  const resumed = readState();
  assert.equal(resumed.workflow, "changelog");
  assert.equal(resumed.finish, undefined, "the old finish is gone");
  fs.writeFileSync(stateFile, snapshot);
});

// A delete from the dashboard's picker is a send like a launch, but no hop:
// the agent stays the dashboard, so it carries no resume and no skill file.
test("a delete request round-trips with the spec folder and no resume", async () => {
  await post("/submit", {
    actions: [{ i: "__delete", type: "delete", spec: "specs/lunch-vote" }],
    reply: "Delete the spec folder specs/lunch-vote/ for good, right here in this session.",
  });
  const res = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(res.status, 0);
  assert.equal(res.json.actions[0].i, "__delete");
  assert.equal(res.json.actions[0].spec, "specs/lunch-vote");
  assert.equal(res.json.resume, undefined);
  assert.equal(res.json.skillFile, undefined);
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.ok(state.items.every((i) => i.id !== "__delete"), "a delete must not become a question");
});

// Back to the dashboard is a send like the review button: it names no
// question, it is refused while an earlier send is uncollected, and the agent
// answers it by resuming the same session as the dashboard.
test("a dashboard request round-trips and the session resumes as the dashboard", async () => {
  const stateFile = path.join(session, "state.json");
  const readState = () => JSON.parse(fs.readFileSync(stateFile, "utf8"));
  cli(["post", "--session", sid, "--file", payload("fin-dash-rt.json", {
    finish: { headline: "Phase 3 is done", command: "/plan2code-3-implement specs/lunch-vote/overview.md", dashboard: true },
  })]);
  const submittedBefore = readState().items.map((i) => (i.submitted ? i.submitted.at : null));

  const first = await post("/submit", { actions: [{ i: "__dashboard", type: "dashboard" }], reply: DASHBOARD_REPLY });
  assert.equal(first.status, 200);
  const second = await post("/submit", { actions: [{ i: "__dashboard", type: "dashboard" }], reply: DASHBOARD_REPLY });
  assert.equal(second.status, 409, "a second press is refused while the first is uncollected");

  const res = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(res.status, 0);
  assert.deepEqual(res.json.actions, [{ i: "__dashboard", type: "dashboard" }]);
  assert.equal(res.json.reply, DASHBOARD_REPLY);
  const after = readState();
  assert.ok(after.items.every((i) => i.id !== "__dashboard"), "a dashboard request must not become a question");
  assert.deepEqual(
    after.items.map((i) => (i.submitted ? i.submitted.at : null)),
    submittedBefore,
    "no item gained a submitted record"
  );

  const snapshot = fs.readFileSync(stateFile, "utf8");
  cli(["open", "--resume", sid, "--no-open", "--workflow", "dashboard"]);
  cli(["post", "--session", sid, "--file", payload("fin-dash-null.json", { finish: null })]);
  const resumed = readState();
  assert.equal(resumed.workflow, "dashboard");
  assert.equal(resumed.finish, undefined);
  assert.ok(resumed.scan, "resuming as the dashboard scans the project");

  // Put it back for the tests that follow: the switch blanked the session.
  fs.writeFileSync(stateFile, snapshot);
});

test("a stale dashboard launch says the pick is saved and how to wake the agent", () => {
  assert.deepEqual(staleLaunchFeedback("Pathfinder", true), {
    kicker: "Saved",
    title: "Pathfinder is saved and waiting",
    quip: "Plan2Code is not running right now.",
    hint: "Return to the terminal and send any message. Plan2Code will collect this launch and continue here.",
  });
  assert.equal(staleLaunchFeedback("Pathfinder", false), null);
});

// The page clears staged answers when it hears a submit landed, because a send
// from a second tab really has taken them. The event has to say WHICH ones, or
// a brief request -- a submit carrying no answers at all -- wipes work that was
// never sent.
test("the submitted event names the items that went", async () => {
  const port = Number(new URL(baseUrl).port);
  const frame = new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: "/events", method: "GET", headers: { cookie: cookieFor(baseUrl, token) } },
      (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          buf += chunk;
          const m = buf.match(/event: submitted\ndata: (.+)\n/);
          if (!m) return;
          req.destroy();
          try {
            resolve(JSON.parse(m[1]));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", (err) => {
      if (err.code !== "ECONNRESET") reject(err);
    });
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("no submitted frame within 5s"));
    });
    req.end();
  });

  await post("/submit", {
    actions: [{ i: "__brief", type: "brief", range: "today" }],
    reply: "Write a brief for today.",
  });
  const data = await frame;
  assert.deepEqual(data.ids, ["__brief"], "only the brief went, so only it may be cleared");
  cli(["wait", "--session", sid, "--seconds", "10"]);
});

// The heartbeat is the only thing that tells a page the agent has come or
// gone: the watcher fires on state.json, which is the agent POSTING, and an
// agent that collects a result or is merely alive and thinking touches
// neither. Without these fields a page can insist for minutes that nobody has
// picked its answers up when something already has.
test("the heartbeat reports agent liveness and whether a send is still uncollected", async () => {
  // post() hands back the Response, not the body.
  const ping = async () => (await post("/ping", {})).json();

  const before = await ping();
  assert.equal(before.ok, true);
  assert.equal(before.pendingResult, false);
  assert.equal(typeof before.rev, "number");
  assert.ok(Date.parse(before.agentLastSeen) > 0, "agentLastSeen must be a timestamp");

  await post("/submit", {
    rev: before.rev,
    actions: [{ i: "q1", type: "answer", kind: "choice", k: "A" }],
    reply: "a",
  });
  assert.equal((await ping()).pendingResult, true, "an uncollected send must show on the heartbeat");

  cli(["wait", "--session", sid, "--seconds", "5"]);
  assert.equal((await ping()).pendingResult, false, "collecting it must show on the heartbeat too");
});

// Stop session rides the ordinary submit, so the last staged answers go with
// it in one piece, and reaches the agent as an ordinary send (exit 0), not as
// a cancel. The server also reports it, because the page's own memory of it
// does not survive a resume on a new port.
test("a stop request carries the staged answers, reaches the agent as a send, and is reported until collected", async () => {
  const ping = async () => (await post("/ping", {})).json();
  const before = await ping();
  assert.equal(before.pendingStop, false);

  await post("/submit", {
    rev: before.rev,
    actions: [{ i: "q1", type: "answer", kind: "choice", k: "B" }, { i: "__stop", type: "stop" }],
    reply: "Export format: b\n" + STOP_REPLY,
  });
  assert.equal((await ping()).pendingStop, true, "an uncollected stop must show on the heartbeat");

  const res = cli(["wait", "--session", sid, "--seconds", "5"]);
  assert.equal(res.status, 0, "a stop is a send, not a cancel");
  assert.deepEqual(
    res.json.actions.map((a) => a.type),
    ["answer", "stop"],
    "the answers and the stop arrive together"
  );
  assert.equal((await ping()).pendingStop, false);
});

// "Stop with a handoff" is the same send with `handoff: true` on the action.
// The source tree has no built Handoff skill beside it, so no handoffSkill.
test("a handoff stop keeps its flag, reports as a stop until collected, and names no skill file in the source tree", async () => {
  const ping = async () => (await post("/ping", {})).json();
  const before = await ping();
  await post("/submit", {
    rev: before.rev,
    actions: [{ i: "__stop", type: "stop", handoff: true }],
    reply: STOP_HANDOFF_REPLY,
  });
  assert.equal((await ping()).pendingStop, true, "an uncollected handoff stop shows on the heartbeat");
  const res = cli(["wait", "--session", sid, "--seconds", "5"]);
  assert.equal(res.status, 0);
  assert.equal(res.json.actions[0].handoff, true, "the flag reaches the agent");
  assert.equal(res.json.handoffSkill, undefined, "no built skill beside the source tree");
  assert.equal((await ping()).pendingStop, false);
});

// The top bar's triangle is a stop that lands on the menu: the staged answers
// and `__dashboard` go as one send with no finish on the page, the agent gets
// both at once, and the resume through the dashboard blanks the skill's page.
test("a mid-workflow way home carries the staged answers and resumes as the dashboard", async () => {
  const stateFile = path.join(session, "state.json");
  const readState = () => JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const snapshot = fs.readFileSync(stateFile, "utf8");
  // Earlier tests leave a finish on the shared session; the way home is sent mid-workflow.
  cli(["post", "--session", sid, "--file", payload("home-unfinish.json", { finish: null })]);
  assert.equal(readState().finish, undefined, "the way home is sent before any finish");

  const res = await post("/submit", {
    actions: [{ i: "q1", type: "answer", kind: "choice", k: "A" }, { i: "__dashboard", type: "dashboard" }],
    reply: "Export format: a\n" + HOME_REPLY,
  });
  assert.equal(res.status, 200);
  const got = cli(["wait", "--session", sid, "--seconds", "5"]);
  assert.equal(got.status, 0, "the way home is a send, not a cancel");
  assert.deepEqual(got.json.actions.map((a) => a.type), ["answer", "dashboard"], "the answers and the way home arrive together");
  assert.ok(got.json.reply.endsWith(HOME_REPLY));

  cli(["open", "--resume", sid, "--no-open", "--workflow", "dashboard"]);
  cli(["post", "--session", sid, "--file", payload("home-menu.json", { finish: null, menu: { note: "Back from the plan" }, agent: { status: "waiting" } })]);
  const home = readState();
  assert.equal(home.workflow, "dashboard");
  assert.equal(home.finish, undefined, "no finish card on the way home");
  assert.deepEqual(home.items, [], "the skill's questions do not follow it to the menu");
  assert.equal(home.menu.note, "Back from the plan");

  fs.writeFileSync(stateFile, snapshot);
});

test("the way home follows Stop's turn rules and hides where it has no job", () => {
  const turn = { gone: false, pendingResult: false, waiting: false };
  assert.equal(turnGate(turn), null);
  assert.equal(turnGate({ ...turn, waiting: true }), "waiting");
  assert.equal(turnGate({ ...turn, pendingResult: true, waiting: true }), "pending");
  assert.equal(turnGate({ gone: true, pendingResult: true, waiting: true }), "gone");

  for (const hidden of [
    { workflow: "dashboard" },
    { workflow: undefined },
    { workflow: "plan", finished: true },
    { workflow: "plan", stopping: true },
  ]) {
    assert.equal(homeButtonState({ ...turn, ...hidden }).hidden, true, JSON.stringify(hidden));
  }
  for (const workflow of ["plan", "pathfinder", "implement", "quick-task", "review", "init"]) {
    const st = homeButtonState({ ...turn, workflow });
    assert.equal(st.hidden, false, workflow);
    assert.equal(st.disabled, false, workflow);
    assert.match(st.title, /dashboard/i);
  }
  // `waiting` already excludes an adrift agent, so an agent that stopped
  // checking in leaves the button pressable -- the caller passes false.
  assert.equal(homeButtonState({ ...turn, workflow: "plan", waiting: true }).disabled, true);
  assert.equal(homeButtonState({ ...turn, workflow: "plan", pendingResult: true }).disabled, true);
  assert.equal(homeButtonState({ ...turn, workflow: "plan", gone: true }).disabled, true);
  const going = homeButtonState({ ...turn, workflow: "plan", homeward: true });
  assert.deepEqual([going.hidden, going.disabled], [false, true], "pressed once, it waits for the page to turn");
  const stranded = homeButtonState({ ...turn, workflow: "plan", homeward: true, adrift: true });
  assert.equal(stranded.disabled, false, "an agent gone quiet after collecting it gives the button back");
  assert.equal(homeButtonState({ ...turn, workflow: "plan", homeward: true, adrift: true, pendingResult: true }).disabled, true, "still one send at a time");
});

test("the page carries the way home: the triangle, its confirm, and the wiring", () => {
  const dir = path.join(ROOT, "src", "web-console", "public");
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  const css = joinedCss();
  assert.ok(html.indexOf('id="btn-home"') < html.indexOf('id="btn-stop"'), "the triangle sits left of Stop session");
  assert.match(html, /id="btn-home"[\s\S]{0,200}aria-label="Back to the dashboard"/, "the icon button has a name");
  for (const id of ["home-modal", "home-blurb", "home-warn", "home-cancel", "home-go"]) {
    assert.ok(html.includes(`id="${id}"`), `index.html must carry #${id}`);
  }
  assert.ok(html.includes("Leave this workflow?"));
  assert.match(css, /\.home-btn path\s*\{\s*fill:\s*var\(--accent\)/, "the triangle is filled with the highlight color");
});

test("the way home cannot be mistaken for a brief request", () => {
  assert.doesNotMatch(HOME_REPLY, /\b(brief|recap|minutes)\b/i);
});

test("console-stop.md, building.md and the dashboard prompt teach the mid-workflow way home", () => {
  const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
  const stopMd = read("src", "web-console", "console-stop.md");
  assert.ok(stopMd.includes("## Back to the dashboard, mid-workflow"));
  assert.ok(stopMd.includes(HOME_REPLY), "console-stop.md quotes the reply line the agent will see");
  assert.match(stopMd, /No `finish` and no `stop` in between/);
  assert.ok(stopMd.includes("## Stop with a handoff"));
  for (const word of ["handoff new", "--from-stop", "handoffSkill"]) assert.ok(stopMd.includes(word), `console-stop.md names ${word}`);
  assert.match(read("src", "web-console", "console.md"), /`__stop` \(plain, or with `handoff: true`\), `__dashboard` \(no finish up\) \| `console-stop\.md`/, "console.md's action table sends a handoff stop and a mid-workflow __dashboard there");
  assert.ok(read("src", "web-console", "building.md").includes("mid-build `__dashboard`"));
  assert.ok(read("src", "plan2code.md").includes("mid-workflow from the top bar's triangle"));
});

test("console-launches.md and the dashboard prompt teach the handoff pick-up and delete", () => {
  const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
  const launches = read("src", "web-console", "console-launches.md");
  for (const word of ["__pickup", "handoffFile", "delete-handoff", "handoffsDir", "fallback"]) {
    assert.ok(launches.includes(word), `console-launches.md names ${word}`);
  }
  assert.ok(launches.includes("handoffs, handoffsDir"), "console-launches.md lists the scan fields");
  const prompt = read("src", "plan2code.md");
  for (const word of ["__pickup", "delete-handoff"]) assert.ok(prompt.includes(word), `src/plan2code.md names ${word}`);
});

// The server serves a hardcoded allow-list, so a new module that nobody adds
// to it 404s, the import fails, and the page never starts: a blank console
// with the default title and one line in the browser's console. Every module
// any page script imports must come back.
test("every module the page imports is actually served", async () => {
  const dir = path.join(ROOT, "src", "web-console", "public");
  const wanted = new Set(["app.js"]);
  // The modules beside app.js and the screens under screens/, each import
  // resolved from the file that makes it (a screen's "../state.js" is state.js).
  const files = [...fs.readdirSync(dir).filter((f) => f.endsWith(".js")), ...fs.readdirSync(path.join(dir, "screens")).map((f) => `screens/${f}`)];
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(/^\s*import\b[^"']*["'](\.\.?\/[^"']+)["']/gm)) wanted.add(path.posix.join(path.posix.dirname(f), m[1]));
  }
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  for (const m of html.matchAll(/<link rel="modulepreload" href="\/([^"]+)"/g)) wanted.add(m[1]);
  assert.ok(wanted.has("chat.js"), "the page preloads chat.js");
  assert.ok(wanted.has("subagents.js"), "the page preloads subagents.js");
  assert.ok(wanted.size > 1, "found the imports");
  for (const f of wanted) {
    const res = await fetch(`${baseUrl}/${f}`, { headers: { cookie: cookieFor(baseUrl, token), connection: "close" } });
    assert.equal(res.status, 200, `${f} is imported but the server will not serve it`);
  }
});

// The wake-up module is imported by app.js and preloaded by the page, and it
// promises no DOM access at module scope: importing it here must not throw.
test("boot.js is served as JavaScript and imports without a DOM", async () => {
  const res = await fetch(`${baseUrl}/boot.js`, { headers: { cookie: cookieFor(baseUrl, token), connection: "close" } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /javascript/);
  const { playWake, GLIDE_AT_MS, DONE_AT_MS } = await import("../src/web-console/public/boot.js");
  assert.equal(typeof playWake, "function");
  assert.ok(GLIDE_AT_MS < DONE_AT_MS, "the glide starts before the run ends");
});

// The chimes are fetched like the modules are: the allow-list means a name
// nobody adds serves 404 and the sound just never plays, so assert every file
// the page asks for comes back as audio.
test("the chime files are served as audio", async () => {
  for (const f of ["start-stop.mp3", "next.mp3", "insert.mp3", "sleeping.mp3", "bootup.mp3", "start-skill.mp3"]) {
    const res = await fetch(`${baseUrl}/${f}`, { headers: { cookie: cookieFor(baseUrl, token) } });
    assert.equal(res.status, 200, `${f} is played but the server will not serve it`);
    assert.match(res.headers.get("content-type"), /^audio\//);
  }
});

// Every sound event in palette.js has its own box in User Preferences, every box
// names a real event, and every event's file is served. A box with no event
// saves a setting nothing reads; an event with no box can never be muted.
test("every sound event has a preference box and a served file", async () => {
  assert.equal(SOUND_EVENTS.startSkill.file, "start-skill", "starting a skill has its own sound");
  const html = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "index.html"), "utf8");
  const boxes = [...html.matchAll(/data-sound="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual([...boxes].sort(), Object.keys(SOUND_EVENTS).sort());
  for (const file of new Set(Object.values(SOUND_EVENTS).map((e) => e.file))) {
    const res = await fetch(`${baseUrl}/${file}.mp3`, { headers: { cookie: cookieFor(baseUrl, token) } });
    assert.equal(res.status, 200, `${file}.mp3 is played but the server will not serve it`);
    assert.match(res.headers.get("content-type"), /^audio\//);
  }
});

// A looks.json from before the per-event switches has none of their keys and
// must keep every sound; a saved switch survives; junk falls back to on.
test("soundPrefs: missing switches are on, saved booleans hold, anything else is on", () => {
  const keys = Object.keys(SOUND_EVENTS).map(soundKey);
  assert.equal(soundKey("startSkill"), "soundStartSkill");
  for (const saved of [null, undefined, {}, { theme: "dark", sound: false }]) {
    const prefs = soundPrefs(saved);
    assert.deepEqual(Object.keys(prefs).sort(), [...keys].sort());
    assert.ok(Object.values(prefs).every((v) => v === true), `every sound on for ${JSON.stringify(saved)}`);
  }
  const prefs = soundPrefs({ soundQuestion: false, soundBootup: "x", soundNewTab: 0, soundStartSkill: true, extra: false });
  assert.equal(prefs.soundQuestion, false);
  assert.equal(prefs.soundBootup, true);
  assert.equal(prefs.soundNewTab, true);
  assert.equal(prefs.soundStartSkill, true);
  assert.ok(!("extra" in prefs), "only the sound switches come back");
});

// The favicon rides the same allow-list, so a missing entry is a silent 404
// and the tab falls back to a blank icon.
test("the favicon is served as an SVG with a PNG fallback and the page points at both", async () => {
  const svg = await fetch(`${baseUrl}/favicon.svg`, { headers: { cookie: cookieFor(baseUrl, token) } });
  assert.equal(svg.status, 200, "favicon.svg is linked but the server will not serve it");
  assert.equal(svg.headers.get("content-type"), "image/svg+xml");
  assert.match(await svg.text(), /^<svg [^>]*viewBox="0 0 32 32"/);

  const res = await fetch(`${baseUrl}/favicon.png`, { headers: { cookie: cookieFor(baseUrl, token) } });
  assert.equal(res.status, 200, "favicon.png is linked but the server will not serve it");
  assert.equal(res.headers.get("content-type"), "image/png");
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);

  const html = await (await fetch(baseUrl + "/", { headers: { cookie: cookieFor(baseUrl, token) } })).text();
  assert.ok(html.includes('href="/favicon.svg"'));
  assert.ok(html.includes('href="/favicon.png"'));
  assert.doesNotMatch(html, /rel="icon"[^>]*href="data:/);
});

/* ---------------------------------------------------------------- help */


test("help: 18 tabs with unique ids", () => {
  assert.equal(HELP_TABS.length, 18);
  assert.equal(new Set(HELP_TABS.map((t) => t.id)).size, 18);
  assert.ok(Object.isFrozen(HELP_TABS) && HELP_TABS.every((t) => Object.isFrozen(t)), "the tab list is frozen");
  const ids = HELP_TABS.map((t) => t.id);
  assert.equal(ids.indexOf("git"), ids.indexOf("build") + 1, "The git board comes right after Watching a build");
  assert.equal(HELP_TABS[ids.indexOf("git")].label, "The git board");
  assert.equal(helpTabFor({ workflow: "git" }), "git");
  const tpl = helpTemplate();
  for (const id of ids) assert.match(tpl, new RegExp(`<section class="help-panel" data-tab="${id}">`), `${id} has a section`);
});

test("help: the template's icons and panels match HELP_TABS in order, headed by their labels", () => {
  const tpl = helpTemplate();
  const ids = HELP_TABS.map((t) => t.id);
  assert.deepEqual([...tpl.matchAll(/<symbol id="hi-([^"]+)"/g)].map((m) => m[1]), ids);
  const panels = [...tpl.matchAll(/<section class="help-panel" data-tab="([^"]+)">([\s\S]*?)<\/section>/g)];
  assert.deepEqual(panels.map((m) => m[1]), ids);
  assert.equal((tpl.match(/<section\b/g) || []).length, ids.length, "nothing but the panels");
  for (const [i, m] of panels.entries()) {
    const h3 = m[2].match(/<h3>([\s\S]*?)<\/h3>/);
    assert.ok(h3, `${m[1]} has a heading`);
    assert.ok(m[2].trimStart().startsWith("<h3>"), `${m[1]} starts with its heading`);
    assert.equal(h3[1].trim(), HELP_TABS[i].label);
  }
});

test("help: every diagram tab has one labeled picture, the rest none; no inline styles or scripts", () => {
  const tpl = helpTemplate();
  assert.doesNotMatch(tpl, /\sstyle=/);
  assert.doesNotMatch(tpl, /<script/i);
  // Colors come from CSS classes, so a drawing follows the theme and the tab.
  assert.doesNotMatch(tpl, /\s(fill|stroke)="(?!none")[^"]*"/, "no color literals in the drawings");
  const panels = new Map(
    [...tpl.matchAll(/<section class="help-panel" data-tab="([^"]+)">([\s\S]*?)<\/section>/g)].map((m) => [m[1], m[2]])
  );
  for (const t of HELP_TABS) {
    const body = panels.get(t.id);
    const figures = body.match(/class="help-figure\b/g) || [];
    if (!t.diagram) {
      assert.equal(figures.length, 0, `${t.id} has no diagram`);
      continue;
    }
    assert.equal(figures.length, 1, `${t.id} has one diagram`);
    assert.doesNotMatch(body, /<div class="help-figure"[^>]*><\/div>/, `${t.id}'s insertion point is filled`);
    if (t.id === "planny") {
      const fig = body.match(/<figure class="help-figure help-moods"[^>]*role="img"[^>]*aria-labelledby="hd-planny-title"/);
      assert.ok(fig, "the Planny moods are one labeled role=img figure");
      const label = body.match(/id="hd-planny-title"[^>]*>([^<]*)</);
      assert.ok(label && label[1].trim(), "the moods figure's label exists and says something");
      continue;
    }
    const svg = body.match(/<svg class="help-diagram"[^>]*>([\s\S]*?)<\/svg>/);
    assert.ok(svg, `${t.id} draws an svg diagram`);
    const open = svg[0].slice(0, svg[0].indexOf(">"));
    assert.match(open, /role="img"/, `${t.id}'s diagram is an image`);
    const labeled = open.match(/aria-labelledby="([^"]+)"/);
    assert.ok(labeled, `${t.id}'s diagram is labeled`);
    for (const id of labeled[1].split(/\s+/)) {
      const ref = svg[1].match(new RegExp(`<(title|desc) id="${id}">([\\s\\S]*?)</\\1>`));
      assert.ok(ref && ref[2].trim(), `${t.id}'s diagram has a non-empty #${id}`);
    }
    assert.match(svg[1], /<title\b/, `${t.id}'s diagram has a title`);
    assert.match(svg[1], /<desc\b/, `${t.id}'s diagram has a description`);
  }
});

test("help: helpTabFor opens on the tab for where the person is", () => {
  const cases = [
    [{ finished: true }, "finishing"],
    [{ finished: true, gone: true }, "finishing"],
    [{ view: "end" }, "finishing"],
    [{ view: "end", gone: true }, "finishing"],
    [{ gone: true }, "stuck"],
    [{ adrift: true }, "stuck"],
    [{ adrift: true, view: "ask" }, "stuck"],
    [{ view: "ask" }, "ask"],
    [{ view: "ask", dashboard: true }, "ask"],
    [{ view: "subagents" }, "subagents"],
    [{ view: "subagents", workflow: "implement" }, "subagents"],
    [{ dashboard: true }, "dashboard"],
    [{ dashboard: true, view: "overview" }, "dashboard"],
    [{ workspace: true }, "workspace"],
    [{ workspace: true, view: "ask" }, "workspace"],
    [{ finished: true, workspace: true }, "finishing"],
    [{ gone: true, workspace: true }, "stuck"],
    [{ dashboard: true, meterRed: true }, "meter"],
    [{ dashboard: true, meterRed: true, view: "ask" }, "ask"],
    [{ meterRed: true }, "about"],
    [{ view: "overview" }, "docs"],
    [{ view: "doc:plan" }, "docs"],
    [{ view: "doc:plan", workflow: "implement" }, "docs"],
    [{ workflow: "implement" }, "build"],
    [{ workflow: "implement-review" }, "build"],
    [{ workflow: "quick-task" }, "build"],
    [{ workflow: "git" }, "git"],
    [{ workflow: "git", view: "ask" }, "ask"],
    [{ workflow: "git", dashboard: true }, "dashboard"],
    [{ workflow: "plan", view: "questions" }, "about"],
    [{ view: undefined }, "about"],
    [{}, "about"],
  ];
  const ids = new Set(HELP_TABS.map((t) => t.id));
  for (const [where, want] of cases) {
    const got = helpTabFor(where);
    assert.equal(got, want, JSON.stringify(where));
    assert.ok(ids.has(got), `${got} is a real tab`);
  }
  assert.equal(helpTabFor(), "about");
});

test("help: helpKeyTarget moves, wraps and jumps", () => {
  const n = 14;
  const cases = [
    ["ArrowDown", 0, 1],
    ["ArrowRight", 0, 1],
    ["ArrowUp", 0, 13],
    ["ArrowLeft", 0, 13],
    ["Home", 0, 0],
    ["End", 0, 13],
    ["ArrowDown", 6, 7],
    ["ArrowRight", 6, 7],
    ["ArrowUp", 6, 5],
    ["ArrowLeft", 6, 5],
    ["Home", 6, 0],
    ["End", 6, 13],
    ["ArrowDown", 13, 0],
    ["ArrowRight", 13, 0],
    ["ArrowUp", 13, 12],
    ["ArrowLeft", 13, 12],
    ["Home", 13, 0],
    ["End", 13, 13],
  ];
  for (const [key, from, to] of cases) assert.equal(helpKeyTarget(key, from, n), to, `${key} from ${from}`);
  assert.equal(helpKeyTarget("a", 3, n), -1);
});

// A constant's value from source text, for files the test cannot import. Only
// products of integer literals are accepted, so nothing is ever evaluated.
const productOf = (expr) =>
  expr.split("*").reduce((acc, part) => {
    const p = part.trim();
    assert.match(p, /^\d+$/, `"${expr}" is a product of integer literals`);
    return acc * Number(p);
  }, 1);

const sourceConst = (file, re, what) => {
  const src = fs.readFileSync(path.join(ROOT, "src", "web-console", ...file.split("/")), "utf8");
  const m = src.match(re);
  assert.ok(m, `${file} defines ${what}`);
  return productOf(m[1]);
};

const helpFacts = () => ({
  chatLimit: CHAT_LIMIT,
  chatMaxChars: CHAT_MAX_CHARS,
  maxAttachments: MAX_ATTACHMENTS,
  maxDocMb: MAX_DOC_BYTES / 1024 / 1024,
  imageEdge: IMAGE_LONG_EDGE,
  cleanupDays: SESSION_MAX_AGE_MS / 86400000,
  goneSeconds: sourceConst("public/screens/core.js", /const GONE_AFTER_MS = ([^;]+);/, "GONE_AFTER_MS") / 1000,
  adriftMinutes: sourceConst("public/selectors.js", /const ADRIFT_MS = ([^;]+);/, "ADRIFT_MS") / 60000,
  maxUploadMb: sourceConst("public/uploads.js", /const MAX_UPLOAD_BYTES = ([^;]+);/, "MAX_UPLOAD_BYTES") / 1024 / 1024,
  idleMinutes: sourceConst("server.mjs", /const IDLE_MS = Number\(args\[[^\]]+\] \|\| ([^)]+)\)/, "IDLE_MS") / 60000,
  maxLifeHours: sourceConst("server.mjs", /const MAX_LIFE_MS = Number\(args\[[^\]]+\] \|\| ([^)]+)\)/, "MAX_LIFE_MS") / 3600000,
  closedTabMinutes: sourceConst("server.mjs", /\(IDLE_MS - ([^)]+)\)/, "the closed-tab shutdown") / 60000,
  accentCount: Object.keys(ACCENTS).length,
  // The one fact quoted as several numbers: each span holds one of the widths.
  cardWidths: new Set(Object.values(CARD_WIDTHS).map((w) => w.px)),
  meterYellow: YELLOW_AT,
  meterRed: RED_AT,
  remoteFold: REMOTE_FOLD,
});

test("help: every number the help quotes matches the code", () => {
  const tpl = helpTemplate();
  const facts = helpFacts();
  const spans = [...tpl.matchAll(/data-fact="([^"]+)">([^<]*)</g)];
  assert.ok(spans.length, "the help quotes at least one fact");
  assert.equal(
    (tpl.match(/data-fact=/g) || []).length,
    spans.length,
    'every data-fact is written <span data-fact="key">NUMBER</span>, so none escapes the check'
  );
  const quotedWidths = new Set();
  for (const [, key, value] of spans) {
    assert.ok(Object.hasOwn(facts, key), `data-fact "${key}" is a known fact`);
    assert.match(value, /^\d{1,3}(,\d{3})*$|^\d+$/, `data-fact "${key}" holds only a number`);
    const n = Number(value.replace(/,/g, ""));
    if (facts[key] instanceof Set) {
      assert.ok(facts[key].has(n), `data-fact "${key}" value ${n} is one of the code's values`);
      quotedWidths.add(n);
    } else {
      assert.equal(n, facts[key], `data-fact "${key}" matches the code`);
    }
  }
  const byNumber = (a, b) => a - b;
  assert.deepEqual(
    [...quotedWidths].sort(byNumber),
    [...facts.cardWidths].sort(byNumber),
    "the help quotes every card width"
  );
  const quoted = new Set(spans.map(([, key]) => key));
  for (const key of Object.keys(facts)) assert.ok(quoted.has(key), `the help quotes ${key} at least once`);
  const panels = new Map(
    [...tpl.matchAll(/<section class="help-panel" data-tab="([^"]+)">([\s\S]*?)<\/section>/g)].map((m) => [m[1], m[2]])
  );
  const firstEight = HELP_TABS.slice(0, 8).map((t) => panels.get(t.id)).join("\n");
  const used = [
    "closedTabMinutes",
    "maxLifeHours",
    "adriftMinutes",
    "goneSeconds",
    "maxAttachments",
    "maxDocMb",
    "imageEdge",
    "maxUploadMb",
    "cleanupDays",
  ];
  for (const key of used) assert.ok(firstEight.includes(`data-fact="${key}"`), `tabs 1 to 8 quote ${key}`);
});

/* ---------------------------------------------------------- image uploads */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const uploadJpeg = (name = "photo.jpg") =>
  raw("POST", "/upload", JPEG, { "content-type": "image/jpeg", "x-p2c-name": encodeURIComponent(name) });

test("an upload is stored under a server-chosen name inside the session's uploads, whatever the client calls it", async () => {
  const res = await uploadJpeg("../../evil name.png");
  assert.equal(res.status, 200);
  const { id, path: file, url, name } = res.json;
  assert.match(id, UUID);
  const uploads = path.join(fs.realpathSync.native(session), "uploads");
  assert.equal(path.dirname(file).toLowerCase(), uploads.toLowerCase());
  assert.equal(path.basename(file), id + ".jpg");
  assert.equal(url, `/uploads/${id}.jpg`);
  assert.equal(name, "../../evil name.png", "the name comes back as a label");
  assert.equal(res.json.kind, "image");
  assert.equal(res.json.size, JPEG.length);
  const split = (await uploadJpeg("two\nlines\t.jpg")).json;
  assert.equal(split.name, "two lines .jpg", "a label never carries a line break into the reply");
  assert.deepEqual(fs.readFileSync(file), JPEG);
  assert.ok(fs.readdirSync(uploads).every((f) => /^[0-9a-f-]{36}\.[a-z0-9]+$/.test(f)));
  const stray = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? stray(path.join(dir, e.name)) : /evil/.test(e.name) ? [e.name] : []
    );
  assert.deepEqual(stray(HOME), [], "no file carries the client's name anywhere");
});

test("an upload that is not a JPEG, or is too large, is refused", async () => {
  assert.equal((await raw("POST", "/upload", JPEG, { "content-type": "image/png" })).status, 415);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal((await raw("POST", "/upload", png, { "content-type": "image/jpeg" })).status, 415);
  const huge = Buffer.alloc(4 * 1024 * 1024 + 1, 0);
  JPEG.copy(huge, 0, 0, 4);
  assert.equal((await raw("POST", "/upload", huge, { "content-type": "image/jpeg" })).status, 413);
  assert.equal(
    (await raw("POST", "/upload", JPEG, { "content-type": "image/jpeg", origin: "http://evil.example.com" })).status,
    403
  );
});

test("an upload is served back by its own url, and nothing else under /uploads/ is", async () => {
  const { url } = (await uploadJpeg()).json;
  const res = await raw("GET", url);
  assert.equal(res.status, 200);
  assert.equal(res.headers["content-type"], "image/jpeg");
  assert.equal(res.headers["cache-control"], "private, max-age=86400");
  assert.deepEqual(res.body, JPEG);
  for (const p of ["/uploads/../state.json", "/uploads/%2e%2e/state.json", "/uploads/not-a-uuid.jpg"]) {
    assert.equal((await raw("GET", p)).status, 404, p);
  }
  assert.equal((await raw("GET", url, undefined, { cookie: "" })).status, 403);
});

test("deleting an upload removes its file, once, and only from this origin", async () => {
  const { url, path: file } = (await uploadJpeg()).json;
  assert.equal((await raw("DELETE", url, undefined, { origin: "http://evil.example.com" })).status, 403);
  assert.ok(fs.existsSync(file));
  assert.equal((await raw("DELETE", url)).status, 204);
  assert.equal(fs.existsSync(file), false);
  assert.equal((await raw("DELETE", url)).status, 404);
});

test("a send refuses comment images that are too many or not this session's uploads", async () => {
  const comment = (images) => ({ actions: [{ i: "q1", type: "comment", text: "See the pictures.", images }] });
  const six = Array.from({ length: 6 }, () => ({ path: "x.jpg", name: "x.jpg" }));
  assert.equal((await post("/submit", comment(six))).status, 400);

  const otherId = "0f0e0d0c-0b0a-4908-8706-050403020100";
  const other = path.join(HOME, "sessions", "20260101-000000-abcdef", "uploads");
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(path.join(other, otherId + ".jpg"), JPEG);
  assert.equal((await post("/submit", comment([{ path: path.join(other, otherId + ".jpg") }]))).status, 400);
  assert.equal((await post("/submit", comment([{ path: path.join(ROOT, otherId + ".jpg") }]))).status, 400);
  assert.equal((await post("/submit", comment([{ path: path.join(session, "state.json") }]))).status, 400);

  const a = (await uploadJpeg("a.jpg")).json;
  const b = (await uploadJpeg("b.jpg")).json;
  const ok = await post("/submit", comment([{ path: a.path, name: a.name }, { path: b.path, name: b.name }]));
  assert.equal(ok.status, 200);
  const res = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(res.status, 0, "collected, so the tests after this start with no send in flight");
  assert.equal(res.json.actions[0].images.length, 2);
});

test("a note with two images reaches the agent with both absolute paths, in the action and the reply", async () => {
  const a = (await uploadJpeg("first.png")).json;
  const b = (await uploadJpeg("second.png")).json;
  const images = [a, b].map((img) => ({ ...img, key: "local", status: "ready" }));
  const ok = await post("/submit", {
    actions: [noteAction("q1", "Gap here", images)],
    reply: noteReplyLines("Export format", "Gap here", images).join("\n"),
  });
  assert.equal(ok.status, 200);
  const res = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(res.status, 0);
  const note = res.json.actions.find((x) => x.type === "comment");
  assert.deepEqual(note.images, [
    { path: a.path, name: "first.png" },
    { path: b.path, name: "second.png" },
  ]);
  for (const img of note.images) assert.ok(path.isAbsolute(img.path), img.path);
  assert.match(res.json.reply, /^Note on Export format: Gap here$/m);
  assert.ok(res.json.reply.includes(`  Image: ${a.path} (first.png)`));
  assert.ok(res.json.reply.includes(`  Image: ${b.path} (second.png)`));
});

test("the sweep removes only the uploads of sessions untouched for 30 days, and never the one being opened", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-sweep-"));
  const old = (Date.now() - 31 * 24 * 60 * 60 * 1000) / 1000;
  const make = (name, stale) => {
    const d = path.join(dir, name);
    fs.mkdirSync(path.join(d, "uploads"), { recursive: true });
    fs.writeFileSync(path.join(d, "state.json"), "{}");
    fs.writeFileSync(path.join(d, "draft.json"), "{}");
    fs.writeFileSync(path.join(d, "uploads", "a.jpg"), JPEG);
    if (stale) fs.utimesSync(path.join(d, "state.json"), old, old);
    return d;
  };
  const stale = make("20250801-101010-aaaaaa", true);
  const fresh = make("20260920-101010-bbbbbb", false);
  const opening = make("20250801-101010-cccccc", true);
  const notSession = make("not-a-session", true);

  const swept = await sweepUploads(dir, Date.now(), UPLOAD_MAX_AGE_MS, "20250801-101010-cccccc");
  assert.deepEqual(swept, ["20250801-101010-aaaaaa"]);
  assert.equal(fs.existsSync(path.join(stale, "uploads")), false);
  for (const d of [fresh, opening, notSession]) assert.ok(fs.existsSync(path.join(d, "uploads", "a.jpg")), d);
  for (const d of [stale, fresh, opening, notSession]) {
    assert.ok(fs.existsSync(path.join(d, "state.json")), d);
    assert.ok(fs.existsSync(path.join(d, "draft.json")), d);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

/* ------------------------------------------------------- document uploads */

const MD = Buffer.from("# Retry spec\n\nBack off 3 times — then give up.\n", "utf8");
const uploadDoc = (name, buf, headers = {}) =>
  raw("POST", "/upload", buf, {
    "content-type": "application/octet-stream",
    "x-p2c-name": encodeURIComponent(name),
    ...headers,
  });

test("a document is stored under a server-chosen name with its own extension, and never gets a url", async () => {
  const uploads = path.join(fs.realpathSync.native(session), "uploads");
  for (const [name, buf, ext] of [
    ["retry spec.md", MD, "md"],
    ["API.PDF", PDF, "pdf"],
    ["../../evil.json", Buffer.from('{"a":1}'), "json"],
  ]) {
    const res = await uploadDoc(name, buf);
    assert.equal(res.status, 200, name);
    const { id, kind, path: file, name: label, size, url } = res.json;
    assert.match(id, UUID);
    assert.equal(kind, "file");
    assert.equal(url, undefined, "a document is never served, so it has no url");
    assert.equal(size, buf.length);
    assert.equal(label, name, "the name comes back as a label");
    assert.equal(path.dirname(file).toLowerCase(), uploads.toLowerCase());
    assert.equal(path.basename(file), `${id}.${ext}`);
    assert.deepEqual(fs.readFileSync(file), buf);
  }
  const split = (await uploadDoc("two\nlines.md", MD)).json;
  assert.equal(split.name, "two lines.md", "a label never carries a line break into the reply");
  const long = await uploadDoc("x".repeat(250) + ".md", MD);
  assert.equal(long.status, 200, "a name past the 200-character label keeps its extension");
  assert.equal(path.extname(long.json.path), ".md");
  assert.equal(long.json.name.length, 200);
});

test("a document that is the wrong type, lies about its type, or is too large is refused", async () => {
  const before = fs.readdirSync(path.join(fs.realpathSync.native(session), "uploads")).length;
  const refused = [
    ["report.docx", Buffer.from("PK\u0003\u0004")],
    ["notes", MD],
    [".env", Buffer.from("SECRET=1")],
    ["evil.md", Buffer.concat([MD, Buffer.from([0]), MD])],
    ["export.csv", Buffer.from([0x61, 0x2c, 0xc3, 0x28])],
    ["fake.pdf", Buffer.from("not a pdf at all")],
  ];
  for (const [name, buf] of refused) {
    const res = await uploadDoc(name, buf);
    assert.equal(res.status, 415, name);
    assert.equal(res.json.error, "type", name);
  }
  assert.equal((await raw("POST", "/upload", MD, { "content-type": "text/plain", "x-p2c-name": "a.md" })).status, 415);
  const huge = Buffer.alloc(10 * 1024 * 1024 + 1, 0x20);
  PDF.copy(huge, 0, 0, 5);
  assert.equal((await uploadDoc("big.pdf", huge)).status, 413);
  assert.equal(
    fs.readdirSync(path.join(fs.realpathSync.native(session), "uploads")).length,
    before,
    "nothing refused was written"
  );
  const five = Buffer.alloc(5 * 1024 * 1024, 0x20);
  PDF.copy(five, 0, 0, 5);
  assert.equal((await uploadDoc("five.pdf", five)).status, 200, "the document cap is not the 4 MB JSON cap");
  assert.equal((await uploadDoc("a.md", MD, { origin: "http://evil.example.com" })).status, 403);
});

test("a document is served back inline under a fixed type, and deleting it removes its file", async () => {
  const { id, path: file } = (await uploadDoc("spec.pdf", PDF)).json;
  const url = `/uploads/${id}.pdf`;
  const pdf = await raw("GET", url);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers["content-type"], "application/pdf");
  assert.equal(pdf.headers["x-content-type-options"], "nosniff");
  assert.equal(pdf.headers["content-security-policy"], undefined, "a sandboxed PDF cannot open in the viewer");
  assert.deepEqual(pdf.body, PDF);
  for (const [name, buf, type] of [
    ["page.html", Buffer.from("<script>fetch('/submit')</script>"), "text/plain; charset=utf-8"],
    ["logo.svg", MD, null],
    ["notes.md", MD, "text/plain; charset=utf-8"],
  ]) {
    const up = await uploadDoc(name, buf);
    if (!type) {
      assert.equal(up.status, 415, "an svg is not an allowed document");
      continue;
    }
    const text = await raw("GET", `/uploads/${up.json.id}.${name.split(".").pop()}`);
    assert.equal(text.status, 200, name);
    assert.equal(text.headers["content-type"], type, "text and code are never served as html");
    assert.equal(text.headers["content-security-policy"], "sandbox");
    assert.deepEqual(text.body, buf);
    assert.equal((await raw("DELETE", `/uploads/${up.json.id}.${name.split(".").pop()}`)).status, 204);
  }
  assert.equal((await raw("GET", url, undefined, { cookie: "" })).status, 403);
  for (const p of ["/uploads/../state.json.md", "/uploads/%2e%2e/x.pdf", "/uploads/not-a-uuid.md"]) {
    assert.equal((await raw("GET", p)).status, 404, p);
  }
  for (const p of ["/uploads/../state.json.md", "/uploads/%2e%2e/x.pdf", "/uploads/not-a-uuid.md"]) {
    assert.equal((await raw("DELETE", p)).status, 404, p);
  }
  assert.equal((await raw("DELETE", url, undefined, { origin: "http://evil.example.com" })).status, 403);
  assert.ok(fs.existsSync(file));
  assert.equal((await raw("DELETE", url)).status, 204);
  assert.equal(fs.existsSync(file), false);
  assert.equal((await raw("DELETE", url)).status, 404);
});

test("a send takes documents as files, counts them with images, and keeps each kind in its own list", async () => {
  const comment = (images, files) => ({ actions: [{ i: "q1", type: "comment", text: "See these.", images, files }] });
  const img = async () => {
    const j = (await uploadJpeg("shot.png")).json;
    return { path: j.path, name: j.name };
  };
  const doc = async (name, buf) => {
    const j = (await uploadDoc(name, buf)).json;
    return { path: j.path, name: j.name };
  };
  const i1 = await img();
  const i2 = await img();
  const i3 = await img();
  const d1 = await doc("a.md", MD);
  const d2 = await doc("b.pdf", PDF);
  const d3 = await doc("c.json", Buffer.from("{}"));

  assert.equal((await post("/submit", comment([i1, i2, i3], [d1, d2, d3]))).status, 400, "six in all is too many");
  assert.equal((await post("/submit", comment(undefined, [i1]))).status, 400, "an image is not a file");
  assert.equal((await post("/submit", comment([d1], undefined))).status, 400, "a file is not an image");
  const otherId = "0f0e0d0c-0b0a-4908-8706-050403020101";
  const other = path.join(HOME, "sessions", "20260101-000000-abcdef", "uploads");
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(path.join(other, otherId + ".md"), MD);
  assert.equal((await post("/submit", comment(undefined, [{ path: path.join(other, otherId + ".md") }]))).status, 400);

  const attachments = [
    { ...i1, kind: "image" },
    { ...d1, kind: "file" },
    { ...i2, kind: "image" },
    { ...d2, kind: "file" },
    { ...d3, kind: "file" },
  ];
  const ok = await post("/submit", {
    actions: [noteAction("q1", "", attachments)],
    reply: noteReplyLines("Export format", "", attachments).join("\n"),
  });
  assert.equal(ok.status, 200);
  const res = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(res.status, 0);
  const note = res.json.actions.find((x) => x.type === "comment");
  assert.deepEqual(note.images, [i1, i2]);
  assert.deepEqual(note.files, [d1, d2, d3]);
  assert.match(res.json.reply, /^Note on Export format: \(attachments only\)$/m);
  assert.ok(res.json.reply.includes(`  File: ${d1.path} (a.md)`));
  assert.ok(res.json.reply.includes(`  File: ${d2.path} (b.pdf)`));
  assert.ok(res.json.reply.includes(`  Image: ${i1.path} (shot.png)`));
});

test("a result is consumed only once", () => {
  const res = cli(["wait", "--session", sid, "--seconds", "3"]);
  assert.equal(res.status, 10, "an already-consumed result must not be handed over twice");
});

test("a send records its note and attachments on the item, so the page can show them after a reload", async () => {
  const readState = () => JSON.parse(fs.readFileSync(path.join(HOME, "sessions", sid, "state.json"), "utf8"));
  const j = (await uploadJpeg("shot.png")).json;
  const d = (await uploadDoc("spec.pdf", PDF)).json;
  const atts = [
    { path: j.path, name: j.name, kind: "image" },
    { path: d.path, name: d.name, kind: "file" },
  ];
  const ok = await post("/submit", {
    actions: [{ i: "q1", type: "answer", kind: "choice", k: "B" }, noteAction("q1", "see these", atts)],
    reply: "x",
  });
  assert.equal(ok.status, 200);
  const q1 = readState().items.find((i) => i.id === "q1");
  assert.equal(q1.submitted.k, "B");
  assert.equal(q1.submitted.images, undefined, "the answer record stays the answer");
  assert.ok(q1.sentNote.at);
  assert.equal(q1.sentNote.at, q1.submitted.at, "one send, one clock reading");
  assert.equal(q1.sentNote.text, "see these");
  assert.deepEqual(q1.sentNote.images, [{ path: j.path, name: j.name }]);
  assert.deepEqual(q1.sentNote.files, [{ path: d.path, name: d.name }]);
  // Earlier tests in this session sent notes on q1 too: the newest is this one.
  const mine = q1.thread.filter((m) => m.who === "user").at(-1);
  assert.equal(mine.text, "see these", "the note goes into the Notes thread, where the agent's reply will sit under it");
  assert.equal(mine.at, q1.sentNote.at);
  assert.deepEqual(mine.images, [{ path: j.path, name: j.name }]);
  assert.equal(cli(["wait", "--session", sid, "--seconds", "10"]).status, 0);

  const only = await post("/submit", { actions: [noteAction("q1", "just a note", [])], reply: "y" });
  assert.equal(only.status, 200);
  const after = readState().items.find((i) => i.id === "q1");
  assert.equal(after.sentNote.text, "just a note");
  assert.deepEqual(after.sentNote.images ?? [], []);
  assert.deepEqual(
    after.thread.filter((m) => m.who === "user").map((m) => m.text).slice(-2),
    ["see these", "just a note"],
    "every note stays in the thread, not just the latest one",
  );
  assert.equal(cli(["wait", "--session", sid, "--seconds", "10"]).status, 0);
});

test("what the person attached is not scanned for markers either", () => {
  const statePath = path.join(HOME, "sessions", sid, "state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  state.items.find((i) => i.id === "q1").sentNote = { at: new Date().toISOString(), text: "TASK_COMPLETE Risk 3" };
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  const res = cli(["post", "--session", sid, "--file", payload("after2.json", { headline: { stage: "Working" } })]);
  assert.equal(res.status, 0);
});

test("cancel surfaces as exit 30", async () => {
  await post("/cancel", {});
  const res = cli(["wait", "--session", sid, "--seconds", "5"]);
  assert.equal(res.status, 30);
});

/* ------------------------------------------------------------ guardrails */

test("rejects more than three open required questions", () => {
  const many = {
    items: [1, 2, 3, 4].map((n) => ({ id: "x" + n, kind: "text", title: "Question " + n, body: "b" })),
  };
  const res = cli(["post", "--session", sid, "--file", payload("many.json", many)], { expectFail: true });
  assert.equal(res.status, 3);
  assert.match(res.stderr, /open at once/);
});

test("rejects internal vocabulary in a title", () => {
  const p = { items: [{ id: "j1", kind: "text", title: "Frontier grill posture", body: "b", required: false }] };
  const res = cli(["post", "--session", sid, "--file", payload("jargon.json", p)], { expectFail: true });
  assert.equal(res.status, 3);
  assert.match(res.stderr, /internal vocabulary/);
});

// Menu options carry `text`, verdicts carry `label`. An agent that crosses
// them used to get a sign-off card with blank buttons, so the post is refused
// with the fix spelled out.
test("rejects a review verdict with no label", () => {
  const p = {
    items: [
      {
        id: "v1",
        kind: "review",
        title: "Approve the tech stack",
        verdicts: [
          { id: "approve", text: "Approve the tech stack" },
          { id: "changes", label: "Needs changes" },
        ],
        required: false,
      },
    ],
  };
  const res = cli(["post", "--session", sid, "--file", payload("verdict.json", p)], { expectFail: true });
  assert.equal(res.status, 3);
  assert.match(res.stderr, /verdict "approve" needs a "label"/);
  assert.doesNotMatch(res.stderr, /verdict "changes"/);
});

test("rejects a choice option with no text", () => {
  const p = {
    items: [
      {
        id: "o1",
        kind: "choice",
        title: "Where should we go next",
        options: [
          { k: "A", label: "Reproduce first", desc: "Run it" },
          { k: "B", text: "Plan the fixes", detail: "Write a plan" },
        ],
        required: false,
      },
    ],
  };
  const res = cli(["post", "--session", sid, "--file", payload("option.json", p)], { expectFail: true });
  assert.equal(res.status, 3);
  assert.match(res.stderr, /option "A" needs "text"/);
  assert.doesNotMatch(res.stderr, /option "B"/);
});

test("rejects loop completion markers and metrics-scraper bait", () => {
  const p = {
    items: [{ id: "j2", kind: "text", title: "Coverage", body: "Requirements 22 of 25. TASK_COMPLETE", required: false }],
  };
  const res = cli(["post", "--session", sid, "--file", payload("bait.json", p)], { expectFail: true });
  assert.equal(res.status, 3);
  assert.match(res.stderr, /completion marker/);
  assert.match(res.stderr, /metrics collector/);
});

// Those two scans read agent-authored text. A person who happens to type
// "TASK_COMPLETE" into an answer must not wedge the session by making every
// later patch unpostable.
test("what the person typed is not scanned for markers", () => {
  const dir = path.join(HOME, "sessions", sid);
  const statePath = path.join(dir, "state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  state.items.find((i) => i.id === "q1").submitted = {
    at: new Date().toISOString(),
    text: "Risk 3 if this is not done before TASK_COMPLETE",
  };
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  const res = cli(["post", "--session", sid, "--file", payload("after.json", { headline: { stage: "Working" } })]);
  assert.equal(res.status, 0);
});

test("rejects two recommended options", () => {
  const p = {
    items: [
      {
        id: "j3",
        kind: "choice",
        title: "Storage",
        body: "b",
        required: false,
        options: [
          { k: "A", text: "one", recommended: true },
          { k: "B", text: "two", recommended: true },
        ],
      },
    ],
  };
  const res = cli(["post", "--session", sid, "--file", payload("recs.json", p)], { expectFail: true });
  assert.equal(res.status, 3);
  assert.match(res.stderr, /recommended/);
});

test("rejects a second authoritative gate", () => {
  const p = {
    items: [
      { id: "g1", kind: "review", title: "Sign off A", body: "b", required: false, gate: { id: "a", authoritative: true } },
      { id: "g2", kind: "review", title: "Sign off B", body: "b", required: false, gate: { id: "b", authoritative: true } },
    ],
  };
  const res = cli(["post", "--session", sid, "--file", payload("gates.json", p)], { expectFail: true });
  assert.equal(res.status, 3);
  assert.match(res.stderr, /authoritative approval gates/);
});

test("a rejected patch leaves the state untouched", () => {
  const before = fs.readFileSync(path.join(session, "state.json"), "utf8");
  cli(["post", "--session", sid, "--file", payload("many2.json", {
    items: [1, 2, 3, 4, 5].map((n) => ({ id: "y" + n, kind: "text", title: "Q" + n, body: "b" })),
  })], { expectFail: true });
  assert.equal(fs.readFileSync(path.join(session, "state.json"), "utf8"), before);
});

test("rejects __proto__ in a patch", () => {
  const p = path.join(HOME, "proto.json");
  fs.writeFileSync(p, '{"agent":{"__proto__":{"polluted":true}}}');
  const res = cli(["post", "--session", sid, "--file", p], { expectFail: true });
  assert.notEqual(res.status, 0);
  assert.equal({}.polluted, undefined);
});

/* --------------------------------------------------------------- merge */

test("patches merge by id and append threads", () => {
  cli(["post", "--session", sid, "--file", payload("merge.json", {
    items: [{ id: "q1", status: "answered", thread: [{ who: "agent", text: "noted" }] }],
  })]);
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  const q1 = state.items.find((i) => i.id === "q1");
  assert.equal(q1.status, "answered");
  assert.equal(q1.title, "Export format", "untouched fields survive a merge");
  const replies = q1.thread.filter((m) => m.who === "agent");
  assert.equal(replies.length, 1);
  assert.ok(replies[0].at, "the server stamps the time the agent left out");
});

test("finish.changelog is accepted on quick-task and finalize, and refused on implement and on a non-boolean", () => {
  const problems = (workflow, changelog, headline = "Done") =>
    validate({ workflow, items: [], finish: { headline, command: "git add -A", commit: true, changelog } });
  for (const workflow of ["quick-task", "finalize"]) assert.deepEqual(problems(workflow, true), [], workflow);
  assert.match(problems("implement", true).join(), /only for a finished quick-task or finalize/);
  assert.match(problems("implement-review", true).join(), /only for a finished quick-task or finalize/);
  assert.match(problems("quick-task", "yes").join(), /must be true or false/);
  // false is always fine, and a pause ignores it
  assert.deepEqual(problems("implement", false), []);
  assert.deepEqual(problems("implement", true, "Paused at Phase 2"), []);
});

// Update CHANGELOG first is a hop like Commit it now, into Changelog.
test("a changelog request from a finished screen carries the resume into the changelog workflow and its skill file", async () => {
  await post("/submit", {
    actions: [{ i: "__changelog", type: "changelog" }],
    reply: "Update the CHANGELOG before I commit: open Changelog, right here in this session.",
  });
  const res = cli(["wait", "--session", sid, "--seconds", "10"]);
  assert.equal(res.status, 0);
  assert.equal(res.json.actions[0].i, "__changelog");
  assert.match(res.json.resume, /--no-open --workflow changelog$/);
  const state = JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));
  assert.ok(state.items.every((i) => i.id !== "__changelog"), "a changelog request must not become a question");
});

test("a thread reply in another shape is lifted into { who, text }, and an empty one is refused", () => {
  const base = { items: [{ id: "n1", kind: "text", title: "Name", status: "open", thread: [{ who: "user", text: "why?", at: "2026-10-05T10:00:00Z" }] }] };
  const next = applyPatch(base, {
    items: [{ id: "n1", thread: [
      { from: "agent", md: "Because." },
      { role: "assistant", content: "Also this." },
      { who: "user", text: "why?" },
    ] }],
  });
  const thread = next.items[0].thread;
  assert.deepEqual(thread.map((m) => [m.who, m.text]), [["user", "why?"], ["agent", "Because."], ["agent", "Also this."]],
    "aliases lifted, and the echoed note is not shown twice");
  assert.equal(thread[1].md, undefined);
  assert.equal(thread[1].from, undefined);
  assert.throws(() => applyPatch(base, { items: [{ id: "n1", thread: [{ who: "agent" }] }] }), /thread entry has no "text"/);
  assert.throws(() => applyPatch(base, { items: [{ id: "n1", thread: [{ who: "agent", md: "  " }] }] }), /no "text"/);
});

test("the page reads older { from, md } thread entries", () => {
  assert.equal(threadWho({ from: "agent", md: "x" }), "agent");
  assert.equal(threadWho({ who: "user", text: "x" }), "user");
  assert.equal(threadText({ from: "agent", md: "Older shape." }), "Older shape.");
  assert.equal(threadText({ who: "agent", text: "Now." }), "Now.");
  assert.equal(threadText({ who: "agent" }), "");
});
