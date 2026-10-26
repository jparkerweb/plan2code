// The highlight colors, as data. Kept out of app.js for one reason: app.js
// cannot be imported outside a browser, and thirty-eight colors each with four
// shades in two themes is far too many to trust to eyeballing. The test suite
// imports this and checks every one.
//
// The palette has three colors that MEAN something -- green settled, amber
// waiting, red careful. The reds, golds and greens here are offered anyway,
// because people asked for them; the help text in the dialog says what they
// share a hue with, and the choice is theirs.
//
// Each accent is four values, not one, because one color cannot do four jobs:
//   fill  the highlight itself: filled buttons, the marker on the open step
//   soft  a tint faint enough to sit behind body text
//   ink   what is legible ON the fill. Dark mode's accents are light shades,
//         where a white label falls to about 2:1; they take a near-black.
//   line  the secondary: borders, badge edges, the dashed drop target.
//
// Every pair clears 4.5:1 for ink on fill and for fill on soft (the fill is
// also badge text on the soft tint). Everything after the first five was
// found by stepping lightness until both held, not picked by eye.
//
// Order is the order of the picker: round the wheel, then the grays and Mono
// (near-black in light, near-white in dark). Nineteen a row, so the reds,
// browns, yellows and greens sit on the first, the blues, purples, pinks and
// grays on the second. The pale ones (Peach, Cream, Mint, Aqua, Lavender,
// Pink) are pastels only in dark mode: in light mode a fill has to carry a
// white label, so they come out as deeper shades of the same hue.

