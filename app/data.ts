import type { History, Factions, Regions } from "@prisma/client";

import {
  affixRotations,
  confirmedCutoffs,
  seasonEndings,
  seasonStartDates,
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

const aggregateFactionDataByDay = (data: LegacyDataset[]) => {
  const map: Record<string, Record<string, number>> = {};

  return data.reduce<LegacyDataset[]>((acc, dataset) => {
    const outerKey = `${dataset.region}-${dataset.faction}`;
    const innerKey = new Date(dataset.timestamp).toDateString();

    // havent seen region-faction yet
    if (!(outerKey in map)) {
      map[outerKey] = {
        // remember day
        [innerKey]: dataset.timestamp,
      };

      acc.push(dataset);
      return acc;
    }

    // havent seen this day yet
    if (!(innerKey in map[outerKey])) {
      // remember day
      map[outerKey][innerKey] = dataset.timestamp;
      acc.push(dataset);
      return acc;
    }

    const prev = map[outerKey][innerKey];

    // dataset is same region, faction, day but from a later point in time
    if (dataset.timestamp >= prev) {
      map[outerKey][innerKey] = dataset.timestamp;
      return [
        ...acc.filter((d) => new Date(d.timestamp).toDateString() !== innerKey),
        dataset,
      ];
    }

    return acc;
  }, []);
};

const aggregateCrossFactionDataByDa = (data: CrossFactionDataset[]) => {
  const map: Record<string, Record<string, number>> = {};

  return data.reduce<CrossFactionDataset[]>((acc, dataset) => {
    const outerKey = `${dataset.region}`;
    const innerKey = new Date(dataset.timestamp).toDateString();

    // havent seen region-faction yet
    if (!(outerKey in map)) {
      map[outerKey] = {
        // remember day
        [innerKey]: dataset.timestamp,
      };

      acc.push(dataset);
      return acc;
    }

    // havent seen this day yet
    if (!(innerKey in map[outerKey])) {
      // remember day
      map[outerKey][innerKey] = dataset.timestamp;
      acc.push(dataset);
      return acc;
    }

    const prev = map[outerKey][innerKey];

    // dataset is same region, faction, day but from a later point in time
    if (dataset.timestamp >= prev) {
      map[outerKey][innerKey] = dataset.timestamp;
      return [
        ...acc.filter((d) => new Date(d.timestamp).toDateString() !== innerKey),
        dataset,
      ];
    }

    return acc;
  }, []);
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

    const history = aggregateFactionDataByDay(
      rawHistory
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
              ? dataset.timestamp >=
                seasonStartDates[seasonName][dataset.region]
              : true)
          );
        })
    ).reverse();

    const crossFactionData = aggregateCrossFactionDataByDa(
      rawCrossFactionData.map((dataset) => ({
        ...dataset,
        timestamp: Number(dataset.timestamp) * 1000,
      }))
    )
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
    };
  };

  acc[seasonName] = fn;

  return acc;
}, {});
