// Plan2Code Web Console - `@name` suggestions in a text box.
//
// Finds the `@partial` the caret sits in, filters the workspace's folder
// names against it, and splices a pick back into the text. The page owns the
// popover; this file owns the rules. No DOM access at module scope and no
// imports: the page and `node --test` both import this file.

const NAME_CHAR = /[a-z0-9-]/;
const MAX_MATCHES = 6;

/**
 * The mention the caret is in: `{ start, query }`, where `start` is the index
 * of the `@`, or null. The `@` must open the text or follow whitespace or
 * `(`, so an email address never offers suggestions.
 */
export function mentionAt(text, caret) {
  let i = caret;
  while (i > 0 && NAME_CHAR.test(text[i - 1])) i--;
  const at = i - 1;
  if (at < 0 || text[at] !== "@") return null;
  if (at > 0 && !/[\s(]/.test(text[at - 1])) return null;
  return { start: at, query: text.slice(i, caret) };
}

// Names starting with the query first, then names containing it, in the
// order given, at most six.
export function matchNames(names, query) {
  const q = String(query || "");
  const prefix = names.filter((n) => n.startsWith(q));
  const inside = names.filter((n) => !n.startsWith(q) && n.includes(q));
  return [...prefix, ...inside].slice(0, MAX_MATCHES);
}

// The text with `@partial` replaced by `@name `, and the caret after the space.
export function applyMention(text, caret, mention, name) {
  const insert = `@${name} `;
  return {
    text: text.slice(0, mention.start) + insert + text.slice(caret),
    caret: mention.start + insert.length,
  };
}