export const ACCENTS = {
  // name              fill       soft       ink        line
  maroon: {
    name: "Maroon",
    light: ["#7c1d2d",  "#fbeef1",  "#ffffff",  "#cea1a9"],
    dark: ["#da818f",  "#321b1f",  "#140b0c",  "#76424b"],
  },
  crimson: {
    name: "Crimson",
    light: ["#cd1d41",  "#fbe9ed",  "#ffffff",  "#dcaab4"],
    dark: ["#e75874",  "#321b1f",  "#140b0d",  "#743e49"],
  },
  scarlet: {
    name: "Scarlet",
    light: ["#cf2317",  "#fbebe9",  "#ffffff",  "#ddaaa7"],
    dark: ["#eb594e",  "#321c1b",  "#140b0b",  "#74403c"],
  },
  coral: {
    name: "Coral",
    light: ["#c83510",  "#fbede9",  "#ffffff",  "#dcaca0"],
    dark: ["#ef5b37",  "#321f1b",  "#140d0b",  "#6f4237"],
  },
  peach: {
    name: "Peach",
    light: ["#b44c2d",  "#fbf2ef",  "#ffffff",  "#cdaca2"],
    dark: ["#f9a48b",  "#32201b",  "#140d0b",  "#764e42"],
  },
  tangerine: {
    name: "Tangerine",
    light: ["#b15209",  "#fbf1e9",  "#ffffff",  "#d9af8f"],
    dark: ["#f2700d",  "#32251b",  "#140f0b",  "#664830"],
  },
  rust: {
    name: "Rust",
    light: ["#ae4f2b",  "#fbeee7",  "#ffffff",  "#dd9b7e"],
    dark: ["#e8825a",  "#34211a",  "#1a120e",  "#8a4f36"],
  },
  brown: {
    name: "Brown",
    light: ["#6f472a",  "#f9f4f0",  "#ffffff",  "#c8b5a8"],
    dark: ["#c59877",  "#32241b",  "#140f0b",  "#765842"],
  },
  clay: {
    name: "Clay",
    light: ["#8d644c",  "#f5f2f0",  "#ffffff",  "#bfafa6"],
    dark: ["#ba957f",  "#2b2521",  "#17100c",  "#62544b"],
  },
  gold: {
    name: "Gold",
    light: ["#896b09",  "#fbf7e9",  "#ffffff",  "#ccb66d"],
    dark: ["#f0bb0f",  "#322c1b",  "#14120b",  "#584d2a"],
  },
  cream: {
    name: "Cream",
    light: ["#776740",  "#f8f6f2",  "#ffffff",  "#c0b9aa"],
    dark: ["#f1e1bc",  "#322b1b",  "#14110b",  "#766642"],
  },
  lemon: {
    name: "Lemon",
    light: ["#7e7607",  "#fcfbee",  "#ffffff",  "#c5bf67"],
    dark: ["#f0e442",  "#32301b",  "#14130b",  "#767242"],
  },
  olive: {
    name: "Olive",
    light: ["#72742c",  "#f8f8ed",  "#ffffff",  "#b8ba8c"],
    dark: ["#b5b946",  "#31321b",  "#14140b",  "#4f5037"],
  },
  lime: {
    name: "Lime",
    light: ["#577a1a",  "#f4fbea",  "#ffffff",  "#a6c07a"],
    dark: ["#96d22d",  "#29321b",  "#11140b",  "#465230"],
  },
  moss: {
    name: "Moss",
    light: ["#577740",  "#f2f6ee",  "#ffffff",  "#acbca1"],
    dark: ["#79a659",  "#24321b",  "#0f140b",  "#475140"],
  },
  forest: {
    name: "Forest",
    light: ["#216337",  "#f0faf3",  "#ffffff",  "#9cc4a9"],
    dark: ["#6bbd86",  "#1b3222",  "#0b140e",  "#427653"],
  },
  emerald: {
    name: "Emerald",
    light: ["#207e47",  "#ebfaf1",  "#ffffff",  "#8ac4a2"],
    dark: ["#33cc73",  "#1b3224",  "#0b140f",  "#345542"],
  },
  mint: {
    name: "Mint",
    light: ["#25805a",  "#effaf6",  "#ffffff",  "#97c4b1"],
    dark: ["#8be4bf",  "#1b3228",  "#0b1410",  "#427660"],
  },
  teal: {
    name: "Teal",
    light: ["#0f766e",  "#e2f1ef",  "#ffffff",  "#6fb3aa"],
    dark: ["#5ecfc0",  "#14302c",  "#0b1a18",  "#3a7d74"],
  },
  aqua: {
    name: "Aqua",
    light: ["#177e82",  "#eefbfc",  "#ffffff",  "#8dc6c8"],
    dark: ["#84e8eb",  "#1b3132",  "#0b1414",  "#427476"],
  },
  cyan: {
    name: "Cyan",
    light: ["#0f798a",  "#ebf7f9",  "#ffffff",  "#75bec9"],
    dark: ["#19cae6",  "#183034",  "#0c1617",  "#305f66"],
  },
  sky: {
    name: "Sky",
    light: ["#0e74a7",  "#ebf5fa",  "#ffffff",  "#85b9d3"],
    dark: ["#21a9ed",  "#182b35",  "#0c1417",  "#325c71"],
  },
  ocean: {
    name: "Ocean",
    light: ["#206cc3",  "#ecf2f9",  "#ffffff",  "#9ab4d3"],
    dark: ["#619fe5",  "#1a2533",  "#0c1117",  "#3d5978"],
  },
  cobalt: {
    name: "Cobalt",
    light: ["#405ce7",  "#ebeef9",  "#ffffff",  "#a8b0dc"],
    dark: ["#7b8fef",  "#191d34",  "#0c0e17",  "#465392"],
  },
  navy: {
    name: "Navy",
    light: ["#24396b",  "#eef0f7",  "#ffffff",  "#a7b3cd"],
    dark: ["#819ad5",  "#1e232f",  "#0c1017",  "#4a5775"],
  },
  indigo: {
    name: "Indigo",
    light: ["#4f46e5",  "#ecebfb",  "#ffffff",  "#9b95ef"],
    dark: ["#a5a0ff",  "#1e1d3a",  "#121129",  "#5f5ba8"],
  },
  lavender: {
    name: "Lavender",
    light: ["#6f61b8",  "#f2f1f9",  "#ffffff",  "#afaac5"],
    dark: ["#b9acf6",  "#1f1b32",  "#0c0b14",  "#4d4479"],
  },
  violet: {
    name: "Violet",
    light: ["#7f4dd5",  "#f1edf8",  "#ffffff",  "#bbabd6"],
    dark: ["#a785e2",  "#231c31",  "#100c17",  "#624c87"],
  },
  orchid: {
    name: "Orchid",
    light: ["#a141b9",  "#f5eef7",  "#ffffff",  "#c5a8cc"],
    dark: ["#c281d3",  "#2b1e2f",  "#150c17",  "#6c4b74"],
  },
  magenta: {
    name: "Magenta",
    light: ["#b82eaa",  "#f8edf7",  "#ffffff",  "#d1a3cc"],
    dark: ["#dc72d1",  "#311c2f",  "#170c16",  "#784573"],
  },
  plum: {
    name: "Plum",
    light: ["#8a3b6b",  "#f8eaf2",  "#ffffff",  "#c88cb0"],
    dark: ["#e08ab8",  "#331a29",  "#1d1017",  "#8a5570"],
  },
  rose: {
    name: "Rose",
    light: ["#c42e6a",  "#f8edf1",  "#ffffff",  "#d3a6b8"],
    dark: ["#df77a0",  "#311c24",  "#170c11",  "#7c465b"],
  },
  pink: {
    name: "Pink",
    light: ["#b23875",  "#faeff5",  "#ffffff",  "#caa5b8"],
    dark: ["#f7a1cc",  "#321b26",  "#140b0f",  "#76425c"],
  },
  mauve: {
    name: "Mauve",
    light: ["#816281",  "#f4f1f4",  "#ffffff",  "#bbafbb"],
    dark: ["#ae93ae",  "#292329",  "#170c17",  "#5f545f"],
  },
  steel: {
    name: "Steel",
    light: ["#50737c",  "#f0f3f4",  "#ffffff",  "#a5b5b8"],
    dark: ["#7fa4ad",  "#22292a",  "#0c1517",  "#4c595c"],
  },
  slate: {
    name: "Slate",
    light: ["#5b6e88",  "#f0f2f4",  "#ffffff",  "#acb3bc"],
    dark: ["#8e9eb4",  "#23262a",  "#0c1117",  "#515861"],
  },
  graphite: {
    name: "Graphite",
    light: ["#4a4640",  "#eeedea",  "#ffffff",  "#a8a196"],
    dark: ["#cfc7bb",  "#2b2a28",  "#161513",  "#7a7369"],
  },
  mono: {
    name: "Mono",
    light: ["#1f1f1f",  "#efefef",  "#ffffff",  "#a3a3a3"],
    dark: ["#ececec",  "#2a2a2a",  "#141414",  "#6e6e6e"],
  },
};

