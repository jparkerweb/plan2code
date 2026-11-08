// Plan2Code Web Console - a Markdown answer field, on CodeMirror 6.
//
// Every multiline box the person types into (question answers, the
// something-else and note fields on cards, the Ask composer and its reply
// box, the subagents instruction) is one of these, so Markdown looks like it
// does in the Notebook everywhere: marks hide off the cursor's line, bullets
// become dots, headings grow. Like notepad-editor.js the editor sits in a
// shadow root, where CodeMirror's own <style> element is adopted rather than
// refused by the page's style-src 'self' policy. notepad-editor.css carries
// the mark looks, md-field.css the field's frame.
//
// makeMdField returns a facade shaped like the textarea it replaces, so
// screens and mention-box.js barely tell the difference: value get/set (set
// reports no "input", like a textarea), focus(), selectionStart/End,
// setSelectionRange, classList, isConnected, getBoundingClientRect, a
// disabled flag, and addEventListener/dispatchEvent for "input", "keydown",
// "keyup", "paste", "blur" and "focus". aria-* attributes land on the
// editable surface, everything else on the host. field.el is the host div to
// append; host.field is the facade itself, so a page test or a helper can
// drive it.
//
// CodeMirror (half a megabyte) is not part of the page's start: it is
// imported the first time a field is made, and every field after that gets
// its editor at once. A field made before the import lands keeps what is set
// on it (value, caret, disabled, aria-*, a focus asked for) and hands it to
// its editor when it arrives. destroy() ends the editor; renderMain() calls
// it, through destroyFields(), on every field it takes off the page.

// These listeners run as the editor's own DOM handlers, before its keymaps:
// a preventDefault there (the mention popover's keys, a pure-image paste)
// still beats CodeMirror's own handling.
const HANDLED = ["keydown", "keyup", "paste", "blur", "focus"];

// CodeMirror's exports plus the live preview, once loaded; the import itself
// while it is on its way. A failed import is forgotten, so the next field
// asks again.
let cm = null;
let loading = null;

function loadEditor() {
  loading ??= Promise.all([import("./vendor/codemirror.esm.js"), import("./notepad-editor.js")]).then(
    ([lib, editor]) => (cm = { ...lib, livePreview: editor.livePreview }),
    (err) => {
      loading = null;
      throw err;
    }
  );
  return loading;
}

// Ends the editor of every Markdown field inside `root` (root included), for
// a caller about to drop that part of the page.
export function destroyFields(root) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  if (root.field && typeof root.field.destroy === "function") root.field.destroy();
  for (const host of root.querySelectorAll(".md-host")) if (host.field) host.field.destroy();
}

