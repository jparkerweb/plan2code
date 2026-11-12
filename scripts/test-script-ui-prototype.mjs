// Tests for plan2code-ui-prototype's scripts/ui-prototype.mjs: assemble turns a
// round folder into one page around the shipped shell, unpackPage reads it
// back, and check reports every broken contract rule by rule and variant. See
// skill-script-helpers.mjs for how these run (from the built skills/ tree).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, SKILLS, runScript, tmp, copyFixture, fixtureCleanup } from "./skill-script-helpers.mjs";

const madeDirs = [];
after(() => {
  fixtureCleanup();
  for (const dir of madeDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A temp folder removed when the suite ends. */
function scratch(name) {
  const dir = tmp(name);
  madeDirs.push(dir);
  return dir;
}

const SCRIPTS = path.join(SKILLS, "plan2code-ui-prototype", "scripts");
const { unpackPage, placeholderUrl } = await import(pathToFileURL(path.join(SCRIPTS, "ui-prototype-page.mjs")).href);
const { projectKey } = await import(pathToFileURL(path.join(SCRIPTS, "ui-prototype-drafts.mjs")).href);
const { notepadKey } = await import(pathToFileURL(path.join(ROOT, "src", "web-console", "notepads.mjs")).href);
const FIXTURES = path.join(ROOT, "scripts", "fixtures", "ui-prototype");

const proto = (args) => runScript("plan2code-ui-prototype", "ui-prototype.mjs", args);

/** A fresh copy of a fixture round as <temp>/round-1; returns the round folder. */
function roundFrom(name) {
  const dir = copyFixture("ui-prototype", name, (into) => fs.cpSync(path.join(FIXTURES, name), path.join(into, "round-1"), { recursive: true }));
  return path.join(dir, "round-1");
}

/** Assemble a fixture and return { r, html, round }. */
function assembled(name) {
  const round = roundFrom(name);
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, `${name}: ${r.stdout} ${r.stderr}`);
  return { r, round, html: fs.readFileSync(r.json.file, "utf8") };
}

const variantText = (name, file) => fs.readFileSync(path.join(FIXTURES, name, file), "utf8");
const roundJson = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name, "round.json"), "utf8"));
const GOOD = ["good-screen", "good-flow", "good-terminal"];

/* ------------------------------------------------------------- help, usage */

test("ui-prototype --help names every command and the exit codes", () => {
  const r = proto(["--help"]);
  assert.equal(r.code, 0, r.stderr);
  for (const command of ["sweep", "new-round", "assemble", "check", "open", "read-block", "save"]) {
    assert.match(r.stdout, new RegExp(`ui-prototype\\.mjs ${command}\\b`), command);
  }
  for (const exit of ["0 ok", "1 crash", "2 bad arguments", "3 not found", "4 invalid", "5 refused"]) assert.ok(r.stdout.includes(exit), exit);
});

test("ui-prototype: an unknown command and a missing one exit 2", () => {
  for (const args of [["frobnicate"], []]) {
    const r = proto(args);
    assert.equal(r.code, 2, args.join(" "));
    assert.equal(r.json.error, "unknown-command");
  }
});

test("ui-prototype: assemble and check without their flag exit 2", () => {
  assert.equal(proto(["assemble"]).code, 2);
  assert.equal(proto(["check"]).code, 2);
});

/* ---------------------------------------------------------------- assemble */

for (const name of GOOD) {
  test(`assemble ${name}: one page beside the round folder, with its parts`, () => {
    const { r, round, html } = assembled(name);
    const facts = roundJson(name);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.file, path.join(path.dirname(round), `${facts.name}-round-${facts.round}.html`));
    assert.equal(r.json.bytes, Buffer.byteLength(html, "utf8"));
    assert.deepEqual(r.json.warnings, []);
    const whats = r.json.parts.map((p) => p.what);
    assert.deepEqual([...whats].sort(), ["shell", "base stylesheet", ...facts.variants.map((v) => `variant ${v.letter}`), "round facts"].sort());
    // Largest first.
    for (let i = 1; i < r.json.parts.length; i++) assert.ok(r.json.parts[i - 1].bytes >= r.json.parts[i].bytes, whats.join(", "));
    for (const p of r.json.parts) assert.ok(Number.isInteger(p.bytes) && p.bytes > 0, p.what);
    // Only the page was added: the round folder holds what it held.
    assert.deepEqual(fs.readdirSync(path.dirname(round)).sort(), [`${facts.name}-round-${facts.round}.html`, "round-1"].sort());
  });

  test(`assemble ${name}: one sandboxed frame per variant, the policy line, nothing outside data:`, () => {
    const { html } = assembled(name);
    const facts = roundJson(name);
    const frames = [...html.matchAll(/<iframe class="p2c-frame" data-variant="([A-E])" sandbox="allow-same-origin" srcdoc="/g)].map((m) => m[1]);
    assert.deepEqual(frames, facts.variants.map((v) => v.letter));
    assert.equal((html.match(/<iframe\b/g) || []).length, facts.variants.length);
    assert.ok(
      html.includes(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">`),
      "policy line"
    );
    assert.doesNotMatch(html, /https?:/i);
    assert.doesNotMatch(html, /@import/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/gi)) assert.match(m[1], /^["']?\s*(data:|#)/, m[0]);
    // The placeholders are all filled.
    assert.doesNotMatch(html, /<!-- p2c:(tool-styles|frames|script) -->/);
  });
}

test("assemble from inside a host skill: Plan's carried ui-prototype.mjs finds the shell in its own references and builds the same page", () => {
  const shell = path.join(SKILLS, "plan2code-1-plan", "references", "ui-prototype-shell");
  assert.ok(fs.statSync(shell).isDirectory(), `${shell} is missing: the ride-along did not land in Plan`);
  const own = assembled("good-screen");
  const round = roundFrom("good-screen");
  const r = runScript("plan2code-1-plan", "ui-prototype.mjs", ["assemble", "--round", round]);
  assert.equal(r.code, 0, `${r.stdout} ${r.stderr}`);
  assert.equal(r.json.ok, true);
  assert.deepEqual(r.json.warnings, []);
  assert.equal(fs.readFileSync(r.json.file, "utf8").replace(own.r.json.file, ""), own.html.replace(own.r.json.file, ""));
});

test("assemble writes each frame's root attributes from the shared and the variant's own starts", () => {
  const { html } = assembled("good-terminal");
  const page = unpackPage(html);
  assert.match(page.frames.A.doc, /^<!doctype html><html lang="en" data-p2c-theme="dark" data-p2c-state="ready" data-p2c-length="typical" data-p2c-kind="terminal">/);
  assert.match(page.frames.A.doc, /<meta charset="utf-8"><style>/);
  const base = fs.readFileSync(path.join(SKILLS, "plan2code-ui-prototype", "references", "ui-prototype-shell", "base.css"), "utf8");
  assert.ok(page.frames.B.doc.includes(base), "base.css sits inside every frame");
});

test("a variant's own theme, state and length starts reach its frame's root; the others keep the shared ones", () => {
  const round = roundFrom("good-screen");
  const file = path.join(round, "round.json");
  const facts = JSON.parse(fs.readFileSync(file, "utf8"));
  facts.variants[1].starts = { ...facts.variants[1].starts, theme: "dark", state: "empty", length: "long" };
  fs.writeFileSync(file, JSON.stringify(facts));
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, r.stderr);
  const page = unpackPage(fs.readFileSync(r.json.file, "utf8"));
  assert.match(page.frames.B.doc, /<html lang="en" data-p2c-theme="dark" data-p2c-state="empty" data-p2c-length="long" data-p2c-kind="screen">/);
  for (const letter of ["A", "C"]) {
    assert.match(page.frames[letter].doc, /<html lang="en" data-p2c-theme="light" data-p2c-state="ready" data-p2c-length="typical" data-p2c-kind="screen">/);
  }
});

test("variant text holding the shell's placeholder comments assembles and round-trips", () => {
  const round = roundFrom("hostile-text");
  const file = path.join(round, "variant-a.html");
  const text = fs.readFileSync(file, "utf8") + "<style>/* <!-- p2c:script --> */</style><p><!-- p2c:frames --><!-- p2c:tool-styles --></p>";
  fs.writeFileSync(file, text);
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, `${r.stdout} ${r.stderr}`);
  const page = unpackPage(fs.readFileSync(r.json.file, "utf8"));
  assert.equal(page.frames.A.content, text);
  assert.equal(page.facts.name, roundJson("hostile-text").name);
});

test("assemble escapes the round facts: no < inside the facts script", () => {
  const round = roundFrom("good-screen");
  const file = path.join(round, "round.json");
  const facts = JSON.parse(fs.readFileSync(file, "utf8"));
  facts.request = "Show </script><script>alert(1)</script> as text";
  fs.writeFileSync(file, JSON.stringify(facts));
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, r.stderr);
  const html = fs.readFileSync(r.json.file, "utf8");
  const script = html.match(/<script type="application\/json" id="p2c-round">([\s\S]*?)<\/script>/)[1];
  assert.ok(!script.includes("<"), "no raw < in the facts");
  assert.equal(unpackPage(html).facts.request, facts.request);
});

