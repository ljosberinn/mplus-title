import { Regions } from "prisma/generated/prisma/enums";

export const searchParamSeparator = "~";

export const orderedRegionsBySize = [
  Regions.EU,
  Regions.US,
  Regions.CN,
  Regions.TW,
  Regions.KR,
];

export const overlays = [
  "patches",
  "dungeonHotfixes",
  "levelCompletion",
  "affixes",
  "records",
  "extrapolation",
] as const;

export type Overlay = (typeof overlays)[number];

export const extraOverlayNames: Record<Overlay, string> = {
  dungeonHotfixes: "Dungeon Hotfixes",
  levelCompletion: "Level Completion",
  patches: "Patches",
  affixes: "Affixes",
  records: "Records",
  extrapolation: "Extrapolation History",
};

export const isNotNull = <T>(something: T | null): something is T =>
  something !== null;

/**
 * Client-safe mirror of `determineOverlaysToDisplayFromSearchParams` — reads the
 * `overlays` query param without pulling in the server-only `load.server` module.
 */
export function parseOverlaysFromSearchParams(
  params: URLSearchParams,
): Overlay[] | null {
  const maybeOverlays = params.get("overlays");

  if (!maybeOverlays) {
    return null;
  }

  const fromSearchParams = new Set(maybeOverlays.split(searchParamSeparator));

  return overlays.filter((overlay) => fromSearchParams.has(overlay));
}

/**
 * Resolves the overlays a chart should display: the parsed selection (or all
 * overlays by default), minus `affixes` for modern seasons (`zoneId > 39`).
 * Mirrors the default filtering previously done in `getEnhancedSeason`.
 */
export function resolveOverlaysToDisplay(
  zoneId: number | undefined,
  parsed: Overlay[] | null,
): Overlay[] {
  return (parsed ?? [...overlays]).filter((overlay) => {
    if ((zoneId ?? 0) > 39) {
      return overlay !== "affixes";
    }

    return true;
  });
}