export const DEFAULT_ACCENT = "ocean";

// Colors that were merged into a near twin when the picker grew to Paint's
// range. A looks.json saved with one keeps the closest color, not the default.
export const RETIRED_ACCENTS = { copper: "rust", marigold: "gold", mustard: "lemon", jade: "emerald", lilac: "violet" };

export function accentId(value) {
  const id = String(value);
  if (Object.hasOwn(ACCENTS, id)) return id;
  return Object.hasOwn(RETIRED_ACCENTS, id) ? RETIRED_ACCENTS[id] : DEFAULT_ACCENT;
}

// The card-width presets. Here for the same reason the accents are: the page
// validates a saved `looks.width` with cardWidth(), and the server uses it to
// paint the first-load `data-width` attribute before app.js runs. One list,
// two readers, no drift.
export const CARD_WIDTHS = {
  narrow: { label: "Narrow", px: 720 },
  comfortable: { label: "Comfortable", px: 880 },
  wide: { label: "Wide", px: 1080 },
};

export const DEFAULT_CARD_WIDTH = "comfortable";

export function cardWidth(value) {
  return typeof value === "string" && Object.hasOwn(CARD_WIDTHS, value) ? value : DEFAULT_CARD_WIDTH;
}

// Every moment the page makes a noise, each switchable on its own in User
// Preferences (the `data-sound` boxes in index.html). Several share a file;
// the event, not the file, is what a person turns off. `rank` settles which
// wins when two ask at once (see the sounds section in app.js). Stored flat as
// `soundQuestion` and so on, because looks.json only holds flat values.
export const SOUND_EVENTS = {
  startSkill: { file: "start-skill", rank: 5 },
  bootup: { file: "bootup", rank: 4 },
  sessionStart: { file: "start-stop", rank: 3 },
  sessionEnd: { file: "start-stop", rank: 3 },
  question: { file: "next", rank: 2 },
  skillReady: { file: "next", rank: 2 },
  chatReply: { file: "next", rank: 2 },
  newTab: { file: "insert", rank: 1 },
  snore: { file: "sleeping", rank: 0 },
};

export const soundKey = (event) => "sound" + event[0].toUpperCase() + event.slice(1);

// The per-event switches out of a saved looks object: each one as saved when
// it is a boolean, on otherwise. A looks.json from before the switches has
// none of these keys, so it keeps every sound.
export function soundPrefs(saved) {
  const source = saved && typeof saved === "object" ? saved : {};
  return Object.fromEntries(
    Object.keys(SOUND_EVENTS).map((event) => {
      const value = source[soundKey(event)];
      return [soundKey(event), typeof value === "boolean" ? value : true];
    })
  );
}
