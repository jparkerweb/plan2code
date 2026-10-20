// Plan2Code Web Console - the Notebook's live-preview editor, on CodeMirror 6.
//
// Markdown stays the stored format. The editor shows it formatted where it is
// typed: headings grow, bullets become dots, the marks around bold, links and
// quotes hide, and every mark comes back on the line the cursor is on. Only
// the visible lines are decorated, so typing in a 200 KB note costs about what
// it does in a short one. CodeMirror itself ships as one vendored file
// (vendor/codemirror.esm.js, made by scripts/vendor-codemirror.mjs); every
// look here is a class styled by notepad.css, never an inline style, because
// the page's policy (`style-src 'self'`) refuses those. CodeMirror's own rules
// are a <style> element too, so the editor sits in a shadow root, where they
// are adopted as a constructed stylesheet instead; notepad-editor.css is that
// root's one stylesheet.
//
// The editor is an object with four methods, plus destroy(), so
// screens/notepad.js does not care which editor is behind it: getValue(),
// setValue(text), setReadOnly(on) and focus(). setValue() is not reported
// through onChange, and clears the undo history (it is a different note, not
// an edit). Line endings: CodeMirror reads CRLF as LF, so a note stored with
// CRLF is saved back with LF on its first edit (OverType's textarea did too).

import {
  Compartment,
  Decoration,
  EditorState,
  EditorView,
  ViewPlugin,
  WidgetType,
  defaultKeymap,
  history,
  historyKeymap,
  keymap,
  markdown,
  markdownLanguage,
  redo,
  syntaxTree,
} from "./vendor/codemirror.esm.js";

// A bullet drawn in place of "-", "*" or "+" on a line the cursor is not on.
class BulletWidget extends WidgetType {
  eq(other) {
    return other instanceof BulletWidget;
  }
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-bullet";
    dot.textContent = "•";
    return dot;
  }
  ignoreEvent() {
    return false;
  }
}

const HIDE = Decoration.replace({});
const BULLET = Decoration.replace({ widget: new BulletWidget() });
const lineClass = (name) => Decoration.line({ class: name });
const markClass = (name) => Decoration.mark({ class: name });

// A selection across more lines than this shows every mark, rather than
// working out which lines are inside it.
const MAX_ACTIVE_LINES = 400;

// The line numbers the selection touches: their marks stay visible so the
// person sees and edits the Markdown there. null means all of them.
function activeLines(state) {
  const lines = new Set();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    if (last - first > MAX_ACTIVE_LINES) return null;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

// The decorations for the lines in view, from the Markdown syntax tree.
function build(view) {
  const { state } = view;
  const { doc } = state;
  const active = activeLines(state);
  const out = [];
  const from = view.viewport.from;
  const to = view.viewport.to;

  const onActiveLine = (pos) => active === null || active.has(doc.lineAt(pos).number);
  // A hidden range never runs past the end of its line: CodeMirror refuses a
  // replace decoration that covers a line break when a plugin makes it, and a
  // link can span lines ("[a](\nhttps://x)").
  const hide = (a, b) => {
    const end = Math.min(b, doc.lineAt(a).to);
    if (end > a && !onActiveLine(a)) out.push(HIDE.range(a, end));
  };
  // A mark and the single space after it ("# ", "> ", "- ").
  const hideWithSpace = (a, b) => hide(a, b < doc.length && doc.sliceString(b, b + 1) === " " ? b + 1 : b);
  const eachLine = (a, b, fn) => {
    const start = doc.lineAt(Math.max(a, from)).number;
    const end = doc.lineAt(Math.min(b, to)).number;
    for (let n = start; n <= end; n++) fn(doc.line(n));
  };

  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      const name = node.name;
      const heading = /^ATXHeading([1-6])$/.exec(name);
      if (heading) {
        out.push(lineClass("cm-h" + heading[1]).range(doc.lineAt(node.from).from));
      } else if (name === "HeaderMark") {
        // Only the leading "#" run of an ATX heading hides; a closing run stays.
        const parent = node.node.parent;
        if (parent && /^ATXHeading/.test(parent.name) && node.from === doc.lineAt(node.from).from) hideWithSpace(node.from, node.to);
      } else if (name === "StrongEmphasis") {
        out.push(markClass("cm-strong").range(node.from, node.to));
      } else if (name === "Emphasis") {
        out.push(markClass("cm-em").range(node.from, node.to));
      } else if (name === "Strikethrough") {
        out.push(markClass("cm-strike").range(node.from, node.to));
      } else if (name === "EmphasisMark" || name === "StrikethroughMark") {
        hide(node.from, node.to);
      } else if (name === "InlineCode") {
        out.push(markClass("cm-code").range(node.from, node.to));
      } else if (name === "CodeMark") {
        // The backticks of inline code hide; a fence's stay, dimmed.
        if (node.node.parent && node.node.parent.name === "InlineCode") hide(node.from, node.to);
        else out.push(markClass("cm-fence").range(node.from, node.to));
      } else if (name === "FencedCode") {
        eachLine(node.from, node.to, (line) => out.push(lineClass("cm-codeblock").range(line.from)));
      } else if (name === "Blockquote") {
        eachLine(node.from, node.to, (line) => out.push(lineClass("cm-quote").range(line.from)));
      } else if (name === "QuoteMark") {
        hideWithSpace(node.from, node.to);
      } else if (name === "HorizontalRule") {
        out.push(lineClass("cm-hr").range(doc.lineAt(node.from).from));
      } else if (name === "ListMark") {
        const parent = node.node.parent && node.node.parent.parent;
        const bulleted = parent && parent.name === "BulletList";
        if (bulleted && !onActiveLine(node.from)) out.push(BULLET.range(node.from, node.to));
      } else if (name === "Link") {
        out.push(markClass("cm-link").range(node.from, node.to));
        // "[text](url)": the opening "[" and everything from "](" on hide.
        const marks = [];
        for (let child = node.node.firstChild; child; child = child.nextSibling) {
          if (child.name === "LinkMark") marks.push(child);
        }
        // A link with no text ("[](u)") stays as written, or nothing would be left to click into.
        if (marks.length >= 2 && marks[0].to < marks[1].from) {
          hide(marks[0].from, marks[0].to);
          hide(marks[1].from, node.to);
        }
      }
    },
  });
  return Decoration.set(out, true);
}

