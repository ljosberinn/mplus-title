import type { GetStaticProps } from "next";

import type { IndexProps } from "../pages";
import { dataTemplate } from "../pages/api/cron";
import { prisma } from "../prisma";

export const revalidate = 1 * 60 * 60;

export const getStaticProps: GetStaticProps<IndexProps> = async () => {
  const now = Date.now();
  const history = await loadHistory(now);

  const latestTimestamp = history.reduce(
    (acc, dataset) => (dataset.timestamp > acc ? dataset.timestamp : acc),
    0
  );

  const latestData = history.filter(
    (dataset) => dataset.timestamp === latestTimestamp
  );

  const data = latestData.reduce((acc, dataset) => {
    acc[dataset.region][dataset.faction] = {
      custom: {
        rank: dataset.customRank,
        score: dataset.customScore,
      },
      rio: {
        rank: dataset.rioRank,
        score: dataset.rioScore,
      },
    };

    return acc;
  }, dataTemplate);

  return {
    props: {
      // history,
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
        // go back a month
        gte: now - 28 * 24 * 60 * 60 * 1000,
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
