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

import {
  Compartment,
  EditorState,
  EditorView,
  defaultKeymap,
  history,
  historyKeymap,
  keymap,
  markdown,
  markdownLanguage,
  placeholder,
  redo,
} from "./vendor/codemirror.esm.js";
import { livePreview } from "./notepad-editor.js";

// These listeners run as the editor's own DOM handlers, before its keymaps:
// a preventDefault there (the mention popover's keys, a pure-image paste)
// still beats CodeMirror's own handling.
const HANDLED = ["keydown", "keyup", "paste", "blur", "focus"];

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
  const access = new Compartment();
  // editable, not only readOnly: a disabled field cannot take the focus,
  // which is the difference a textarea's own disabled attribute shows.
  const accessOf = (on) =>
    on
      ? [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.contentAttributes.of({ "aria-disabled": "true" }),
        ]
      : [];

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
  const stateOf = (text) => EditorState.create({ doc: text, extensions: [...extensions, access.of(accessOf(off))] });
  const view = new EditorView({ state: stateOf(String(value ?? "")), parent: mount, root });
  // The stylesheets arrive after the first measure: measure again once they
  // have, or the lines would keep their unstyled height until the next edit.
  for (const sheet of sheets) sheet.addEventListener("load", () => view.requestMeasure());

  const field = {
    el: host,
    view,
    get value() {
      return view.state.doc.toString();
    },
    set value(text) {
      // setState neither reports a change nor keeps the undo steps, exactly
      // the swap a textarea's value assignment makes. A fresh state parks its
      // caret at 0; a textarea's collapses to the end, so callers that fill
      // and focus (Autofill, quick answers, Reset to default) append as they
      // used to.
      view.setState(stateOf(String(text ?? "")));
      view.dispatch({ selection: { anchor: view.state.doc.length } });
    },
    get selectionStart() {
      const m = view.state.selection.main;
      return Math.min(m.anchor, m.head);
    },
    get selectionEnd() {
      const m = view.state.selection.main;
      return Math.max(m.anchor, m.head);
    },
    setSelectionRange(a, b) {
      view.dispatch({ selection: { anchor: a, head: b } });
    },
    focus() {
      view.focus();
    },
    get disabled() {
      return off;
    },
    set disabled(on) {
      off = Boolean(on);
      host.classList.toggle("is-disabled", off);
      view.dispatch({ effects: access.reconfigure(accessOf(off)) });
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
      (name.startsWith("aria-") ? view.contentDOM : host).setAttribute(name, val);
    },
    removeAttribute(name) {
      (name.startsWith("aria-") ? view.contentDOM : host).removeAttribute(name);
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
      listeners.clear();
      view.destroy();
    },
  };
  if (off) host.classList.add("is-disabled");
  host.field = field;
  return field;
}
