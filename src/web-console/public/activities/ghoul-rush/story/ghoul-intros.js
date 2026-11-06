// Plan2Code Web Console - Ghoul Rush's stage intro cards, the words and colors: per stage id, the title, a palette, a kicker line, 3 or 4 lines of flavor text and the boss's name. ghoul-intro-draw.js draws them; scripts/test-web-console-activities-ghoul-intro.mjs makes sure every stage in SELECTABLE (the stages and the finale) has one.
//
// Rules for the text (see "Stage intro screens" in prototypes/Ghoul-Rush-TODO.md):
// 3 or 4 lines, each at most MAX_LINE characters (the card is 96 units wide),
// always addressed to YOU (never the hero's name), no em dash, US English,
// spooky-fun and a little menacing, naming the boss and what it has done.
// The palette: `a` the title's top color, `b` its bottom color, `glow` the
// halo and the flourish's color.

export const MAX_LINE = 60;

const freeze = Object.freeze;
const intro = (title, a, b, glow, kicker, boss, lines) => freeze({ title, palette: freeze({ a, b, glow }), kicker, boss, lines: freeze(lines) });

export const INTROS = freeze({
  manor: intro("The Manor", "#ffb347", "#c2410c", "#ff8a1f", "Where the screaming started", "The Rotting Gourd", [
    "The Manor has stood empty for a century. It is not empty.",
    "The Rotting Gourd grows in the cellar and has gone sour.",
    "It ate the last owners, the staff and the dinner guests.",
    "YOU are next on the menu. Squash it before it squashes YOU.",
  ]),
  wing: intro("The East Wing", "#e9d5ff", "#7c3aed", "#c084fc", "The servants never left", "Old Rattlebones", [
    "The staff kept working long after they stopped breathing.",
    "Old Rattlebones, the butler, still keeps the house tidy.",
    "He keeps the guests too. They are all in the crypt.",
    "Do not let him show YOU in. YOU would never be shown out.",
  ]),
  graveyard: intro("The Graveyard", "#d1fae5", "#4b6a5a", "#9fe6c4", "Everyone here was buried in a hurry", "Mother Mourning", [
    "Nobody here was buried with proper paperwork, or manners.",
    "Mother Mourning weeps at every grave. Count them: all hers.",
    "She turns around when YOU move, and so do the headstones.",
    "Dry her tears for good. YOU have the only handkerchief.",
  ]),
  grounds: intro("The Grounds", "#bef264", "#b45309", "#facc15", "The gardener never stopped working", "The Groundskeeper", [
    "The hedges are trimmed. So is the lawn. So were the guests.",
    "The Groundskeeper walks his rounds with shears and lantern.",
    "He has been pruning the village since before it had a name.",
    "Stay out of his flower beds. YOU would make fine compost.",
  ]),
  chapel: intro("The Chapel", "#fde68a", "#be123c", "#fb923c", "Service is still in session", "The Choirmaster", [
    "The bell tolls hourly, and no one is left to pull the rope.",
    "The Choirmaster drills his pipes until they scream in tune.",
    "He needs one more voice, and he has YOU in mind.",
    "Silence the organ before YOU are asked to sing.",
  ]),
  sanatorium: intro("Blackmoor Sanatorium", "#a7f3d0", "#0f766e", "#5eead4", "Visiting hours ended in 1912", "The Night Matron", [
    "The patients never checked out, and the lights flicker.",
    "The Night Matron makes rounds with a lantern and a needle.",
    "She has cured every ward of everything, including breathing.",
    "Bedtime for YOU, she says. YOU do not intend to nap.",
  ]),
  village: intro("Hollow End Village", "#c4b5fd", "#312e81", "#a5b4fc", "Every curtain twitches as you pass", "The Beast of Hollow End", [
    "Every lock is bolted and every shutter nailed. Not for YOU.",
    "The Beast of Hollow End prowls the rooftops after dark.",
    "It took the baker, the blacksmith and the bell ringer.",
    "The moon is full tonight. YOU are the only one outside.",
  ]),
  mine: intro("The Deep Seam Mine", "#fdba74", "#7c2d12", "#fbbf24", "They are still knocking", "The Tommyknocker", [
    "The miners went down for coal and never came back up.",
    "The Tommyknocker taps on the timbers, and the roof listens.",
    "Follow the knocking and it leads YOU to a dead end.",
    "Bring a light, a steady aim and a very good excuse.",
  ]),
  carnival: intro("The Midnight Carnival", "#fda4af", "#7e22ce", "#f472b6", "Every game is rigged in its favor", "The Ringmaster", [
    "Step right up! The tickets are free, the exits are not.",
    "The Ringmaster pulls the strings, and the whole town dances.",
    "He has been cutting new puppets since the carnival opened.",
    "YOU are in the crowd, so YOU are in the show. Take a bow.",
  ]),
  frozen: intro("The Frozen Lake", "#bae6fd", "#1d4ed8", "#e0f2fe", "The ice remembers who fell through", "The Frost Widow", [
    "The lake froze solid overnight, with the swimmers inside.",
    "The Frost Widow spins her veil from snow and slow breath.",
    "She keeps every one who fell through. YOU are on thin ice.",
    "Melt her heart, if she has one. Watch YOUR step, and toes.",
  ]),
  bog: intro("Gallows Bog", "#d6ee9c", "#44521c", "#9fd06b", "The mud does not like to let go", "Old Mother Bog", [
    "The boardwalk sank years ago. The walkers never left.",
    "Old Mother Bog stirs her pot under the black water.",
    "Chase the pretty lights and they will lead YOU under.",
    "The mud holds what it catches. Do not let it hold YOU.",
  ]),
  marrow: intro("Marrow Manor", "#f3d27a", "#7a2e12", "#c8a04a", "It knows you are home", "Marrow", [
    "Every door YOU picked led here. YOU are back on the lawn.",
    "No more keepers. No more copies. Just the house itself.",
    "It has been eating fright for longer than the valley stood.",
    "Tonight it is hungry, and YOU are the only guest left.",
  ]),
});

// The card for a stage id, or null for an id with none (the hall is no stage and has no card).
export const introFor = (id) => INTROS[id] || null;
