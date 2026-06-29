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
 * Client-safe mirror of `determineRegionsToDisplayFromSearchParams`, but over a
 * path segment (`params.regions`) instead of the query string. Splits on `~`,
 * keeps only valid `Regions`, and returns `null` (⇒ all regions) when the
 * segment is absent or yields nothing valid.
 */
export function parseRegionsFromPath(
  value: string | undefined,
): Regions[] | null {
  if (!value) {
    return null;
  }

  const maybeRegions = value
    .split(searchParamSeparator)
    .filter((maybeRegion): maybeRegion is Regions => maybeRegion in Regions);

  return maybeRegions.length === 0 ? null : maybeRegions;
}

/**
 * Canonical region path segment for a selection: empty string when *all* regions
 * are selected (the bare `/{season}` path is the canonical "all"), otherwise the
 * `~`-joined region list in the canonical `orderedRegionsBySize` order.
 */
export function regionsToPathSegment(regions: readonly Regions[]): string {
  if (regions.length >= orderedRegionsBySize.length) {
    return "";
  }

  return orderedRegionsBySize
    .filter((region) => regions.includes(region))
    .join(searchParamSeparator);
}

/**
 * Client-safe mirror of `determineOverlaysToDisplayFromSearchParams` — reads the
 * `overlays` query param without pulling in the server-only `load.server` module.
 */
export function parseOverlaysFromSearchParams(
  params: URLSearchParams,
): Overlay[] | null {
  const maybeOverlays = params.get("overlays");

  // An *absent* param means "default" (⇒ all overlays). A *present but empty*
  // param (`?overlays=`) is an explicit empty selection (⇒ none) and must not
  // collapse back to the all-on default, otherwise deselecting the last overlay
  // silently re-enables every overlay (incl. the Dungeon Records chart).
  if (maybeOverlays === null) {
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
