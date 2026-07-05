import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(
  root,
  "references/text/All_War_of_the_Ring_cards_with_their_characteristics_and_functions_version_0.2.txt",
);
const targetPath = path.join(root, "src/referenceData.ts");

const source = fs.readFileSync(sourcePath, "utf8");
const lines = source.split(/\r?\n/);

const playerBySheet = {
  Aragorn: "aragorn",
  Frodo: "frodo",
  Saruman: "saruman",
  Witchking: "witchKing",
};

const factionByName = new Map(
  Object.entries({
    "Dead man of Dunharow": "dunedain",
    "Knights of Dol Amroth": "dunedain",
    "Guards of the Citadel": "dunedain",
    "Soldiers of Gondor": "dunedain",
    "The Greatt Gate": "dunedain",
    Aragorn: "dunedain",
    Boromir: "dunedain",
    Denethor: "dunedain",
    Faramir: "dunedain",
    Halbarad: "dunedain",
    "Prince Imrahil": "dunedain",
    Strider: "dunedain",
    Ioreth: "dunedain",
    "Andûril": "dunedain",
    "Blade of Westernesse": "dunedain",
    "Paths of the Dead": "dunedain",
    "The Red Arrow": "dunedain",
    "The three Hunters": "dunedain",
    "High Elves": "elf",
    Arwen: "elf",
    Elrond: "elf",
    Galadriel: "elf",
    Legolas: "elf",
    "Bow of Galadhrim": "elf",
    "Elven Cloak": "elf",
    Lembas: "elf",
    "Mirror of Galadriel": "elf",
    "Nenya, Ring of Adamant": "elf",
    "Phial of Galadriel": "elf",
    "Vilya, Ring of Air": "elf",
    Gimli: "dwarf",
    "Dwarven Axe": "dwarf",
    "Frodo Baggins": "hobbit",
    "Merry Brandybuck": "hobbit",
    "Pippin Took": "hobbit",
    "Sam Gamgee": "hobbit",
    "Bilbo Baggins": "hobbit",
    "Fatty Bolger": "hobbit",
    "Herbs & stewed Rabbit": "hobbit",
    Sting: "hobbit",
    "Mithril Coat": "hobbit",
    "There is another way": "hobbit",
    "Riders of Rohan": "rohan",
    "Village Militia": "rohan",
    Eomer: "rohan",
    Eowyn: "rohan",
    "Ghan-Buri-Ghan": "rohan",
    Theoden: "rohan",
    Shadowfax: "rohan",
    "Death! Ride, ride to ruin": "rohan",
    "Gandalf the Grey": "wizard",
    "Gandalf the White": "wizard",
    "Treebeard (Ent)": "wizard",
    "Quickbeam (Ent)": "wizard",
    Smeagol: "wizard",
    "Gwaihir the Windlord": "wizard",
    "Gandalfs Staff": "wizard",
    Glamdring: "wizard",
    "Narya, Ring of Fire": "wizard",
    "Ent-draught": "wizard",
    "Devilry of Satruman": "isengard",
    "Fighting Uruk-Hai": "isengard",
    "Wolf Riders": "isengard",
    "White Hand Orcs": "isengard",
    "Grima Wormtongue": "isengard",
    Saruman: "isengard",
    Ugluk: "isengard",
    Palantir: "isengard",
    "Saruman's Staff": "isengard",
    "Woven of all colours": "isengard",
    "Threats and Promises": "isengard",
    "Goblins Misty Mountains": "monstrous",
    "Barrow-Wights": "monstrous",
    "Flocks of Crebain": "monstrous",
    "Hill Troll": "monstrous",
    Balrog: "monstrous",
    Caradhras: "monstrous",
    "Cave Troll": "monstrous",
    "Candles of Corpses": "monstrous",
    Gollum: "monstrous",
    Shelob: "monstrous",
    "Whip of many Thongs": "monstrous",
    "Haradrim Mûmakil": "southron",
    "Coastal Raiders": "southron",
    "Haradrim Cavalry": "southron",
    "The Black Fleet": "southron",
    "Corsairs of Umbar": "southron",
    "Haradrim Regulars": "southron",
    "The Black Serpent": "southron",
    "Grond, hammer underworld": "mordor",
    "Olog-Hai": "mordor",
    "Trolls of Udûn": "mordor",
    "Black Uruks": "mordor",
    "Mordor Orcs": "mordor",
    "The Witch-King (Nazgûl)": "mordor",
    "The Reaver (Nazgûl)": "mordor",
    "The Beguiler (Nazgûl)": "mordor",
    "The Hunter (Nazgûl)": "mordor",
    "The Messenger (Nazgûl)": "mordor",
    "The Black Easterling (Nazgûl)": "mordor",
    "The Commander (Nazgûl)": "mordor",
    "The Destroyer (Nazgûl)": "mordor",
    "The Warrior (Nazgûl)": "mordor",
    Grishnakh: "mordor",
    "Mouth of Sauron": "mordor",
    "Gorbag & Shagrat": "mordor",
    "The Lidless Eye": "mordor",
    Gothmog: "mordor",
    "Nazgûls Mantle": "mordor",
    "Black Breath": "mordor",
    "Black Riders Mount": "mordor",
    "Fell Beast": "mordor",
    "Morgul Blade": "mordor",
    "The Black Captain": "mordor",
    "The Ringwraiths are abroad": "mordor",
    "The Day without Dawn": "mordor",
  }),
);