/* -------------------------------------------------------------- unpackPage */

for (const name of [...GOOD, "hostile-text"]) {
  test(`unpackPage returns ${name}'s variants byte for byte and its facts`, () => {
    const { html } = assembled(name);
    const facts = roundJson(name);
    const page = unpackPage(html);
    // assemble records whether the app font is in the page; these rounds list no fonts.
    assert.deepEqual(page.facts, { ...facts, appFont: false });
    assert.deepEqual(Object.keys(page.frames).sort(), facts.variants.map((v) => v.letter));
    for (const v of facts.variants) assert.equal(page.frames[v.letter].content, variantText(name, v.file), v.letter);
  });
}

test("hostile text keeps the page's structure intact", () => {
  const { html } = assembled("hostile-text");
  const hostile = variantText("hostile-text", "variant-a.html");
  for (const s of ['"', "&", "<", ">", "</script>", '"></iframe>']) assert.ok(hostile.includes(s), `the fixture holds ${s}`);
  // Counted outside the srcdoc values, where a quoted attribute may hold any
  // text but a raw " (the hostile text's own "></iframe> sits there legally).
  const tags = html.replace(/srcdoc="[^"]*"/g, 'srcdoc=""');
  assert.equal((tags.match(/<iframe\b/g) || []).length, 3);
  assert.equal((tags.match(/<\/iframe>/g) || []).length, 3);
  assert.equal((tags.match(/<script\b/g) || []).length, 2);
  // Inside the srcdoc attribute no raw double quote can end it early.
  const a = html.match(/data-variant="A" sandbox="allow-same-origin" srcdoc="([^"]*)"><\/iframe>/);
  assert.ok(a, "frame A's attribute runs to its own closing tag");
  assert.equal(unpackPage(html).frames.A.content, hostile);
});

test("unpackPage returns null for a page with no round facts", () => {
  assert.equal(unpackPage("<!doctype html><p>not a prototype</p>"), null);
});

/* ------------------------------------------------------------------- check */

for (const name of [...GOOD, "hostile-text"]) {
  test(`check passes ${name} with exit 0`, () => {
    const { r } = assembled(name);
    const c = proto(["check", "--file", r.json.file]);
    assert.equal(c.code, 0, c.stdout);
    assert.deepEqual(c.json, { ok: true, findings: [], bytes: r.json.bytes, overCeiling: false });
  });
}

test("the contract reference's example variant is the contract-example fixture's variant A, and that round passes check", () => {
  const contract = fs.readFileSync(path.join(SKILLS, "plan2code-ui-prototype", "references", "ui-prototype-contract.md"), "utf8");
  const section = contract.split(/^## 10\. Writing a round$/m)[1];
  assert.ok(section, "the contract has a '## 10. Writing a round' section");
  const shown = section.match(/```html\n([\s\S]*?)```/);
  assert.ok(shown, "the section shows an html example");
  assert.equal(shown[1], variantText("contract-example", "variant-a.html"));
  const { r } = assembled("contract-example");
  const c = proto(["check", "--file", r.json.file]);
  assert.equal(c.code, 0, c.stdout);
  assert.deepEqual(c.json.findings, []);
});

const BROKEN = [
  ["bad-outside-link", "outside-link", "B"],
  ["bad-script", "script", "B"],
  ["bad-state-missing", "state-missing", "A"],
  ["bad-length-missing", "length-missing", "C"],
  ["bad-value-unused", "value-unused", "B"],
  ["bad-step-missing", "step-missing", "B"],
];

for (const [name, rule, variant] of BROKEN) {
  test(`check reports ${name} as ${rule} in variant ${variant}, and nothing else`, () => {
    const { r } = assembled(name);
    const c = proto(["check", "--file", r.json.file]);
    assert.equal(c.code, 4, c.stdout);
    assert.equal(c.json.ok, false);
    assert.equal(c.json.findings.length, 1, JSON.stringify(c.json.findings));
    const [f] = c.json.findings;
    assert.equal(f.rule, rule);
    assert.equal(f.variant, variant);
    assert.equal(typeof f.message, "string");
    assert.ok(f.message.length > 10);
  });
}

test("check: a terminal variant is held to the palette and density values, not fonts and corners", () => {
  const round = roundFrom("good-terminal");
  const file = path.join(round, "variant-b.html");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("line-height: var(--p2c-density); ", ""));
  const r = proto(["assemble", "--round", round]);
  const c = proto(["check", "--file", r.json.file]);
  assert.equal(c.code, 4);
  assert.deepEqual(c.json.findings.map((f) => [f.rule, f.variant]), [["value-unused", "B"]]);
  assert.match(c.json.findings[0].message, /density/);
});

