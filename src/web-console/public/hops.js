// Plan2Code Web Console - the hop rule.
//
// Which hops from one workflow to another start the new skill on a clean
// page. One rule, called by both sides that act on it: the server
// (cmd-open.mjs blanks the stored session and drops the staged draft) and the
// page (screens/core.js drops what it kept for the last skill: the question
// on screen, the open tab, anything staged against its item ids). No imports
// and no DOM access: nothing runs at load.

// True when a hop from workflow `from` to workflow `to` starts clean:
//   - a launch from the dashboard menu gets a clean page, not the last
//     skill's questions and tabs under its own name;
//   - going back to the dashboard clears the last skill;
//   - Git counts as a launch from anywhere: Commit it now on a finished
//     screen and Changelog's "Commit this now?" both stand in for its
//     dashboard card, and a finish left behind would keep the page on the old
//     ending above the new board;
//   - a launch from a finished screen (Continue here, Update CHANGELOG first)
//     goes from one skill into another and gets a clean page too, since the
//     finish it leaves behind would keep the page on the old ending. Two
//     pairs are not that: out of Git (its board hops into Changelog on its
//     own and keeps its state) and into Review (a skill's review runs inline
//     and never switches workflow).
// A skill run inline from another (a quick task's review) never switches
// workflow, so it keeps the page; nor does a resume into the same workflow.
export function startsClean(from, to) {
  if (typeof from !== "string" || typeof to !== "string" || !from || !to || from === to) return false;
  if (from === "dashboard" || to === "dashboard" || to === "git") return true;
  return from !== "git" && to !== "review";
}
