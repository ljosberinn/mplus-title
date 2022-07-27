import type { History, Factions, Regions } from "@prisma/client";

import {
  affixRotations,
  confirmedCutoffs,
  seasonEndings,
  seasonStartDates,
  bluePostForSeasonEnding,
} from "./meta";
import { prisma } from "./prisma";
import { isValidRegion } from "./utils";

export type Data = {
  history: LegacyDataset[];
  confirmedCutoff: Record<Regions, Record<Factions, number>>;
  seasonEnding: null | Record<Regions, number>;
  affixRotation: [number, number, number][] | null;
  seasonStart: Record<Regions, number>;
  crossFactionData: CrossFactionDataset[];
  bluePosts: Record<Regions, string>;
};

type Loader = (params?: { region?: string; faction?: string }) => Promise<Data>;

export type LegacyDataset = Omit<
  History,
  "id" | "rioRank" | "rioScore" | "customRank" | "customScore"
> & {
  score: number;
};

export type CrossFactionDataset = {
  timestamp: number;
  region: Regions;
  score: number;
};

export const loaderMap = Object.entries(seasonStartDates).reduce<
  Record<string, Loader>
>((acc, [seasonName, regionalStart], index, arr) => {
  const nextSeason = index === 0 ? null : arr[index - 1];

  const fn: Loader = async (params) => {
    const region =
      params?.region && isValidRegion(params.region)
        ? params.region
        : undefined;

    const gte = Math.round(
      (region ? regionalStart[region] : regionalStart.us) / 1000
    );
    const lte = nextSeason
      ? Math.round((region ? nextSeason[1][region] : nextSeason[1].us) / 1000)
      : undefined;

    const [rawHistory, rawCrossFactionData] = await Promise.all([
      prisma.history.findMany({
        where: {
          region,
          timestamp: {
            gte,
            lte,
          },
        },
        select: {
          timestamp: true,
          faction: true,
          region: true,
          customScore: true,
        },
        orderBy: {
          timestamp: "desc",
        },
      }),
      prisma.crossFactionHistory.findMany({
        where: {
          region,
          timestamp: {
            gte,
            lte,
          },
        },
        select: {
          timestamp: true,
          region: true,
          score: true,
        },
        orderBy: {
          timestamp: "desc",
        },
      }),
    ]);

    const history = rawHistory
      .map(({ customScore, ...dataset }) => {
        return {
          ...dataset,
          timestamp: Number(dataset.timestamp) * 1000,
          // rank: customRank,
          score: customScore,
        };
      })
      .filter((dataset) => {
        // ensures in a region multiview, only data post season start of this region is forwarded
        return (
          dataset.score > 0 &&
          (region
            ? dataset.timestamp >= seasonStartDates[seasonName][dataset.region]
            : true)
        );
      })
      .reverse();

    const crossFactionData = rawCrossFactionData
      .map((dataset) => ({
        ...dataset,
        timestamp: Number(dataset.timestamp) * 1000,
      }))
      // eslint-disable-next-line sonarjs/no-identical-functions
      .filter((dataset) => {
        // ensures in a region multiview, only data post season start of this region is forwarded
        return (
          dataset.score > 0 &&
          (region
            ? dataset.timestamp >= seasonStartDates[seasonName][dataset.region]
            : true)
        );
      })
      .reverse();

    return {
      history,
      confirmedCutoff: confirmedCutoffs[seasonName],
      seasonEnding:
        seasonName in seasonEndings ? seasonEndings[seasonName] : null,
      affixRotation: affixRotations[seasonName] ?? null,
      seasonStart: seasonStartDates[seasonName],
      crossFactionData,
      bluePosts: bluePostForSeasonEnding[seasonName],
    };
  };

  acc[seasonName] = fn;

  return acc;
}, {});
