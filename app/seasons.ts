import type { Factions, Regions } from "@prisma/client";

import { Affix } from "./affixes";
import { prisma } from "./prisma";

type CutoffSource = { score: number; source: string | null };

const UNKNOWN_SEASON_ENDING = null;

export type Season = {
  name: string;
  slug: string;
  startDates: Record<Regions, number>;
  endDates: Record<Regions, number | null>;
  confirmedCutoffs: Record<
    Regions,
    CutoffSource | ({ source: string | null } & Record<Factions, number>)
  >;
  affixes: [Affix, Affix, Affix, Affix][];
  rioKey: string;
  crossFactionSupport: "complete" | "none" | "partial";
};

export const seasons: Season[] = [
  {
    name: "DF S1",
    slug: "df-season-1",
    rioKey: "season-df-1",
    crossFactionSupport: "complete",
    startDates: {
      us: 1_670_943_600_000,
      eu: 1_670_990_400_000,
      kr: 1_671_058_800_000,
      tw: 1_671_058_800_000,
    },
    endDates: {
      us: UNKNOWN_SEASON_ENDING,
      eu: UNKNOWN_SEASON_ENDING,
      kr: UNKNOWN_SEASON_ENDING,
      tw: UNKNOWN_SEASON_ENDING,
    },
    confirmedCutoffs: {
      eu: { score: 0, source: null },
      us: { score: 0, source: null },
      kr: { score: 0, source: null },
      tw: { score: 0, source: null },
    },
    affixes: [
      [Affix.Tyrannical, Affix.Tyrannical, Affix.Tyrannical, Affix.Thundering],
    ],
  },
  {
    name: "SL S4",
    slug: "sl-season-4",
    rioKey: "season-sl-4",
    crossFactionSupport: "complete",
    startDates: {
      us: 1_659_452_400_000,
      eu: 1_659_510_000_000,
      kr: 1_659_564_000_000,
      tw: 1_659_564_000_000,
    },
    endDates: {
      us: 1_666_710_000_000,
      eu: 1_666_767_600_000,
      kr: 1_666_821_600_000,
      tw: 1_666_821_600_000,
    },
    confirmedCutoffs: {
      eu: { 
        score: 3120, 
        source: 
          "https://eu.forums.blizzard.com/en/wow/t/m-shrouded-hero-title-november-16-update/395176/19"
      },
      us: { score: 0, source: null },
      kr: { score: 0, source: null },
      tw: { score: 0, source: null },
    },
    affixes: [
      [Affix.Tyrannical, Affix.Inspiring, Affix.Quaking, Affix.Shrouded],
      [Affix.Fortified, Affix.Sanguine, Affix.Grievous, Affix.Shrouded],
      [Affix.Tyrannical, Affix.Bolstering, Affix.Explosive, Affix.Shrouded],
      [Affix.Fortified, Affix.Bursting, Affix.Storming, Affix.Shrouded],
      [Affix.Tyrannical, Affix.Raging, Affix.Volcanic, Affix.Shrouded],
      [Affix.Fortified, Affix.Inspiring, Affix.Grievous, Affix.Shrouded],
      [Affix.Tyrannical, Affix.Spiteful, Affix.Necrotic, Affix.Shrouded],
      [Affix.Fortified, Affix.Bolstering, Affix.Quaking, Affix.Shrouded],
      [Affix.Tyrannical, Affix.Sanguine, Affix.Storming, Affix.Shrouded],
      [Affix.Fortified, Affix.Raging, Affix.Explosive, Affix.Shrouded],
      [Affix.Tyrannical, Affix.Bursting, Affix.Volcanic, Affix.Shrouded],
      [Affix.Fortified, Affix.Spiteful, Affix.Necrotic, Affix.Shrouded],
    ],
  },
  {
    name: "SL S3",
    slug: "sl-season-3",
    rioKey: "season-sl-3",
    crossFactionSupport: "partial",
    startDates: {
      us: 1_646_146_800_000,
      eu: 1_646_204_400_000,
      kr: 1_646_258_400_000,
      tw: 1_646_258_400_000,
    },
    endDates: {
      us: 1_659_452_400_000,
      eu: 1_659_510_000_000,
      kr: 1_659_564_000_000,
      tw: 1_659_564_000_000,
    },
    confirmedCutoffs: {
      eu: {
        score: 3725,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-cryptic-hero-title-score-updated-daily/371434",
      },
      us: { score: 0, source: null },
      kr: { score: 0, source: null },
      tw: { score: 0, source: null },
    },
    affixes: [
      [Affix.Tyrannical, Affix.Bolstering, Affix.Explosive, Affix.Encrypted],
      [Affix.Fortified, Affix.Bursting, Affix.Storming, Affix.Encrypted],
      [Affix.Tyrannical, Affix.Raging, Affix.Volcanic, Affix.Encrypted],
      [Affix.Fortified, Affix.Inspiring, Affix.Grievous, Affix.Encrypted],
      [Affix.Tyrannical, Affix.Spiteful, Affix.Necrotic, Affix.Encrypted],
      [Affix.Fortified, Affix.Bolstering, Affix.Quaking, Affix.Encrypted],
      [Affix.Tyrannical, Affix.Sanguine, Affix.Storming, Affix.Encrypted],
      [Affix.Fortified, Affix.Raging, Affix.Explosive, Affix.Encrypted],
      [Affix.Tyrannical, Affix.Bursting, Affix.Volcanic, Affix.Encrypted],
      [Affix.Fortified, Affix.Spiteful, Affix.Necrotic, Affix.Encrypted],
      [Affix.Tyrannical, Affix.Inspiring, Affix.Quaking, Affix.Encrypted],
      [Affix.Fortified, Affix.Sanguine, Affix.Grievous, Affix.Encrypted],
    ],
  },
  {
    name: "SL S2",
    slug: "sl-season-2",
    rioKey: "season-sl-2",
    crossFactionSupport: "none",
    startDates: {
      us: 1_625_583_600_000,
      eu: 1_625_641_200_000,
      kr: 1_625_695_200_000,
      tw: 1_625_695_200_000,
    },
    endDates: {
      us: 1_645_542_000_000,
      eu: 1_645_599_600_000,
      kr: 1_645_653_600_000,
      tw: 1_645_653_600_000,
    },
    confirmedCutoffs: {
      eu: {
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-tormented-hero-title-score-updated-daily/341108",
        alliance: 2788,
        horde: 2875,
      },
      us: {
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-tormented-hero-title-score-updated-daily/1184111",
        alliance: 2768,
        horde: 2847,
      },
      kr: {
        source: null,
        alliance: 0,
        horde: 0,
      },
      tw: {
        source: null,
        alliance: 0,
        horde: 0,
      },
    },
    affixes: [
      [Affix.Tyrannical, Affix.Bursting, Affix.Volcanic, Affix.Tormented],
      [Affix.Fortified, Affix.Inspiring, Affix.Grievous, Affix.Tormented],
      [Affix.Tyrannical, Affix.Spiteful, Affix.Necrotic, Affix.Tormented],
      [Affix.Fortified, Affix.Bolstering, Affix.Quaking, Affix.Tormented],
      [Affix.Tyrannical, Affix.Sanguine, Affix.Storming, Affix.Tormented],
      [Affix.Fortified, Affix.Raging, Affix.Explosive, Affix.Tormented],
      [Affix.Tyrannical, Affix.Bursting, Affix.Volcanic, Affix.Tormented],
      [Affix.Fortified, Affix.Necrotic, Affix.Grievous, Affix.Tormented],
      [Affix.Tyrannical, Affix.Inspiring, Affix.Quaking, Affix.Tormented],
      [Affix.Fortified, Affix.Sanguine, Affix.Necrotic, Affix.Tormented],
      [Affix.Tyrannical, Affix.Bolstering, Affix.Explosive, Affix.Tormented],
      [Affix.Fortified, Affix.Bursting, Affix.Storming, Affix.Tormented],
    ],
  },
];

