// Parse every shipped browser module as a real ES module.
//
// `node --check` is not enough: it parses a .js file as a CommonJS script, and
// it let a string literal containing a raw newline through to the browser,
// where the page died at import with nothing rendered. Importing the source as
// a data: module is the same parse the browser does.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, "src", "web-console", "public");
const FILES = ["app.js", "answers.js", "render.js", "palette.js", "starters.js", "favicon.js"];

let bad = 0;
for (const name of FILES) {
  const src = fs.readFileSync(path.join(DIR, name), "utf8");
  try {
    await import("data:text/javascript," + encodeURIComponent(src));
    console.log(`  ok  ${name}`);
  } catch (err) {
    // A module that parses but cannot run here (app.js touches `document` at
    // import) is fine; only a parse failure is a real problem.
    const parseFailure = err instanceof SyntaxError;
    if (parseFailure) {
      bad++;
      console.error(`  FAIL ${name}: ${err.message}`);
    } else {
      console.log(`  ok  ${name} (parsed; not runnable outside a browser)`);
    }
  }
}
if (bad) {
  console.error(`${bad} file(s) would not parse in a browser.`);
  process.exit(1);
}
