// Plan2Code Console - the client's entry.
//
// index.html loads this file, and it is the only page file that starts
// anything: the start-up block at its end. Everything else only defines:
// screens/core.js (connection, the render loop, the page chrome and Send),
// the screens beside it under screens/, state.js (the shared state and the
// redraw and save hooks) and the modules next to it. A test keeps every file
// but this one loadable under plain Node, and keeps the screens from
// importing one another.
//
// Two objects on `page`, strictly separated by ownership:
//   page.S      the server's truth (state.json). Never mutated here.
//   page.local  what you have staged but not sent. Mirrored to localStorage
//               on every change, so a closed tab or a reload loses nothing.
//
// Nothing you do reaches the agent until you press Send. Everything before
// that is local and reversible. For someone who has never used a tool like
// this, that reversibility is the whole point.

import { page, onRedraw, onSave, useHooks, bootData } from "./state.js";
import {
  adopt, banner, connect, fillSky, fitGrowBox, loadState, markSent, maybeWelcome, render, renderFooter,
  renderSidebar, renderWhere, save, startClock, startLooks, stagedPayload, syncWorkspaceScope,
  wakeHoldsChime, wireAsk, wireCards, wireChrome, wireCleanup, wireDashboard, wireDocs, wireEnding,
  wireHelp, wireLooks, wireWorkspace,
} from "./screens/core.js";
import { sound } from "./sound.js";

/* ------------------------------------------------------------- start-up */

// Everything else only defines. This is the one place the page starts, in the
// order it always has: the saved looks before anything is drawn, the
// listeners and the dialogs' wiring, the watchdog and the status clock, and
// last the session itself (its first state and the stream). The draft's save
// and the few calls a screen makes into another are handed to state.js first.
onSave(save);
useHooks({ banner, fitGrowBox, markSent, maybeWelcome, renderFooter, renderSidebar, renderWhere, stagedPayload, syncWorkspaceScope });

const boot = bootData();
startLooks(boot);
fillSky();

wireCards();
wireWorkspace();
wireHelp();
wireDashboard();
wireEnding();
wireLooks();
wireCleanup();
wireDocs();
wireAsk();
wireChrome();
startClock();

// Screens draw again through state.js's redraw(); the render loop answers it.
onRedraw(render);
// The state came with the page, so the real screen is drawn in this same
// task, before the browser's next paint. Only a page without it asks.
if (boot && boot.state) adopt(boot);
else await loadState();
connect();
// He is on the page already; this is the first hello. After the first draw,
// so fetching the chime never stands in front of it. A dormant wake-up plays
// the boot-up sound instead, as he powers on.
setTimeout(() => {
  if (!wakeHoldsChime) sound("sessionStart");
}, 0);
