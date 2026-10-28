// `node --test` with the files run side by side capped at 8 and at one per
// spare core. A flat 8 kept a big machine from swamping the page tests, but on
// a 3 or 4 core CI runner it ran 8 browsers at once, nearly triple Node's own
// default, and page tests timed out at random. Arguments pass straight through.

import { spawnSync } from "node:child_process";
import os from "node:os";

const concurrency = Math.max(1, Math.min(8, os.availableParallelism() - 1));
const r = spawnSync(process.execPath, ["--test", `--test-concurrency=${concurrency}`, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 1);