test("check: inline SVG with xmlns and url(#id) is not an outside link; a // src is", () => {
  const round = roundFrom("good-screen");
  const file = path.join(round, "variant-a.html");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect fill="url(#g)" width="8" height="8"/></svg>';
  fs.writeFileSync(file, fs.readFileSync(file, "utf8") + svg);
  let r = proto(["assemble", "--round", round]);
  assert.equal(proto(["check", "--file", r.json.file]).code, 0);
  fs.writeFileSync(file, fs.readFileSync(file, "utf8") + '<img src="//cdn.example.com/a.png" alt="">');
  r = proto(["assemble", "--round", round]);
  const c = proto(["check", "--file", r.json.file]);
  assert.equal(c.code, 4);
  assert.deepEqual(c.json.findings.map((f) => [f.rule, f.variant]), [["outside-link", "A"]]);
});

/** Check good-screen with `extra` appended to variant A (and `edit` applied first); returns the findings as [rule, variant]. */
function checkWith(extra, edit = (t) => t) {
  const round = roundFrom("good-screen");
  const file = path.join(round, "variant-a.html");
  fs.writeFileSync(file, edit(fs.readFileSync(file, "utf8")) + extra);
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, r.stdout);
  const c = proto(["check", "--file", r.json.file]);
  assert.equal(c.code, c.json.findings.length ? 4 : 0);
  return c.json.findings.map((f) => [f.rule, f.variant]);
}

test("check: every kind of script is reported, wherever the handler sits in the tag", () => {
  for (const extra of [
    "<script>pay()</script>",
    '<a href="javascript:pay()">Pay</a>',
    '<svg/onload="pay()"></svg>',
    '<p title="a > b" onclick="pay()">Pay</p>',
    "<button onclick=pay()>Pay</button>",
  ]) {
    assert.deepEqual(checkWith(extra), [["script", "A"]], extra);
  }
  // Text that only reads like a handler is not one.
  assert.deepEqual(checkWith("<p>Turn on = off</p>"), []);
});

test("check: a // URL is reported wherever one can begin", () => {
  for (const extra of [
    '<img srcset="data:image/png;base64,AA 1x, //cdn.example.com/b.png 2x" alt="">',
    '<meta http-equiv="refresh" content="0;url=//example.com/x">',
    `<p style='background-image: image-set("//cdn.example.com/a.png" 1x)'>x</p>`,
  ]) {
    assert.deepEqual(checkWith(extra), [["outside-link", "A"]], extra);
  }
});

test("check: file:// URLs and // URLs to a dotless host are reported; plain text that only looks like one is not", () => {
  for (const extra of [
    '<img src="//localhost/a.png" alt="">',
    '<iframe src="file:///C:/Windows/win.ini"></iframe>',
    '<object data="file:///etc/passwd"></object>',
    "<p style=\"background: image-set('//intranet/a.png' 1x)\">x</p>",
  ]) {
    assert.deepEqual(checkWith(extra), [["outside-link", "A"]], extra);
  }
  assert.deepEqual(checkWith("<p>Attach file: invoice.pdf. //TODO later</p>"), []);
});

test("check: a handler on a tag written inside an svg style block is reported", () => {
  assert.deepEqual(checkWith('<svg width="8" height="8"><style><img src=x onerror=pay()></style></svg>'), [["script", "A"]]);
  // In an ordinary style block the same text is CSS, not markup.
  assert.deepEqual(checkWith("<style>/* <img src=x onerror=pay()> */</style>"), []);
});

test("check: an outside link in the page around the frames is reported with no variant", () => {
  const { html, r } = assembled("good-screen");
  const at = html.lastIndexOf("</body>");
  fs.writeFileSync(r.json.file, html.slice(0, at) + '<img src="https://example.com/t.png" alt="">' + html.slice(at));
  const c = proto(["check", "--file", r.json.file]);
  assert.equal(c.code, 4, c.stdout);
  assert.deepEqual(c.json.findings.map((f) => [f.rule, f.variant]), [["outside-link", null]]);
});

test("check: a variant whose frame is gone from the page is reported as frame-missing", () => {
  const { html, r } = assembled("good-screen");
  const cut = html.replace(/<iframe class="p2c-frame" data-variant="B"[\s\S]*?<\/iframe>/, "");
  assert.notEqual(cut, html, "frame B was removed");
  fs.writeFileSync(r.json.file, cut);
  const c = proto(["check", "--file", r.json.file]);
  assert.equal(c.code, 4, c.stdout);
  assert.deepEqual(c.json.findings.map((f) => [f.rule, f.variant]), [["frame-missing", "B"]]);
});

test("check: marks count on elements only, quoted or not, never in the style block", () => {
  const dropLoading = (t) => t.replace('  <p data-p2c-when="loading">Loading invoices...</p>\n', "");
  // A CSS selector naming the state does not draw it.
  assert.deepEqual(checkWith("<style>[data-p2c-when=\"loading\"] { opacity: .6; }</style>", dropLoading), [["state-missing", "A"]]);
  // An unquoted mark does.
  assert.deepEqual(checkWith("<p data-p2c-when=loading>Loading...</p>", dropLoading), []);
});

test("check: a flow step named only in CSS is not a step", () => {
  const round = roundFrom("bad-step-missing");
  const file = path.join(round, "variant-b.html");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8") + '<style>[data-p2c-step="2. Team"] { color: red; }</style>');
  const r = proto(["assemble", "--round", round]);
  const c = proto(["check", "--file", r.json.file]);
  assert.deepEqual(c.json.findings.map((f) => [f.rule, f.variant]), [["step-missing", "B"]]);
});

test("a page over the 5 MB soft ceiling: assemble warns naming the largest part, check sets overCeiling and passes", () => {
  const round = roundFrom("good-screen");
  const file = path.join(round, "variant-b.html");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8") + `<p hidden>${"x".repeat(5.5 * 1024 * 1024)}</p>`);
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(r.json.bytes > 5 * 1024 * 1024);
  assert.equal(r.json.warnings.length, 1);
  assert.match(r.json.warnings[0], /5 MB soft ceiling.*variant B/);
  const c = proto(["check", "--file", r.json.file]);
  assert.equal(c.code, 0, c.stdout);
  assert.equal(c.json.overCeiling, true);
  assert.deepEqual(c.json.findings, []);
});

test("check: a missing page exits 3 and a page that is not a prototype exits 4", () => {
  const dir = scratch("ui-prototype-check");
  assert.equal(proto(["check", "--file", path.join(dir, "nope.html")]).code, 3);
  const other = path.join(dir, "other.html");
  fs.writeFileSync(other, "<!doctype html><p>hello</p>");
  const c = proto(["check", "--file", other]);
  assert.equal(c.code, 4);
  assert.equal(c.json.error, "not-a-prototype");
});

/* --------------------------------------------------------------- bad rounds */

const BAD_ROUNDS = [
  ["missing-variant-file", 3, "variant-missing", /variant-c\.html/],
  ["six-variants", 4, "variant-count", /6 variants/],
  ["unknown-font-set", 4, "bad-starts", /fontSet.*Comic Sans/],
];

