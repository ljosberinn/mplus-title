import { type Factions, type Regions } from "prisma/generated/prisma/enums";

import {
  type ChartSeries,
  type PlotBand,
  type PlotLine,
  type RecordSeries,
} from "~/chart/types";
import { type Overlay } from "~/utils";

// `Affix` is only needed for the `affixes` field's type below. Importing the
// enum as a value would pull `affixes.ts` into the runtime graph, so it is
// type-only.
import { type Affix } from "../affixes";
import { seasons } from "./data";

type CutoffSource = { score: number; source: string | null };

const UNKNOWN_SEASON_START_OR_ENDING = null;

const oneWeekInMilliseconds = 7 * 24 * 60 * 60 * 1000;

/** The set of WoW expansions tracked; also powers season-menu grouping. */
export type Expansion = "mn" | "tww" | "df" | "sl";

export type Dungeon = {
  name: string;
  slug: string;
};

export type Season = {
  name: string;
  slug: string;
  /** Expansion this season belongs to; drives season-menu grouping. */
  expansion: Expansion;
  startDates: Record<Regions, number | null>;
  endDates: Record<Regions, number | null>;
  confirmedCutoffs: Record<
    Regions,
    CutoffSource | ({ source: string | null } & Record<Factions, number>)
  >;
  affixes:
    | [Affix, Affix, Affix, Affix][]
    | [Affix, Affix, Affix][]
    | [Affix, Affix][];
  rioKey: string;
  crossFactionSupport: "complete" | "none" | "partial";
  wcl?: {
    zoneId: number;
    partition?: number;
    weekIndexToAffixSetId: (number | null)[];
  };
  seasonIcon: string;
  dungeonHotfixes: Record<string, Record<Regions, number>>;
  patches: Record<string, Record<Regions, number>>;
  dungeons: number | Dungeon[];
  startingPeriod: number | null;
  supportsExtrapolationHistory: boolean;
};

export type DungeonRecord = {
  slug: string;
  timestamp: number;
  keyLevel: number;
};

export type EnhancedSeason = Season & {
  score: {
    dataByRegion: Record<Regions, Dataset[]>;
    extrapolation: Record<
      Regions,
      | null
      | [number, number][]
      | {
          from: Omit<Dataset, "rank" | "rank100" | "score100">;
          to: Omit<Dataset, "rank" | "rank100" | "score100">;
        }
    >;
    initialZoom: Record<Regions, null | [number, number]>;
    xAxisPlotLines: Record<Regions, PlotLine[]>;
    xAxisPlotBands: Record<Regions, PlotBand[]>;
    yAxisPlotLines: Record<Regions, PlotLine[]>;
    regionsToDisplay: Regions[];
    overlaysToDisplay: Overlay[];
    series: Record<Regions, ChartSeries[]>;
  };
  records: RecordSeries[];
};

export type Dataset = {
  ts: number;
  score: number;
  faction?: Factions;
  rank: number | null;
  score100: number | null;
  rank100: number | null;
};

export function hasSeasonEndedForAllRegions(slug: string): boolean {
  const season = seasons.find((season) => season.slug === slug);

  if (!season) {
    return true;
  }

  const endDates = Object.values(season.endDates);

  if (endDates.includes(UNKNOWN_SEASON_START_OR_ENDING)) {
    return false;
  }

  const now = Date.now();

  return endDates.every((date) => now >= (date ?? 0));
}

export function findSeasonByTimestamp(
  regions: Regions[] | null = null,
  timestamp = Date.now(),
): Season | null {
  const season = seasons.find((season) => {
    if (regions) {
      return regions.some((region) => {
        const startDate = season.startDates[region];
        const endDate = season.endDates[region];

        if (startDate && startDate > timestamp) {
          return false;
        }

        if (endDate === UNKNOWN_SEASON_START_OR_ENDING) {
          return !!startDate;
        }

        return !endDate || endDate > timestamp;
      });
    }

    return (
      Object.values(season.startDates).some(
        (start) => start && timestamp >= start,
      ) &&
      Object.values(season.endDates).some(
        (end) => end === UNKNOWN_SEASON_START_OR_ENDING || end > timestamp,
      )
    );
  });

  return season ?? null;
}

export function findSeasonByName(
  slug: string,
  regions: Regions[] | null,
): Season | null {
  if (slug === "latest") {
    const ongoingSeason = findSeasonByTimestamp(regions);

    if (ongoingSeason) {
      return ongoingSeason;
    }

    const now = Date.now();

    for (const season of seasons) {
      if (season.startDates.US === null) {
        continue;
      }

      if (
        season.startDates.US > now &&
        season.startDates.US <= now + oneWeekInMilliseconds * 2
      ) {
        return season;
      }
    }
  }

  const match = seasons.find((season) => {
    return season.slug === slug;
  });

  return match ?? null;
}
