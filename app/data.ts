import type { Prisma, History, Factions, Regions } from "@prisma/client";

import {
  affixRotations,
  confirmedCutoffs,
  seasonEndings,
  seasonStartDates,
} from "./meta";
import { prisma } from "./prisma";
import { isValidRegion } from "./utils";

export type Data = {
  history: Dataset[];
  confirmedCutoff: Record<Regions, Record<Factions, number>>;
  seasonEnding: null | Record<Regions, number>;
  affixRotation: [number, number, number][] | null;
  seasonStart: Record<Regions, number>;
};

type Loader = (params?: { region?: string; faction?: string }) => Promise<Data>;

export type Dataset = Omit<History, "id" | "rioRank" | "rioScore">;

const aggregateDataByDay = (data: Dataset[]) => {
  const map: Record<string, Record<string, number>> = {};

  return data.reduce<Dataset[]>((acc, dataset) => {
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

    const where: Prisma.HistoryWhereInput = {
      region,
      timestamp: {
        gte,
        lte,
      },
    };

    const datasets = await prisma.history.findMany({
      where,
      select: {
        timestamp: true,
        faction: true,
        region: true,
        customRank: true,
        customScore: true,
        // rioRank: true,
        // rioScore: true,
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    const data = aggregateDataByDay(
      datasets.map((dataset) => {
        return { ...dataset, timestamp: Number(dataset.timestamp) * 1000 };
      })
    ).reverse();

    return {
      history: region
        ? data
        : // ensures in a region multiview, only data post season start of this region is forwarded
          data.filter((dataset) => {
            return (
              dataset.timestamp >= seasonStartDates[seasonName][dataset.region]
            );
          }),
      confirmedCutoff: confirmedCutoffs[seasonName],
      seasonEnding:
        seasonName in seasonEndings ? seasonEndings[seasonName] : null,
      affixRotation: affixRotations[seasonName] ?? null,
      seasonStart: seasonStartDates[seasonName],
    };
  };

  acc[seasonName] = fn;

  return acc;
}, {});