for (const [name, code, error, says] of BAD_ROUNDS) {
  test(`assemble refuses bad-round/${name} with exit ${code}, naming the field or file`, () => {
    const round = roundFrom(path.join("bad-round", name));
    const r = proto(["assemble", "--round", round]);
    assert.equal(r.code, code, r.stdout);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error, error);
    assert.match(r.json.message, says);
    assert.ok(!fs.readdirSync(path.dirname(round)).some((f) => f.endsWith(".html")), "no page written");
  });
}

test("assemble: a folder with no round.json exits 3", () => {
  const r = proto(["assemble", "--round", scratch("ui-prototype-empty")]);
  assert.equal(r.code, 3);
  assert.equal(r.json.error, "round-missing");
});

test("assemble: malformed fields exit 4 and name the field", () => {
  const cases = [
    [(f) => ({ ...f, name: "Invoices Screen" }), /"name"/],
    [(f) => ({ ...f, kind: "page" }), /"kind"/],
    [(f) => { const { request, ...rest } = f; return rest; }, /"request"/],
    [(f) => ({ ...f, extras: Array.from({ length: 7 }, (_, i) => ({ name: `x${i}`, type: "toggle", start: true, look: true })) }), /7 extras/],
    [(f) => ({ ...f, extras: [{ name: "shadows", type: "pick", choices: ["a", "b"], start: "c", look: true }] }), /extras\[0\]\.start/],
    [(f) => ({ ...f, starts: { ...f.starts, accent: "blue" } }), /starts\.accent/],
    // A key that names an Object.prototype member is refused, not a crash.
    [(f) => ({ ...f, variants: f.variants.map((v, i) => (i === 0 ? { ...v, starts: { constructor: 1 } } : v)) }), /variants\[0\]\.starts\.constructor/],
    [(f) => ({ ...f, variants: f.variants.map((v, i) => (i === 1 ? { ...v, letter: "C" } : v)) }), /variants\[1\]\.letter/],
  ];
  for (const [change, says] of cases) {
    const round = roundFrom("good-screen");
    const file = path.join(round, "round.json");
    fs.writeFileSync(file, JSON.stringify(change(JSON.parse(fs.readFileSync(file, "utf8")))));
    const r = proto(["assemble", "--round", round]);
    assert.equal(r.code, 4, `${says}: ${r.stdout}`);
    assert.match(r.json.message, says);
  }
});

test("assemble: a variant file that is a whole page exits 4", () => {
  const round = roundFrom("good-screen");
  fs.writeFileSync(path.join(round, "variant-b.html"), "<html><body><p>whole page</p></body></html>");
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 4);
  assert.match(r.json.message, /variant-b\.html/);
});

/* ------------------------------------------------------------------ drafts */

// Every test that touches the drafts runs with its own home folder, so the
// person's real ~/.plan2code/prototypes is never read or written, and with
// browsers off unless a test says otherwise.
function drafts() {
  const home = scratch("ui-prototype-home");
  const project = path.join(scratch("ui-prototype-project"), "My App");
  fs.mkdirSync(project, { recursive: true });
  const env = { HOME: home, USERPROFILE: home, NO_BROWSER: "1" };
  const root = path.join(home, ".plan2code", "prototypes", projectKey(project));
  const run = (args, opts = {}) => runScript("plan2code-ui-prototype", "ui-prototype.mjs", args, { env: { ...env, ...opts.env }, input: opts.input });
  return { home, project, env, root, run };
}

/** Copy a fixture round's files into the next drafts round folder new-round makes; returns new-round's JSON. */
function draftRound(d, fixture, name) {
  const r = d.run(["new-round", "--project", d.project, "--name", name]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  for (const f of fs.readdirSync(path.join(FIXTURES, fixture))) {
    if (f === "expected-block.txt") continue;
    fs.copyFileSync(path.join(FIXTURES, fixture, f), path.join(r.json.folder, f));
  }
  const file = path.join(r.json.folder, "round.json");
  const facts = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify({ ...facts, name, round: r.json.round }));
  return r.json;
}

/** Set a file's, or a whole folder's, times to `date`. */
function age(p, date) {
  if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) age(path.join(p, f), date);
  fs.utimesSync(p, date, date);
}

test("projectKey: the folder name as a slug and a 12-character hash, stable, the same shape as the notepad key", () => {
  const { project } = drafts();
  const key = projectKey(project);
  assert.match(key, /^my-app-[0-9a-f]{12}$/);
  assert.equal(projectKey(project), key);
  assert.equal(projectKey(project + path.sep), key);
  assert.equal(key, notepadKey(project));
  if (process.platform === "win32" || process.platform === "darwin") assert.equal(projectKey(project.toUpperCase()), key);
  assert.notEqual(projectKey(path.join(path.dirname(project), "Other")), key);
  assert.match(projectKey(path.join(path.dirname(project), "!!!")), /^folder-[0-9a-f]{12}$/);
  assert.equal(projectKey(path.join(path.dirname(project), "x".repeat(60))).length, 40 + 1 + 12);
});

test("new-round numbers a prototype's rounds 1, 2, 3 in the project's drafts", () => {
  const d = drafts();
  for (const n of [1, 2, 3]) {
    const r = d.run(["new-round", "--project", d.project, "--name", "invoices-screen"]);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(r.json, {
      ok: true,
      round: n,
      folder: path.join(d.root, "invoices-screen", `round-${n}`),
      page: path.join(d.root, "invoices-screen", `invoices-screen-round-${n}.html`),
    });
    assert.ok(fs.statSync(r.json.folder).isDirectory());
  }
  // A page left after its folder went still counts.
  fs.rmSync(path.join(d.root, "invoices-screen", "round-3"), { recursive: true });
  fs.writeFileSync(path.join(d.root, "invoices-screen", "invoices-screen-round-3.html"), "x");
  assert.equal(d.run(["new-round", "--project", d.project, "--name", "invoices-screen"]).json.round, 4);
  assert.equal(d.run(["new-round", "--project", d.project, "--name", "Invoices Screen"]).code, 4);
  assert.equal(d.run(["new-round", "--project", d.project]).code, 2);
});

test("assemble a round in the drafts: the page goes to the drafts page path and its File fact is that path", () => {
  const d = drafts();
  const { folder, page } = draftRound(d, "good-screen", "invoices-screen");
  const r = d.run(["assemble", "--round", folder]);
  assert.equal(r.code, 0, r.stdout);
  assert.equal(r.json.file, page);
  assert.equal(page, path.join(d.root, "invoices-screen", "invoices-screen-round-1.html"));
  assert.equal(unpackPage(fs.readFileSync(page, "utf8")).facts.file, page);
});

