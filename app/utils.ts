import { type Regions } from "@prisma/client";

export const searchParamSeparator = "~";

export const orderedRegionsBySize: Regions[] = ["eu", "us", "tw", "kr"];

export const overlays = [
  "patches",
  "dungeonHotfixes",
  "levelCompletion",
  "affixes",
] as const;

export type Overlay = (typeof overlays)[number];

export const extraOverlayNames: Record<Overlay, string> = {
  dungeonHotfixes: "Dungeon Hotfixes",
  levelCompletion: "Level Completion",
  patches: "Patches",
  affixes: "Affixes",
};

export const isNotNull = <T>(something: T | null): something is T =>
  something !== null;
