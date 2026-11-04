// Plan2Code Web Console - Ghoul Rush's boss intro cards, the words: per boss id, the boss's name and a one-line epithet. ghoul-bossintro-draw.js draws the card; scripts/test-web-console-activities-ghoul-bossintro.mjs makes sure every boss room has an entry.
//
// Rules (see "Boss intro screens" in prototypes/Ghoul-Rush-TODO.md):
// `name` must equal the boss's `name` in its stage pack's `bosses` table (the
// Gourd's is in BOSSES in ghoul.js); `epithet` is a short menacing tagline,
// at most MAX_EPITHET characters, US English, no em dash, never the hero's
// name (if it addresses the player at all, it is YOU). `accent` is optional:
// the color of the name and the spotlight's rim (the boss's own color by default).
// The card's backdrop uses the stage's palette from ghoul-intros.js.

export const MAX_EPITHET = 44;

const freeze = Object.freeze;
const entry = (name, epithet, accent = null) => freeze({ name, epithet, accent });

export const BOSS_INTROS = freeze({
  gourd: entry("The Rotting Gourd", "Harvest time is over"),
  bones: entry("Old Rattlebones", "At your service. Forever."),
  angel: entry("Mother Mourning", "She has been waiting for YOU"),
  keeper: entry("The Groundskeeper", "Everything gets trimmed"),
  choirmaster: entry("The Choirmaster", "One more voice for the choir"),
  matron: entry("The Night Matron", "Lights out, dear"),
  beast: entry("The Beast of Hollow End", "The moon is full tonight"),
  tommy: entry("The Tommyknocker", "Knock knock. Nobody is home"),
  ringmaster: entry("The Ringmaster", "The show must go on"),
  frostwidow: entry("The Frost Widow", "Cold hands, colder heart"),
  motherbog: entry("Old Mother Bog", "Dinner climbed in on its own"),
  marrow: entry("Marrow", "It has been expecting YOU"),
  marroweye: entry("Marrow, Every Room at Once", "Make yourself at home"),
  marrowheart: entry("The Heart of Marrow", "It has never once skipped a beat"),
});

// The card for a boss id, or null for a boss with none.
export const bossIntroFor = (id) => BOSS_INTROS[id] || null;
