// Plan2Code Web Console - the agents form's row-list editor (arguments and models).
//
// The shared editor behind the three argument lists (args, bypassArgs,
// modelArgs) and the models list. Text rows hold one input; model rows hold an
// id and a name for the menu. Which list it edits and how its rows look come
// from the options, so each field configures its own copy.

import { el } from "../../render.js";

// `list` is the live array being edited (strings, or {id, label?} models).
// `kind` "text" | "models". `onChange` runs after every edit, add or remove.
export function listEditor({ list, kind = "text", field = kind === "models" ? "models" : "", placeholder = "", addLabel = "Add", optionalName = true, aria = "", onChange = () => {} }) {
  const box = el("div", "agent-rows");
  box.dataset.field = field;
  const draw = () => {
    box.replaceChildren();
    list.forEach((item, i) => {
      const row = el("div", kind === "models" ? "agent-row model" : "agent-row");
      const remove = el("button", "btn small ghost", "Remove");
      remove.type = "button";
      remove.addEventListener("click", () => {
        list.splice(i, 1);
        draw();
        onChange();
      });
      if (kind === "models") {
        const id = el("input");
        id.value = item.id || "";
        id.placeholder = optionalName ? "Model id, for {model}" : "Model id";
        id.setAttribute("aria-label", "Model id");
        id.dataset.field = "models";
        const label = el("input");
        label.value = item.label || "";
        label.placeholder = optionalName ? "Name shown in the menu (optional)" : "Name shown in the menu";
        label.setAttribute("aria-label", "Name shown in the menu");
        label.dataset.field = "models";
        id.addEventListener("input", () => {
          item.id = id.value.trim();
          onChange();
        });
        label.addEventListener("input", () => {
          const text = label.value.trim();
          if (text || !optionalName) item.label = text;
          else delete item.label;
          onChange();
        });
        row.append(id, label, remove);
      } else {
        const input = el("input");
        input.value = item;
        input.placeholder = placeholder;
        input.setAttribute("aria-label", aria);
        input.dataset.field = field;
        input.addEventListener("input", () => {
          list[i] = input.value.trim();
          onChange();
        });
        row.append(input, remove);
      }
      box.appendChild(row);
    });
    const add = el("button", "btn small ghost", addLabel);
    add.type = "button";
    add.addEventListener("click", () => {
      list.push(kind === "models" ? (optionalName ? { id: "" } : { id: "", label: "" }) : "");
      draw();
      onChange();
      box.querySelector(".agent-row:last-of-type input")?.focus();
    });
    box.appendChild(add);
  };
  draw();
  return box;
}