test("assemble in the drafts refuses a round.json whose name or round differs from its folder, and leaves the older page alone", () => {
  const d = drafts();
  const first = draftRound(d, "good-screen", "invoices-screen");
  assert.equal(d.run(["assemble", "--round", first.folder]).code, 0);
  const before = fs.readFileSync(first.page, "utf8");
  const second = draftRound(d, "good-screen", "invoices-screen");
  const file = path.join(second.folder, "round.json");
  const facts = JSON.parse(fs.readFileSync(file, "utf8"));

  // Round 2's folder holding a round.json copied from round 1.
  fs.writeFileSync(file, JSON.stringify({ ...facts, round: 1, request: "Changed" }));
  let r = d.run(["assemble", "--round", second.folder]);
  assert.equal(r.code, 4, r.stdout);
  assert.equal(r.json.error, "round-mismatch");
  assert.match(r.json.message, /round 1, but its folder is "invoices-screen" round 2/);
  assert.equal(fs.readFileSync(first.page, "utf8"), before);
  assert.equal(fs.existsSync(second.page), false);

  fs.writeFileSync(file, JSON.stringify({ ...facts, name: "other-screen" }));
  r = d.run(["assemble", "--round", second.folder]);
  assert.equal(r.code, 4, r.stdout);
  assert.equal(r.json.error, "round-mismatch");

  fs.writeFileSync(file, JSON.stringify(facts));
  r = d.run(["assemble", "--round", second.folder]);
  assert.equal(r.code, 0, r.stdout);
  assert.equal(r.json.file, second.page);
});

test("sweep removes only this project's drafts older than 30 days, then prototype folders left empty", () => {
  const d = drafts();
  const old = new Date(2026, 5, 1); // NOW is 2026-08-03
  const fresh = new Date(2026, 6, 30);
  const keep = draftRound(d, "good-screen", "kept-one");
  const stale = draftRound(d, "good-screen", "kept-one");
  fs.writeFileSync(stale.page, "x");
  fs.writeFileSync(keep.page, "x");
  age(stale.folder, old);
  age(stale.page, old);
  age(keep.folder, fresh);
  age(keep.page, fresh);
  // An old folder with one file written lately is still in use.
  const busy = draftRound(d, "good-screen", "kept-one");
  age(busy.folder, old);
  fs.utimesSync(path.join(busy.folder, "variant-a.html"), fresh, fresh);
  const gone = draftRound(d, "good-screen", "all-old");
  fs.writeFileSync(gone.page, "x");
  age(path.join(d.root, "all-old"), old);
  // Something that is not a round or a page is never touched.
  const other = path.join(d.root, "kept-one", "notes.txt");
  fs.writeFileSync(other, "x");
  age(other, old);
  // Another project's old drafts are not this project's.
  const elsewhere = path.join(d.home, ".plan2code", "prototypes", "other-0123456789ab", "x", "round-1");
  fs.mkdirSync(elsewhere, { recursive: true });
  age(path.dirname(elsewhere), old);

  const r = d.run(["sweep", "--project", d.project]);
  assert.equal(r.code, 0, r.stdout);
  assert.equal(r.json.draftsDir, d.root);
  assert.deepEqual([...r.json.removed].sort(), [stale.folder, stale.page, gone.folder, gone.page, path.join(d.root, "all-old")].sort());
  for (const p of [keep.folder, keep.page, busy.folder, other, elsewhere]) assert.ok(fs.existsSync(p), p);
});

test("sweep with no drafts folder removes nothing and succeeds", () => {
  const d = drafts();
  const r = d.run(["sweep", "--project", d.project]);
  assert.deepEqual(r.json, { ok: true, draftsDir: d.root, removed: [] });
  assert.equal(d.run(["sweep"]).code, 2);
});

/* ------------------------------------------------------------------ images */

/** with-images as <temp>/round-1, its images in <temp>/images; returns the round folder. */
function imageRound() {
  const round = roundFrom("with-images");
  fs.cpSync(path.join(FIXTURES, "images"), path.join(path.dirname(round), "images"), { recursive: true });
  return round;
}

function editRound(round, change) {
  const file = path.join(round, "round.json");
  fs.writeFileSync(file, JSON.stringify(change(JSON.parse(fs.readFileSync(file, "utf8")))));
}

const pngOf = (n) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(n - 8, 7)]);

test("assemble embeds PNG, JPEG, WebP and SVG images by their bytes, in src and in url(), and skips a mislabeled file", () => {
  const round = imageRound();
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, r.stdout);
  const a = unpackPage(fs.readFileSync(r.json.file, "utf8")).frames.A.content;
  const b64 = (f) => fs.readFileSync(path.join(FIXTURES, "images", f)).toString("base64");
  assert.ok(a.includes(`<img src="data:image/png;base64,${b64("logo.png")}" alt="Acme logo">`), "png in src");
  assert.ok(a.includes(`<img src="data:image/jpeg;base64,${b64("hero.jpg")}" alt="Office">`), "jpeg from p2c-image:");
  assert.ok(a.includes(`<img src='data:image/webp;base64,${b64("avatar.webp")}' alt="Dana Ruiz">`), "webp in single quotes");
  assert.ok(a.includes(`background-image: url("data:image/svg+xml;base64,${b64("badge.svg")}")`), "svg in url()");
  assert.ok(a.includes(`background: url("data:image/jpeg;base64,${b64("hero.jpg")}") center`), "jpeg in a quoted url()");
  assert.ok(a.includes('<img src="" alt="photo.png">'), "the text file is skipped, named in alt");
  // The SVG is never markup: its circle is only inside the data: URL.
  assert.ok(!a.includes("<circle"), "no SVG markup");
  assert.equal(r.json.warnings.length, 1, r.json.warnings.join(" | "));
  assert.match(r.json.warnings[0], /photo\.png.*skipped/);
  for (const name of ["logo.png", "hero.jpg", "avatar.webp", "badge.svg"]) assert.ok(r.json.parts.some((p) => p.what === `image ${name}`), name);
  assert.ok(!r.json.parts.some((p) => p.what === "image photo.png"));
  assert.equal(proto(["check", "--file", r.json.file]).code, 0);
});

test("assemble: an image over 1 MB becomes a labeled placeholder with a warning; check still passes", () => {
  const round = imageRound();
  fs.writeFileSync(path.join(path.dirname(round), "images", "big.png"), pngOf(1024 * 1024 + 1));
  editRound(round, (f) => ({ ...f, images: [...f.images, { name: "big.png", path: "../images/big.png" }] }));
  fs.appendFileSync(path.join(round, "variant-b.html"), '<img src="big.png" alt="Big">\n');
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, r.stdout);
  assert.ok(r.json.warnings.some((w) => /big\.png.*1 MB/.test(w)), r.json.warnings.join(" | "));
  const b = unpackPage(fs.readFileSync(r.json.file, "utf8")).frames.B.content;
  assert.ok(b.includes(`<img src="${placeholderUrl("big.png")}" alt="Big">`));
  assert.ok(!b.includes("data:image/png"));
  assert.match(Buffer.from(placeholderUrl("big.png").split(",")[1], "base64").toString(), /big\.png[\s\S]*image too large to embed/);
  assert.equal(proto(["check", "--file", r.json.file]).code, 0);
});

test("assemble embeds an image whose tag has a > inside an earlier quoted value", () => {
  const round = imageRound();
  fs.appendFileSync(path.join(round, "variant-b.html"), `<img title="a > b" src="logo.png" alt="Quoted">\n`);
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, r.stdout);
  const b = unpackPage(fs.readFileSync(r.json.file, "utf8")).frames.B.content;
  const png = fs.readFileSync(path.join(FIXTURES, "images", "logo.png")).toString("base64");
  assert.ok(b.includes(`<img title="a > b" src="data:image/png;base64,${png}" alt="Quoted">`), "embedded past the quoted >");
});

