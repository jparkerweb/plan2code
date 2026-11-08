// Fails when a file in .agents-docs/ is larger than the size limit, so a doc
// never grows into one nobody reads whole again. Split it by area instead and
// link the pieces from its index (see AGENTS-architecture.md).
// Usage: node scripts/check-doc-size.mjs [docsDir] [limitBytes]
// The limit is the largest area file (about 54 KB) plus headroom.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_LIMIT = 60000;

// One entry per file over the limit: { file, bytes }.
export function oversize(dir, limit = DEFAULT_LIMIT) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ file: f, bytes: fs.statSync(path.join(dir, f)).size }))
    .filter((e) => e.bytes > limit)
    .sort((a, b) => a.file.localeCompare(b.file));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, "..", ".agents-docs");
  const limit = process.argv[3] ? Number(process.argv[3]) : DEFAULT_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error(`Bad size limit: ${process.argv[3]}`);
    process.exit(2);
  }
  const big = oversize(dir, limit);
  if (big.length) {
    console.error(
      `Over the ${limit}-byte limit (split each by area and link the pieces from its index):\n` +
        big.map((e) => `  ${e.file}: ${e.bytes} bytes`).join("\n"),
    );
    process.exit(1);
  }
  console.log(`Every file in .agents-docs/ is within ${limit} bytes.`);
}
