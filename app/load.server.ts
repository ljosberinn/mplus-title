import { type Factions, type Regions } from "@prisma/client";

import { prisma } from "./prisma.server";
import { type Season } from "./seasons";

const getCrossFactionHistory = (
  region: Regions,
  gte: number | null,
  lte?: number
) => {
  if (!gte) {
    return [];
  }

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

const getHistory = (region: Regions, gte: number | null, lte?: number) => {
  if (!gte) {
    return [];
  }

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
