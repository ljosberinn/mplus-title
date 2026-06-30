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
  // core: the score cutoff lines + their forward projection
  "score",
  "score100",
  // extras: annotations
  "patches",
  "dungeonHotfixes",
  "levelCompletion",
  "affixes",
  "mythicStats",
  "extrapolation",
  // other: the separate dungeon-records chart
  "records",
] as const;

export type Overlay = (typeof overlays)[number];

/** Features shown on by default. Extrapolation History is opt-in (it's a noisy
 * scatter), everything else defaults on. An absent `?overlays=` param means
 * "default" and resolves to this set. */
export const defaultOverlays: Overlay[] = overlays.filter(
  (overlay) => overlay !== "extrapolation",
);

/** Whether a selection equals the default set — used to decide when the
 * `?overlays=` param (and its cookie) can be dropped, since an absent param
 * already means "default". */
export function isDefaultOverlaySelection(
  selected: readonly Overlay[],
): boolean {
  return (
    selected.length === defaultOverlays.length &&
    defaultOverlays.every((overlay) => selected.includes(overlay))
  );
}

/** The three menu sections the features are grouped under. */
export type FeatureGroup = "core" | "extras" | "other";

/** Section order + headings for the Features menu. */
export const featureGroups: { group: FeatureGroup; label: string }[] = [
  { group: "core", label: "Core Features" },
  { group: "extras", label: "Extras" },
  { group: "other", label: "Other" },
];

/** Display name, section, explanatory blurb and an optional availability note
 * for each feature toggle. */
export const featureMeta: Record<
  Overlay,
  { name: string; group: FeatureGroup; description: string; note?: string }
> = {
  score: {
    name: "Score 0.1% + extrapolation",
    group: "core",
    description:
      "The 0.1% (title) cutoff line and its dashed forward projection with the confidence band.",
  },
  score100: {
    name: "Score 1% + extrapolation",
    group: "core",
    description:
      "The top-1% cutoff line and its dashed forward projection with the confidence band.",
    note: "This feature is only available starting with Midnight Season 1.",
  },
  patches: {
    name: "Patch Dates",
    group: "extras",
    description: "Vertical markers at major game patches.",
  },
  dungeonHotfixes: {
    name: "Dungeon Hotfixes",
    group: "extras",
    description: "Vertical markers when a dungeon was tuned/hotfixed.",
  },
  levelCompletion: {
    name: "Level Completion",
    group: "extras",
    description:
      "Horizontal markers for the score a full clear at a given key level is worth.",
  },
  affixes: {
    name: "Affixes",
    group: "extras",
    description:
      "Per-week affix markers (older seasons only — modern seasons show them in the header).",
  },
  mythicStats: {
    name: "MythicStats link",
    group: "extras",
    description:
      "Per-week MythicStats icons linking to that week's leaderboard.",
  },
  extrapolation: {
    name: "Extrapolation History",
    group: "extras",
    description:
      "Scatter of past extrapolations, showing how the projection moved over time.",
    note: "This feature is only available starting with Midnight Season 1.",
  },
  records: {
    name: "Dungeon Records",
    group: "other",
    description:
      "The separate chart tracking the highest key level timed per dungeon.",
    note: "This feature is only available starting with The War Within Season 3.",
  },
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
 * Persists the current region selection to a client cookie so the bare landing
 * path ("/") can redirect back to it. Stores the canonical path segment; an
 * "all regions" selection clears the cookie (the bare path already means "all").
 *
 * Deliberately written client-side instead of via a `Set-Cookie` on the season
 * loader: that response is CDN-cached, and a `Set-Cookie` would defeat caching.
 * Scoped to `Path=/` so it is sent on the root request (the default path would
 * otherwise be the current `/{season}` directory and never reach "/").
 */
export function persistRegionsCookie(regions: readonly Regions[]): void {
  if (typeof document === "undefined") {
    return;
  }

  const segment = regionsToPathSegment(regions);
  const oneYearInSeconds = 365 * 24 * 60 * 60;

  document.cookie = segment
    ? `regions=${segment}; Max-Age=${oneYearInSeconds}; Path=/; SameSite=Lax`
    : `regions=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * Client-safe mirror of `determineOverlaysToDisplayFromSearchParams` — reads the
 * `overlays` query param without pulling in the server-only `load.server` module.
 */
export function parseOverlaysFromSearchParams(
  params: URLSearchParams,
): Overlay[] | null {
  const maybeOverlays = params.get("overlays");

  // An *absent* param means "default" (⇒ `defaultOverlays`). A *present but
  // empty* param (`?overlays=`) is an explicit empty selection (⇒ none) and must
  // not collapse back to the default, otherwise deselecting the last overlay
  // silently re-enables every overlay (incl. the Dungeon Records chart).
  if (maybeOverlays === null) {
    return null;
  }

  const fromSearchParams = new Set(maybeOverlays.split(searchParamSeparator));

  return overlays.filter((overlay) => fromSearchParams.has(overlay));
}

/**
 * Resolves the overlays a chart should display: the parsed selection (or
 * `defaultOverlays` by default), minus `affixes` for modern seasons
 * (`zoneId > 39`). Mirrors the default filtering previously done in
 * `getEnhancedSeason`.
 */
export function resolveOverlaysToDisplay(
  zoneId: number | undefined,
  parsed: Overlay[] | null,
): Overlay[] {
  return (parsed ?? [...defaultOverlays]).filter((overlay) => {
    if ((zoneId ?? 0) > 39) {
      return overlay !== "affixes";
    }

    return true;
  });
}
