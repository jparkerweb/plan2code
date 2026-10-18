// The console's stylesheet as the tests read it: the files under
// public/styles/ joined in the server's own order, without the accent rules.
// A rule moving between files never breaks a test; only a rule that changes
// or vanishes does.

import { joinedStyles } from "../src/web-console/static.mjs";

export function joinedCss() {
  return joinedStyles().toString("utf8");
}