test("assemble never reads an image round.json does not list", () => {
  const round = imageRound();
  editRound(round, (f) => ({ ...f, images: f.images.filter((i) => i.name !== "logo.png") }));
  const r = proto(["assemble", "--round", round]);
  const a = unpackPage(fs.readFileSync(r.json.file, "utf8")).frames.A.content;
  assert.ok(a.includes('<img src="logo.png" alt="Acme logo">'), "left as written");
});

test("assemble warns when the images together pass 3 MB, naming the largest", () => {
  const round = imageRound();
  const dir = path.join(path.dirname(round), "images");
  const sizes = [900, 950, 800, 700].map((k) => k * 1024);
  sizes.forEach((n, i) => fs.writeFileSync(path.join(dir, `p${i}.png`), pngOf(n)));
  editRound(round, (f) => ({ ...f, images: [...f.images, ...sizes.map((_, i) => ({ name: `p${i}.png`, path: `../images/p${i}.png` }))] }));
  fs.appendFileSync(path.join(round, "variant-c.html"), sizes.map((_, i) => `<img src="p${i}.png" alt="">`).join("") + "\n");
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, r.stdout);
  const w = r.json.warnings.find((x) => /3 MB/.test(x));
  assert.ok(w, r.json.warnings.join(" | "));
  assert.match(w, /largest is "p1\.png"/);
  assert.equal(r.json.parts[0].what, "image p1.png");
});

/* ------------------------------------------------------------------- fonts */

const fontBytes = (tag, n = 200) => Buffer.concat([typeof tag === "string" ? Buffer.from(tag, "latin1") : Buffer.from(tag), Buffer.alloc(n, 1)]);

/** good-screen with these font files (null: listed but absent) beside the round and listed in round.json. */
function fontRound(files) {
  const round = roundFrom("good-screen");
  const dir = path.join(path.dirname(round), "fonts");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, buf] of Object.entries(files)) if (buf) fs.writeFileSync(path.join(dir, name), buf);
  editRound(round, (f) => ({ ...f, fonts: Object.keys(files).map((n) => `../fonts/${n}`) }));
  return round;
}

test("assemble embeds up to four app font files as P2C App Font and starts the Font set dial on App font", () => {
  const round = fontRound({
    "Inter-Regular.woff2": fontBytes("wOF2"),
    "Inter-Bold.woff": fontBytes("wOFF"),
    "Inter-600-Italic.ttf": fontBytes([0, 1, 0, 0]),
    "Inter-Black.otf": fontBytes("OTTO"),
  });
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(r.json.warnings, []);
  const page = unpackPage(fs.readFileSync(r.json.file, "utf8"));
  assert.equal(page.facts.appFont, true);
  assert.equal(page.facts.starts.fontSet, "App font");
  for (const letter of ["A", "B", "C"]) {
    const doc = page.frames[letter].doc;
    assert.match(doc, /@font-face \{ font-family: "P2C App Font"; src: url\(data:font\/woff2;base64,[^)]+\) format\("woff2"\); font-weight: normal; font-style: normal; \}/);
    assert.match(doc, /url\(data:font\/woff;base64,[^)]+\) format\("woff"\); font-weight: 700; font-style: normal;/);
    assert.match(doc, /url\(data:font\/ttf;base64,[^)]+\) format\("truetype"\); font-weight: 600; font-style: italic;/);
    assert.match(doc, /url\(data:font\/otf;base64,[^)]+\) format\("opentype"\)/);
    assert.ok(doc.includes(':root { --p2c-font-set-app: "P2C App Font", var(--p2c-font-set-system-ui); }'));
  }
  for (const n of ["Inter-Regular.woff2", "Inter-Bold.woff", "Inter-600-Italic.ttf", "Inter-Black.otf"]) assert.ok(r.json.parts.some((p) => p.what === `font ${n}`), n);
  assert.equal(proto(["check", "--file", r.json.file]).code, 0);
});

for (const [label, files, says] of [
  ["five files", Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`F${i}.woff2`, fontBytes("wOF2")])), /5 font files/],
  ["over 2 MB together", { "A.woff2": fontBytes("wOF2", 1.1 * 1024 * 1024), "B.woff2": fontBytes("wOF2", 1.1 * 1024 * 1024) }, /2 MB/],
  ["no readable file", { "Gone.woff2": null }, /No listed font file/],
  ["no font file at all", { "Notes.woff2": Buffer.from("not a font") }, /No listed font file/],
]) {
  test(`assemble falls back to the round's font set when the app font has ${label}`, () => {
    const r = proto(["assemble", "--round", fontRound(files)]);
    assert.equal(r.code, 0, r.stdout);
    const page = unpackPage(fs.readFileSync(r.json.file, "utf8"));
    assert.equal(page.facts.appFont, false);
    assert.equal(page.facts.starts.fontSet, "System UI");
    assert.ok(!page.frames.A.doc.includes("@font-face"));
    const w = r.json.warnings.find((x) => /closest system set, System UI/.test(x));
    assert.ok(w, r.json.warnings.join(" | "));
    assert.match(w, says);
  });
}

/* ------------------------------------------------------------- size report */

test("a page over the soft ceiling names its three largest parts", () => {
  const round = roundFrom("good-screen");
  for (const [f, n] of [["variant-a.html", 3], ["variant-b.html", 2], ["variant-c.html", 1]]) {
    fs.appendFileSync(path.join(round, f), `<p hidden>${"x".repeat(n * 1024 * 1024)}</p>`);
  }
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(r.json.parts.slice(0, 3).map((p) => p.what), ["variant A", "variant B", "variant C"]);
  assert.match(r.json.warnings.at(-1), /5 MB soft ceiling; the largest parts are variant A \(3\.0 MB\), variant B \(2\.0 MB\), variant C \(1\.0 MB\)\./);
});

test("check reports image-type for a data: image of another type and image-size for one over 1 MB", () => {
  assert.deepEqual(checkWith('<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">'), [["image-type", "A"]]);
  assert.deepEqual(checkWith(`<img src="data:image/png;base64,${"A".repeat(1.5 * 1024 * 1024)}" alt="">`), [["image-size", "A"]]);
  assert.deepEqual(checkWith(`<img src="data:image/png;base64,${"A".repeat(1024)}" alt="">`), []);
});

test("check reports image-missing for a p2c-image: name round.json does not list", () => {
  assert.deepEqual(checkWith('<img src="p2c-image:logoo" alt="Logo">'), [["image-missing", "A"]]);
  const round = roundFrom("good-screen");
  const file = path.join(round, "variant-b.html");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8") + '<img src="p2c-image:one" alt=""><img src="p2c-image:two" alt=""><img src="p2c-image:one" alt="">');
  const c = proto(["check", "--file", proto(["assemble", "--round", round]).json.file]);
  assert.equal(c.code, 4);
  assert.deepEqual(c.json.findings.map((f) => [f.rule, f.variant]), [["image-missing", "B"]]);
  assert.match(c.json.findings[0].message, /images round\.json does not list \(one, two\)/);
});

