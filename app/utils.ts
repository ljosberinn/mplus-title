import { Regions } from "@prisma/client";

export const searchParamSeparator = "~";

export const orderedRegionsBySize = [
  Regions.EU,
  Regions.US,
  Regions.TW,
  Regions.KR,
];

export const overlays = [
  "patches",
  "dungeonHotfixes",
  "levelCompletion",
  "affixes",
  "records",
] as const;

export type Overlay = (typeof overlays)[number];

export const extraOverlayNames: Record<Overlay, string> = {
  dungeonHotfixes: "Dungeon Hotfixes",
  levelCompletion: "Level Completion",
  patches: "Patches",
  affixes: "Affixes",
  records: "Records",
};

export const isNotNull = <T>(something: T | null): something is T =>
  something !== null;
