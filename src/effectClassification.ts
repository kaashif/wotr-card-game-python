import { battlegroundDefinitions, cardDefinitions, pathDefinitions } from "./data";

export type EffectTag =
  | "activate-battleground"
  | "activate-path"
  | "attach-item"
  | "carryover"
  | "corruption"
  | "cycle"
  | "draw"
  | "draw-play-cycle-rest"
  | "eliminate"
  | "forsake"
  | "move"
  | "replacement"
  | "reserve-action"
  | "search"
  | "token"
  | "when-played"
  | "when-played-or-moved";

export interface EffectClassification {
  readonly id: string;
  readonly kind: "card" | "path" | "battleground";
  readonly title: string;
  readonly text: string;
  readonly tags: readonly EffectTag[];
  readonly sourceLine: number;
}

export const effectClassifications: readonly EffectClassification[] = [
  ...cardDefinitions.map((card) => ({
    id: card.id,
    kind: "card" as const,
    title: card.title,
    text: card.text,
    tags: classifyEffectText(card.text, card.type === "item"),
    sourceLine: card.sourceLine,
  })),
  ...pathDefinitions.map((path) => ({
    id: path.id,
    kind: "path" as const,
    title: path.title,
    text: path.text,
    tags: classifyEffectText(path.text, false),
    sourceLine: path.sourceLine,
  })),
  ...battlegroundDefinitions.map((battleground) => ({
    id: battleground.id,
    kind: "battleground" as const,
    title: battleground.title,
    text: battleground.text,
    tags: classifyEffectText(battleground.text, false),
    sourceLine: battleground.sourceLine,
  })),
];

export function classifyEffectText(text: string, isItem: boolean): readonly EffectTag[] {
  const normalized = text.toLowerCase();
  const tags = new Set<EffectTag>();
  if (isItem) {
    tags.add("attach-item");
  }
  if (/\bdraw(s| \d|\+| each| top)?\b/.test(normalized)) {
    tags.add("draw");
  }
  if (normalized.includes("cycle")) {
    tags.add("cycle");
  }
  if (normalized.includes("forsake")) {
    tags.add("forsake");
  }
  if (normalized.includes("eliminate") || normalized.includes("remove")) {
    tags.add("eliminate");
  }
  if (normalized.includes("take ") || normalized.includes("from your draw deck")) {
    tags.add("search");
  }
  if (normalized.includes("reserve")) {
    tags.add("reserve-action");
  }
  if (normalized.includes("activate") && normalized.includes("battleground")) {
    tags.add("activate-battleground");
  }
  if (normalized.includes("activate") && normalized.includes("path")) {
    tags.add("activate-path");
  }
  if (normalized.includes("move")) {
    tags.add("move");
  }
  if (normalized.includes("token") || normalized.includes("marker")) {
    tags.add("token");
  }
  if (normalized.includes("corruption")) {
    tags.add("corruption");
  }
  if (normalized.includes("carryover") || normalized.includes("col")) {
    tags.add("carryover");
  }
  if (normalized.includes("cycle instead")) {
    tags.add("replacement");
  }
  if (normalized.includes("when played or moved")) {
    tags.add("when-played-or-moved");
  } else if (normalized.includes("when played")) {
    tags.add("when-played");
  }
  if (normalized.includes("draw 5") || normalized.includes("draw 7") || normalized.includes("cycle the rest")) {
    tags.add("draw-play-cycle-rest");
  }
  return [...tags].sort();
}