test("assemble refuses an extra whose label holds a colon", () => {
  for (const label of ["Density: tight", ":"]) {
    const round = roundFrom("good-screen");
    const file = path.join(round, "round.json");
    const facts = JSON.parse(fs.readFileSync(file, "utf8"));
    facts.extras = [{ name: "dividers", label, type: "toggle", start: true, look: true }];
    fs.writeFileSync(file, JSON.stringify(facts));
    const r = proto(["assemble", "--round", round]);
    assert.equal(r.code, 4, r.stdout);
    assert.equal(r.json.error, "bad-extra");
    assert.match(r.json.message, /extras\[0\]\.label must have no colon/);
  }
});

/* -------------------------------------------------------------------- open */

test("open with NO_BROWSER or PLAN2CODE_NO_BROWSER, or in a remote session, opens nothing and reports the path", () => {
  const d = drafts();
  const { folder } = draftRound(d, "good-screen", "invoices-screen");
  const page = d.run(["assemble", "--round", folder]).json.file;
  const off = { NO_BROWSER: "", PLAN2CODE_NO_BROWSER: "", SSH_CONNECTION: "", SSH_TTY: "", CODESPACES: "", REMOTE_CONTAINERS: "" };
  for (const env of [{ NO_BROWSER: "1" }, { PLAN2CODE_NO_BROWSER: "1" }, { SSH_CONNECTION: "10.0.0.1 22 10.0.0.2 22" }, { CODESPACES: "true" }]) {
    const r = d.run(["open", "--file", page, "--project", d.project], { env: { ...off, ...env } });
    assert.equal(r.code, 0, r.stdout);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.opened, false);
    assert.equal(r.json.path, page);
    assert.equal(typeof r.json.reason, "string");
  }
});

test("open refuses a page outside the drafts and the project's specs/, a missing page and a non-.html file", () => {
  const d = drafts();
  const loose = path.join(scratch("ui-prototype-loose"), "page.html");
  fs.writeFileSync(loose, "<p>x</p>");
  const inDrafts = path.join(d.root, "x", "notes.txt");
  fs.mkdirSync(path.dirname(inDrafts), { recursive: true });
  fs.writeFileSync(inDrafts, "x");
  const atRoot = path.join(d.project, "page.html");
  fs.writeFileSync(atRoot, "<p>x</p>");
  for (const file of [loose, path.join(d.root, "x", "missing.html"), inDrafts, atRoot]) {
    const r = d.run(["open", "--file", file, "--project", d.project]);
    assert.equal(r.code, 5, file);
    assert.equal(r.json.error, "not-allowed");
  }
  const saved = path.join(d.project, "specs", "billing", "prototypes", "invoices.html");
  fs.mkdirSync(path.dirname(saved), { recursive: true });
  fs.writeFileSync(saved, "<p>x</p>");
  const r = d.run(["open", "--file", saved, "--project", d.project]);
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual([r.json.opened, r.json.path], [false, saved]);
  assert.equal(d.run(["open"]).code, 2);
});

/* -------------------------------------------------------------- read-block */

const blockText = (name, file) => fs.readFileSync(path.join(FIXTURES, "blocks", name), "utf8").replace("<FILE>", file);

test("read-block reads the screen block's fields, and flags a round older than the newest draft", () => {
  const d = drafts();
  let page;
  for (let i = 0; i < 3; i++) page = draftRound(d, "good-screen", "invoices-screen").page;
  fs.writeFileSync(page, "x");
  const r = d.run(["read-block", "--project", d.project], { input: blockText("screen.txt", page) });
  assert.equal(r.code, 0, r.stdout);
  const f = r.json.fields;
  assert.equal(f.prototype, "invoices-screen");
  assert.equal(f.file, page);
  assert.equal(f.round, 2);
  assert.deepEqual(f.chosen, { letter: "B", name: "Split view" });
  assert.deepEqual(f.others, [{ letter: "A", name: "Dense table" }, { letter: "C", name: "Cards" }]);
  assert.deepEqual(f.carried, ["colors", "fonts", "spacing"]);
  assert.deepEqual(f.freed, ["components", "layout"]);
  assert.equal(f.direction, "calmer, more room around totals");
  assert.equal(f.preset, "Airy");
  assert.deepEqual(f.dials.map((x) => x.label), ["Screen size", "Theme", "Accent color", "Neutral color", "Font set", "Text size", "Spacing", "Corners", "State", "Content length"]);
  assert.deepEqual(f.dials[1], { label: "Theme", value: "Dark", changedFrom: "Light" });
  assert.deepEqual(f.dials[5], { label: "Text size", value: "16px", changedFrom: null });
  assert.deepEqual(f.extras, [{ label: "Shadows", value: "Soft", changedFrom: null }]);
  assert.equal(f.note, "header from A with these cards");
  assert.deepEqual(f.unknown, []);
  assert.equal(r.json.latest, false, "round 3 exists");
  assert.equal(r.json.fileExists, true);
  assert.equal(r.json.saved, false);
});

test("read-block reads a terminal block: none lists, its own dial lines, the latest round", () => {
  const d = drafts();
  const r = d.run(["read-block", "--project", d.project], { input: blockText("terminal.txt", path.join(d.root, "deploy-status", "deploy-status-round-1.html")) });
  assert.equal(r.code, 0, r.stdout);
  const f = r.json.fields;
  assert.deepEqual([f.carried, f.freed, f.direction, f.preset, f.note], [[], [], null, null, null]);
  assert.deepEqual(f.dials[0], { label: "Window size", value: "80x24", changedFrom: "120x30" });
  assert.deepEqual(f.dials.map((x) => x.label), ["Window size", "Theme", "Palette", "Density", "State", "Content length"]);
  assert.deepEqual([r.json.latest, r.json.fileExists, r.json.saved], [true, false, false]);
});

test("read-block keeps an edited block: code fences dropped, lines in another order, an unknown label kept", () => {
  const d = drafts();
  draftRound(d, "good-screen", "invoices-screen");
  draftRound(d, "good-screen", "invoices-screen");
  const saved = path.join(d.project, "specs", "billing", "prototypes", "invoices-screen.html");
  const r = d.run(["read-block", "--project", d.project], { input: `\n\n${blockText("edited.txt", saved)}\n` });
  assert.equal(r.code, 0, r.stdout);
  const f = r.json.fields;
  assert.equal(f.round, 2);
  assert.equal(f.file, saved);
  assert.deepEqual(f.chosen, { letter: "C", name: "Cards" });
  assert.deepEqual(f.unknown, [{ label: "Mood", value: "warmer, like the old app" }]);
  assert.equal(f.note, "keep the overdue badge");
  assert.deepEqual(f.dials.find((x) => x.label === "Content length"), { label: "Content length", value: "Long", changedFrom: "Typical" });
  assert.deepEqual([r.json.latest, r.json.fileExists, r.json.saved], [true, false, true]);
});