export const hasSeasonEndedForAllRegions = (slug: string): boolean => {
  const season = seasons.find((season) => season.slug === slug);

  if (!season) {
    return true;
  }

  const endDates = Object.values(season.endDates);

  if (endDates.includes(UNKNOWN_SEASON_ENDING)) {
    return false;
  }

  const now = Date.now();

  return endDates.every((date) => now >= (date ?? 0));
};

export const findSeasonByTimestamp = (
  timestamp = Date.now()
): Season | null => {
  const season = seasons.find(
    (season) =>
      Object.values(season.startDates).some((start) => timestamp >= start) &&
      Object.values(season.endDates).some(
        (end) => end === UNKNOWN_SEASON_ENDING || end > timestamp
      )
  );

  return season ?? null;
};

export const findSeasonByName = (slug: string): Season | null => {
  if (slug === "latest") {
    const ongoingSeason = findSeasonByTimestamp();

    if (!ongoingSeason) {
      const mostRecentlyStartedSeason = seasons.find(
        (season) => Date.now() >= season.startDates.us
      );

      if (mostRecentlyStartedSeason) {
        return mostRecentlyStartedSeason;
      }
    }
  }

  const match = seasons.find((season) => {
    return season.slug === slug;
  });

  return match ?? null;
};

const getCrossFactionHistory = (region: Regions, gte: number, lte?: number) => {
  return prisma.crossFactionHistory.findMany({
    where: {
      region,
      timestamp: {
        gte: Math.ceil(gte / 1000),
        lte: lte ? Math.ceil(lte / 1000) : lte,
      },
    },
    select: {
      timestamp: true,
      score: true,
    },
    orderBy: {
      timestamp: "desc",
    },
  });
};

const getHistory = (region: Regions, gte: number, lte?: number) => {
  return prisma.history.findMany({
    where: {
      region,
      timestamp: {
        gte: Math.ceil(gte / 1000),
        lte: lte ? Math.ceil(lte / 1000) : lte,
      },
    },
    select: {
      timestamp: true,
      faction: true,
      customScore: true,
    },
    orderBy: {
      timestamp: "desc",
    },
  });
};

export type Dataset = {
  ts: number;
  score: number;
  faction?: Factions;
};

export const loadDataForRegion = async (
  region: Regions,
  season: Season
): Promise<Dataset[]> => {
  const gte = season.startDates[region];
  const lte = season.endDates[region] ?? undefined;

  const [rawHistory, rawCrossFactionHistory] = await Promise.all([
    season.crossFactionSupport === "complete"
      ? []
      : getHistory(region, gte, lte),
    season.crossFactionSupport === "none"
      ? []
      : getCrossFactionHistory(region, gte, lte),
  ]);

  return [...rawHistory, ...rawCrossFactionHistory]
    .map((dataset) => {
      const next: Dataset = {
        ts: Number(dataset.timestamp) * 1000,
        score: "customScore" in dataset ? dataset.customScore : dataset.score,
      };

      if ("faction" in dataset) {
        next.faction = dataset.faction;
      }

      return next;
    })
    .filter((dataset) => {
      return dataset.score > 0;
    })
    .sort((a, b) => a.ts - b.ts);
};
