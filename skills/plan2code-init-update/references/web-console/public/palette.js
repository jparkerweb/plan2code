// The highlight colors, as data. Kept out of app.js for one reason: app.js
// cannot be imported outside a browser, and thirty-two colors each with four
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
// Order is the order of the picker: round the wheel, then the greys. Sixteen
// a row, so the warm half and the greens sit on the first, the blues, purples,
// pinks and greys on the second.

export const ACCENTS = {
  // name              fill       soft       ink        line
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
  rust: {
    name: "Rust",
    light: ["#ae4f2b",  "#fbeee7",  "#ffffff",  "#dd9b7e"],
    dark: ["#e8825a",  "#34211a",  "#1a120e",  "#8a4f36"],
  },
  tangerine: {
    name: "Tangerine",
    light: ["#b15209",  "#fbf1e9",  "#ffffff",  "#d9af8f"],
    dark: ["#f2700d",  "#32251b",  "#140f0b",  "#664830"],
  },
  copper: {
    name: "Copper",
    light: ["#a2592f",  "#f9f0eb",  "#ffffff",  "#cdb2a2"],
    dark: ["#cb7a4b",  "#32231b",  "#140e0b",  "#5f493d"],
  },
  clay: {
    name: "Clay",
    light: ["#8d644c",  "#f5f2f0",  "#ffffff",  "#bfafa6"],
    dark: ["#ba957f",  "#2b2521",  "#17100c",  "#62544b"],
  },
  marigold: {
    name: "Marigold",
    light: ["#9a6406",  "#fbf5e9",  "#ffffff",  "#d3b279"],
    dark: ["#f59f0a",  "#32291b",  "#14110b",  "#5e4c2c"],
  },
  gold: {
    name: "Gold",
    light: ["#896b09",  "#fbf7e9",  "#ffffff",  "#ccb66d"],
    dark: ["#f0bb0f",  "#322c1b",  "#14120b",  "#584d2a"],
  },
  mustard: {
    name: "Mustard",
    light: ["#806f1b",  "#fbf8ea",  "#ffffff",  "#c3b881"],
    dark: ["#d2b72d",  "#322e1b",  "#14120b",  "#544e31"],
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
  emerald: {
    name: "Emerald",
    light: ["#207e47",  "#ebfaf1",  "#ffffff",  "#8ac4a2"],
    dark: ["#33cc73",  "#1b3224",  "#0b140f",  "#345542"],
  },
  jade: {
    name: "Jade",
    light: ["#297c61",  "#ecf9f4",  "#ffffff",  "#92c1b1"],
    dark: ["#40bf95",  "#1b322a",  "#0b1411",  "#38544b"],
  },
  teal: {
    name: "Teal",
    light: ["#0f766e",  "#e2f1ef",  "#ffffff",  "#6fb3aa"],
    dark: ["#5ecfc0",  "#14302c",  "#0b1a18",  "#3a7d74"],
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
  navy: {
    name: "Navy",
    light: ["#24396b",  "#eef0f7",  "#ffffff",  "#a7b3cd"],
    dark: ["#819ad5",  "#1e232f",  "#0c1017",  "#4a5775"],
  },
  cobalt: {
    name: "Cobalt",
    light: ["#405ce7",  "#ebeef9",  "#ffffff",  "#a8b0dc"],
    dark: ["#7b8fef",  "#191d34",  "#0c0e17",  "#465392"],
  },
  indigo: {
    name: "Indigo",
    light: ["#4f46e5",  "#ecebfb",  "#ffffff",  "#9b95ef"],
    dark: ["#a5a0ff",  "#1e1d3a",  "#121129",  "#5f5ba8"],
  },
  violet: {
    name: "Violet",
    light: ["#7f4dd5",  "#f1edf8",  "#ffffff",  "#bbabd6"],
    dark: ["#a785e2",  "#231c31",  "#100c17",  "#624c87"],
  },
  lilac: {
    name: "Lilac",
    light: ["#8b51b8",  "#f3eff6",  "#ffffff",  "#beaccb"],
    dark: ["#b189cf",  "#271f2d",  "#130c17",  "#634f73"],
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
  mauve: {
    name: "Mauve",
    light: ["#816281",  "#f4f1f4",  "#ffffff",  "#bbafbb"],
    dark: ["#ae93ae",  "#292329",  "#170c17",  "#5f545f"],
  },
  graphite: {
    name: "Graphite",
    light: ["#4a4640",  "#eeedea",  "#ffffff",  "#a8a196"],
    dark: ["#cfc7bb",  "#2b2a28",  "#161513",  "#7a7369"],
  },
};

export const DEFAULT_ACCENT = "rust";

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