// Redraws on what can change the picture: the text, the selection (which
// lines are active), the lines in view, and the parse catching up.
const livePreview = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = build(view);
    }
    update(update) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        syntaxTree(update.state) !== syntaxTree(update.startState)
      ) {
        this.decorations = build(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/**
 * Make the editor inside `parent`. `onChange(text)` is called with the whole
 * text after each edit the person makes; `label` is the screen-reader name.
 */
export function makeCodeMirrorEditor(parent, { onChange, label }) {
  // Read-only until the note has been read in, so nothing typed into the empty
  // editor is saved over the real note. Only the state is read-only, never
  // `editable`: a non-editable content element cannot take the focus, and the
  // person would find it gone when the note loads.
  let readOnly = false;
  const access = new Compartment();
  const accessOf = (on) => (on ? [EditorState.readOnly.of(true), EditorView.contentAttributes.of({ "aria-readonly": "true" })] : []);
  const extensions = [
    history(),
    // Ctrl+Shift+Z redoes on every platform (the history keymap binds it on Linux and Mac only).
    keymap.of([{ key: "Mod-Shift-z", run: redo, preventDefault: true }, ...defaultKeymap, ...historyKeymap]),
    markdown({ base: markdownLanguage }),
    livePreview,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ "aria-label": label || "Notebook text", "aria-multiline": "true" }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) onChange(update.state.doc.toString());
    }),
  ];
  const stateOf = (text) => EditorState.create({ doc: text, extensions: [...extensions, access.of(accessOf(readOnly))] });
  const host = document.createElement("div");
  host.className = "notepad-cm-host";
  parent.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  const sheet = document.createElement("link");
  sheet.rel = "stylesheet";
  sheet.href = "/notepad-editor.css";
  const mount = document.createElement("div");
  mount.className = "notepad-cm";
  root.append(sheet, mount);
  const view = new EditorView({ state: stateOf(""), parent: mount, root });
  // The stylesheet arrives after the first measure: measure again once it has,
  // or heading heights would stay at their unstyled size until the next edit.
  sheet.addEventListener("load", () => view.requestMeasure());
  return {
    getValue: () => view.state.doc.toString(),
    setValue(text) {
      // setState neither reports a change nor keeps the old note's undo steps.
      view.setState(stateOf(String(text)));
    },
    setReadOnly(on) {
      readOnly = Boolean(on);
      view.dispatch({ effects: access.reconfigure(accessOf(readOnly)) });
    },
    focus: () => view.focus(),
    destroy() {
      view.destroy();
      host.remove();
    },
  };
}