test("read-block rejects text that is not a block with exit 3", () => {
  const d = drafts();
  const r = d.run(["read-block", "--project", d.project], { input: fs.readFileSync(path.join(FIXTURES, "blocks", "not-a-block.txt"), "utf8") });
  assert.equal(r.code, 3);
  assert.equal(r.json.error, "not-a-block");
  assert.equal(r.json.message, "That is not a UI prototype block");
  assert.equal(d.run(["read-block"], { input: "" }).code, 2);
});

/* -------------------------------------------------------------------- save */

/** A drafted, assembled invoices-screen page plus the block and rejected files for it. */
function saveSetup(d) {
  const { folder } = draftRound(d, "good-screen", "invoices-screen");
  const page = d.run(["assemble", "--round", folder]).json.file;
  const files = scratch("ui-prototype-save");
  const block = path.join(files, "block.txt");
  fs.writeFileSync(block, "```\n" + blockText("screen.txt", page) + "```\n");
  const rejected = path.join(files, "rejected.txt");
  fs.writeFileSync(rejected, 'A "Dense table": too busy for a quick look\n\nC "Cards": totals were hard to compare\n');
  const args = (more = []) => ["save", "--file", page, "--spec", "specs/billing", "--name", "invoices", "--block", block, "--request", "A screen listing a customer's invoices.", "--rejected", rejected, "--project", d.project, ...more];
  return { page, block, args };
}

test("save writes the page and its decisions file under specs/, with both File lines set to the saved page, and removes the drafts", () => {
  const d = drafts();
  const { page, block, args } = saveSetup(d);
  const r = d.run(args());
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual(r.json, {
    ok: true,
    html: "specs/billing/prototypes/invoices.html",
    md: "specs/billing/prototypes/invoices.md",
    removedDrafts: [path.join(d.root, "invoices-screen")],
  });
  const html = path.join(d.project, "specs", "billing", "prototypes", "invoices.html");
  const saved = unpackPage(fs.readFileSync(html, "utf8"));
  assert.equal(saved.facts.file, html);
  assert.equal(saved.facts.name, "invoices-screen");
  const md = fs.readFileSync(path.join(d.project, "specs", "billing", "prototypes", "invoices.md"), "utf8");
  const pasted = fs.readFileSync(block, "utf8").replace(/```\n/g, "").trimEnd();
  const expected = pasted.replace(`File: ${page}`, "File: specs/billing/prototypes/invoices.html");
  assert.notEqual(expected, pasted, "the pasted File line was the draft");
  const fence = "```";
  assert.equal(
    md,
    `## Request\n\nA screen listing a customer's invoices.\n\n## Choice\n\n${fence}text\n${expected}\n${fence}\n\n## Not chosen\n\n- A "Dense table": too busy for a quick look\n- C "Cards": totals were hard to compare\n`
  );
  assert.ok(!fs.existsSync(path.join(d.root, "invoices-screen")), "no draft of the saved prototype is left");
});

test("save refuses to replace a saved pair until --replace", () => {
  const d = drafts();
  assert.equal(d.run(saveSetup(d).args()).code, 0);
  const again = saveSetup(d);
  const r = d.run(again.args());
  assert.equal(r.code, 5);
  assert.equal(r.json.error, "exists");
  assert.match(r.json.next, /ask the person/i);
  assert.ok(fs.existsSync(again.page), "the draft stays when nothing was saved");
  assert.equal(d.run(again.args(["--replace"])).code, 0);
});

test("save refuses a target outside specs/, a source outside the drafts and a bad name", () => {
  const d = drafts();
  const { args } = saveSetup(d);
  const swap = (flag, value) => {
    const a = args();
    a[a.indexOf(flag) + 1] = value;
    return a;
  };
  for (const spec of ["../evil", "specs/a/b", "docs/x", "specs/..", "specs", path.join(d.project, "specs", "billing")]) {
    const r = d.run(swap("--spec", spec));
    assert.equal(r.code, 5, spec);
    assert.equal(r.json.error, "spec-not-allowed", spec);
  }
  const loose = path.join(scratch("ui-prototype-loose"), "page.html");
  fs.writeFileSync(loose, "<p>x</p>");
  assert.equal(d.run(swap("--file", loose)).json.error, "source-not-allowed");
  assert.equal(d.run(swap("--name", "Invoices Page")).json.error, "bad-name");
  assert.ok(!fs.existsSync(path.join(d.project, "specs")), "nothing was written");
  assert.ok(!fs.existsSync(path.join(path.dirname(d.project), "evil")));
});

/* ------------------------------------------------------------ review fixes */

test("save --replace refuses a saved target that is a link, and writes nothing through it", (t) => {
  const d = drafts();
  assert.equal(d.run(saveSetup(d).args()).code, 0);
  const outside = path.join(scratch("ui-prototype-outside"), "victim.md");
  fs.writeFileSync(outside, "untouched");
  const md = path.join(d.project, "specs", "billing", "prototypes", "invoices.md");
  fs.rmSync(md);
  try {
    fs.symlinkSync(outside, md, "file");
  } catch {
    t.skip("this machine cannot create a file link");
    return;
  }
  const r = d.run(saveSetup(d).args(["--replace"]));
  assert.equal(r.code, 5, r.stdout);
  assert.equal(r.json.error, "spec-not-allowed");
  assert.equal(fs.readFileSync(outside, "utf8"), "untouched");
});

test("read-block: saved is about the project's own specs/, not a folder named specs anywhere", () => {
  const d = drafts();
  const draft = path.join(d.root, "specs", "specs-round-1.html");
  const r = d.run(["read-block", "--project", d.project], { input: blockText("screen.txt", draft).replace("invoices-screen", "specs") });
  assert.equal(r.code, 0, r.stdout);
  assert.equal(r.json.saved, false);
  const relative = d.run(["read-block", "--project", d.project], { input: blockText("screen.txt", "specs/billing/prototypes/invoices.html") });
  assert.equal(relative.json.saved, true);
});

test("assemble starts the Font set dial on App font only when fonts are carried over", () => {
  const round = fontRound({ "Inter-Regular.woff2": fontBytes("wOF2") });
  editRound(round, (f) => ({ ...f, carried: f.carried.filter((i) => i !== "fonts"), freed: [...f.freed, "fonts"] }));
  const r = proto(["assemble", "--round", round]);
  assert.equal(r.code, 0, r.stdout);
  const page = unpackPage(fs.readFileSync(r.json.file, "utf8"));
  assert.equal(page.facts.appFont, true, "the font is still in the page for the dial");
  assert.equal(page.facts.starts.fontSet, "System UI");
});

test("save --replace refuses a saved target that is a folder, not a file", () => {
  const d = drafts();
  assert.equal(d.run(saveSetup(d).args()).code, 0);
  const html = path.join(d.project, "specs", "billing", "prototypes", "invoices.html");
  fs.rmSync(html);
  fs.mkdirSync(html);
  const r = d.run(saveSetup(d).args(["--replace"]));
  assert.equal(r.code, 5, r.stdout);
  assert.equal(r.json.error, "spec-not-allowed");
  assert.ok(fs.statSync(html).isDirectory());
});