const typeMap = {
  Army: "army",
  "Army ": "army",
  "Char.": "character",
  Item: "item",
  Event: "event",
};

const paths = [];
const battlegrounds = [];
const cards = [];
let sheet = null;

for (const [index, line] of lines.entries()) {
  const sourceLine = index + 1;
  if (line.startsWith("--- Sheet: ")) {
    sheet = line.replace("--- Sheet: ", "").replace(" ---", "");
    continue;
  }
  if (line.trim() === "" || line.startsWith("Type\t") || line.startsWith("Ring \t")) {
    continue;
  }

  if (sheet === "Paths & Battlefields") {
    const columns = line.split("\t");
    const ring = parseInt(columns[0] ?? "", 10);
    if (!Number.isFinite(ring)) {
      continue;
    }
    const pathName = clean(columns[1] ?? "");
    if (pathName !== "") {
      paths.push({
        id: slug(pathName),
        title: pathName,
        pathNumber: ring,
        defenseIcons: numeric(columns[3] ?? ""),
        victoryPoints: numeric(columns[2] ?? ""),
        text: clean(columns[4] ?? ""),
        sourceLine,
      });
    }
    const battlegroundName = clean(columns[6] ?? "");
    if (battlegroundName !== "") {
      const defendingFactions = columns.slice(10, 12).map(clean).filter(Boolean);
      const attackingFactions = columns.slice(12).map(clean).filter(Boolean);
      battlegrounds.push({
        id: slug(battlegroundName),
        title: battlegroundName,
        side: defenderSide(defendingFactions),
        defenseIcons: numeric(columns[8] ?? ""),
        victoryPoints: numeric(columns[7] ?? ""),
        text: clean(columns[9] ?? ""),
        defendingFactions: defendingFactions.map(faction),
        attackingFactions: attackingFactions.map(faction),
        sourceLine,
      });
    }
    continue;
  }

  if (!playerBySheet[sheet]) {
    continue;
  }

  const columns = line.split("\t");
  const rawType = columns[0] ?? "";
  const type = typeMap[rawType];
  if (!type) {
    continue;
  }
  const title = clean(columns[1] ?? "");
  const cardFaction = factionByName.get(title);
  if (!cardFaction) {
    throw new Error(`No faction mapping for ${title} at line ${sourceLine}`);
  }
  cards.push({
    id: `${slug(title)}-${sourceLine}`,
    title,
    type,
    faction: cardFaction,
    owner: playerBySheet[sheet],
    pathIcons: icons(columns[3] ?? ""),
    battlegroundAttack: icons(columns[4] ?? ""),
    battlegroundDefense: icons(columns[5] ?? ""),
    leadershipAttack: leadershipIcons(columns[4] ?? ""),
    leadershipDefense: leadershipIcons(columns[5] ?? ""),
    allowedPaths: parsePaths(columns[2] ?? ""),
    allowedWielders: parseWielders(columns[2] ?? ""),
    text: clean(columns.slice(6).join(" ")),
    sourceLine,
  });
}

const out = `// Generated by scripts/generate-reference-data.mjs from references/text/All_War_of_the_Ring_cards_with_their_characteristics_and_functions_version_0.2.txt
// Do not edit by hand.

import type { BattlegroundDefinition, CardDefinition, PathDefinition } from "./types";

export const sourcePaths = ${JSON.stringify(paths, null, 2)} as const satisfies readonly PathDefinition[];

export const sourceBattlegrounds = ${JSON.stringify(battlegrounds, null, 2)} as const satisfies readonly BattlegroundDefinition[];

export const sourceCards = ${JSON.stringify(cards, null, 2)} as const satisfies readonly CardDefinition[];
`;

fs.writeFileSync(targetPath, out);

function clean(value) {
  return value.replace(/\s+/g, " ").trim();
}

function numeric(value) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function icons(value) {
  return numeric(value.replace(/\(.+?\)/g, ""));
}

function leadershipIcons(value) {
  const matches = value.match(/\((\d+)\)/g) ?? [];
  return matches.reduce((sum, match) => sum + numeric(match), 0);
}

function parsePaths(value) {
  const text = clean(value);
  if (text === "" || /[A-Za-z]/.test(text)) {
    return [];
  }
  return text.split("/").flatMap((part) => {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = numeric(range[1]);
      const end = numeric(range[2]);
      return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
    }
    const single = numeric(part);
    return single === 0 ? [] : [single];
  });
}

function parseWielders(value) {
  const text = clean(value);
  if (text === "" || /^\d/.test(text)) {
    return [];
  }
  return text.split(/\s*(?:\/|,|\bor\b)\s*/i).filter(Boolean);
}

function faction(value) {
  const normalized = slug(value);
  if (normalized === "dunedain") return "dunedain";
  if (normalized === "dwarf") return "dwarf";
  if (normalized === "elf") return "elf";
  if (normalized === "hobbit") return "hobbit";
  if (normalized === "rohan") return "rohan";
  if (normalized === "wizard") return "wizard";
  if (normalized === "isengard") return "isengard";
  if (normalized === "monstrous") return "monstrous";
  if (normalized === "mordor") return "mordor";
  if (normalized === "southron") return "southron";
  throw new Error(`Unknown faction: ${value}`);
}

function defenderSide(defenders) {
  return defenders.some((candidate) =>
    ["Wizard", "Rohan", "Elf", "Dunedain", "Dwarf", "Hobbit"].includes(candidate),
  )
    ? "free"
    : "shadow";
}

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/û/g, "u")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