export function makeMdField({ id, className, value = "", placeholder: hint, label, disabled = false, maxLength = 0 } = {}) {
  const host = document.createElement("div");
  host.className = "md-host" + (className ? " " + className : "");
  if (id) host.id = id;
  const root = host.attachShadow({ mode: "open" });
  const sheets = ["/notepad-editor.css", "/md-field.css"].map((href) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    return link;
  });
  const mount = document.createElement("div");
  mount.className = "md-field";
  root.append(...sheets, mount);

  const listeners = new Map();
  const fire = (type, event) => {
    for (const fn of listeners.get(type) ?? []) fn.call(field, event ?? new Event(type));
    return Boolean(event && event.defaultPrevented);
  };

  let off = Boolean(disabled);
  let view = null;
  let gone = false;
  // What the field holds until its editor arrives.
  let text = String(value ?? "");
  let sel = null;
  let wantFocus = false;
  const aria = new Map();

  let access = null;
  let stateOf = null;
  const accessOf = (on) =>
    on
      ? [
          cm.EditorState.readOnly.of(true),
          cm.EditorView.editable.of(false),
          cm.EditorView.contentAttributes.of({ "aria-disabled": "true" }),
        ]
      : [];

  const build = () => {
    const { Compartment, EditorState, EditorView, defaultKeymap, history, historyKeymap, keymap, markdown, markdownLanguage, placeholder, redo, livePreview } = cm;
    access = new Compartment();
    // editable, not only readOnly: a disabled field cannot take the focus,
    // which is the difference a textarea's own disabled attribute shows.
    const extensions = [
      history(),
      keymap.of([{ key: "Mod-Shift-z", run: redo, preventDefault: true }, ...defaultKeymap, ...historyKeymap]),
      markdown({ base: markdownLanguage }),
      livePreview,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": label || "Markdown text", "aria-multiline": "true", spellcheck: "true" }),
      EditorView.domEventHandlers(Object.fromEntries(HANDLED.map((type) => [type, (event) => fire(type, event)]))),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) fire("input");
      }),
      ...(hint ? [placeholder(hint)] : []),
      ...(maxLength
        ? [
            EditorState.transactionFilter.of((tr) => {
              if (!tr.docChanged || tr.newDoc.length <= maxLength) return tr;
              return {
                changes: { from: 0, to: tr.startState.doc.length, insert: tr.newDoc.sliceString(0, maxLength) },
                selection: { anchor: Math.min(tr.newSelection.main.head, maxLength) },
              };
            }),
          ]
        : []),
    ];
    stateOf = (t) => EditorState.create({ doc: t, extensions: [...extensions, access.of(accessOf(off))] });
    view = new EditorView({ state: stateOf(text), parent: mount, root });
    // The stylesheets arrive after the first measure: measure again once they
    // have, or the lines would keep their unstyled height until the next edit.
    for (const sheet of sheets) sheet.addEventListener("load", () => view.requestMeasure());
    if (sel) {
      const end = view.state.doc.length;
      view.dispatch({ selection: { anchor: Math.min(sel[0], end), head: Math.min(sel[1], end) } });
    }
    for (const [name, val] of aria) {
      if (val == null) view.contentDOM.removeAttribute(name);
      else view.contentDOM.setAttribute(name, val);
    }
    aria.clear();
    if (wantFocus && host.isConnected) view.focus();
  };

  const field = {
    el: host,
    get view() {
      return view;
    },
    get value() {
      return view ? view.state.doc.toString() : text;
    },
    set value(t) {
      // setState neither reports a change nor keeps the undo steps, exactly
      // the swap a textarea's value assignment makes. A fresh state parks its
      // caret at 0; a textarea's collapses to the end, so callers that fill
      // and focus (Autofill, quick answers, Reset to default) append as they
      // used to.
      if (!view) {
        text = String(t ?? "");
        sel = [text.length, text.length];
        return;
      }
      view.setState(stateOf(String(t ?? "")));
      view.dispatch({ selection: { anchor: view.state.doc.length } });
    },
    get selectionStart() {
      if (!view) return sel ? Math.min(sel[0], sel[1]) : 0;
      const m = view.state.selection.main;
      return Math.min(m.anchor, m.head);
    },
    get selectionEnd() {
      if (!view) return sel ? Math.max(sel[0], sel[1]) : 0;
      const m = view.state.selection.main;
      return Math.max(m.anchor, m.head);
    },
    setSelectionRange(a, b) {
      if (!view) sel = [a, b ?? a];
      else view.dispatch({ selection: { anchor: a, head: b } });
    },
    focus() {
      if (view) view.focus();
      else wantFocus = true;
    },
    get disabled() {
      return off;
    },
    set disabled(on) {
      off = Boolean(on);
      host.classList.toggle("is-disabled", off);
      if (view) view.dispatch({ effects: access.reconfigure(accessOf(off)) });
    },
    get classList() {
      return host.classList;
    },
    get isConnected() {
      return host.isConnected;
    },
    getBoundingClientRect() {
      return host.getBoundingClientRect();
    },
    setAttribute(name, val) {
      if (!name.startsWith("aria-")) host.setAttribute(name, val);
      else if (view) view.contentDOM.setAttribute(name, val);
      else aria.set(name, String(val));
    },
    removeAttribute(name) {
      if (!name.startsWith("aria-")) host.removeAttribute(name);
      else if (view) view.contentDOM.removeAttribute(name);
      else aria.set(name, null);
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      const set = listeners.get(type);
      if (set) set.delete(fn);
    },
    dispatchEvent(event) {
      if (listeners.has(event.type)) fire(event.type, event);
      else host.dispatchEvent(event);
      return !event.defaultPrevented;
    },
    emitInput() {
      fire("input");
    },
    destroy() {
      if (gone) return;
      gone = true;
      listeners.clear();
      if (view) view.destroy();
    },
  };
  if (off) host.classList.add("is-disabled");
  host.field = field;
  if (cm) build();
  else
    loadEditor().then(
      () => {
        if (!gone) build();
      },
      () => {}
    );
  return field;
}
