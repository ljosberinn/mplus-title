import type { Regions } from "@prisma/client";
import type { GetStaticProps } from "next";

import type { IndexProps } from "../pages";
import { dataTemplate } from "../pages/api/cron";
import { prisma } from "../prisma";

export const revalidate = 1 * 60 * 60;

const season2Cutoffs: Record<
  Regions,
  { horde: number | null; alliance: number | null }
> = {
  eu: {
    horde: 2862,
    alliance: 2779,
  },
  us: {
    horde: 2839,
    alliance: 2766,
  },
  kr: {
    alliance: null,
    horde: null,
  },
  tw: {
    alliance: null,
    horde: null,
  },
};

export const getStaticProps: GetStaticProps<IndexProps> = async () => {
  const now = Date.now();
  const history = await loadHistory(now);

  const map: Record<string, number> = {};

  const data = history.reduce<IndexProps["data"]>((acc, dataset) => {
    const key = `${dataset.region}-${dataset.faction}`;

    if (key in map && map[key] >= dataset.timestamp) {
      return acc;
    }

    map[key] = dataset.timestamp;

    const confirmedCutoff =
      dataset.region in season2Cutoffs &&
      dataset.faction in season2Cutoffs[dataset.region]
        ? season2Cutoffs[dataset.region][dataset.faction]
        : null;

    acc[dataset.region][dataset.faction] = {
      custom: {
        rank: dataset.customRank,
        score: dataset.customScore,
      },
      rio: {
        rank: dataset.rioRank,
        score: dataset.rioScore,
      },
      confirmedCutoff,
    };

    return acc;
  }, dataTemplate);

  return {
    props: {
      history,
      data,
      meta: {
        nextUpdateAt: now + revalidate * 1000,
        generatedAt: now,
      },
    },
    revalidate,
  };
};

const loadHistory = async (now: number) => {
  const datasets = await prisma.history.findMany({
    where: {
      timestamp: {
        // go back 2 months
        gte: Math.round(now / 1000 - 1.5 * 28 * 24 * 60 * 60),
      },
    },
    orderBy: {
      timestamp: "desc",
    },
    select: {
      timestamp: true,
      faction: true,
      region: true,
      customRank: true,
      customScore: true,
      rioRank: true,
      rioScore: true,
    },
  });

  return datasets.map((dataset) => ({
    ...dataset,
    timestamp: Number(dataset.timestamp),
  }));
};
