import type { Prisma } from "@prisma/client";
import { Regions, Factions } from "@prisma/client";
import { load } from "cheerio";
import type { GetStaticProps } from "next";

import type { IndexProps } from "../pages";
import { prisma } from "../prisma";

export type FactionData = Record<
  Factions,
  {
    rio: Cutoff;
    custom: Cutoff;
  }
>;
type Cutoff = {
  rank: number;
  score: number;
};

const regions: Regions[] = ["us", "eu", "kr", "tw"];
const factions: Factions[] = ["alliance", "horde"];

const rioBaseUrl = "https://raider.io";
const revalidate = 1 * 60 * 60;

const createIndexProps = (now: number): IndexProps => {
  return {
    meta: {
      generatedAt: Date.now(),
      nextUpdateAt: now + revalidate * 1000,
    },
    data: {
      [Regions.eu]: {
        [Factions.alliance]: {
          rio: {
            rank: 0,
            score: 0,
          },
          custom: {
            rank: 0,
            score: 0,
          },
        },
        [Factions.horde]: {
          rio: {
            rank: 0,
            score: 0,
          },
          custom: {
            rank: 0,
            score: 0,
          },
        },
      },
      [Regions.kr]: {
        [Factions.alliance]: {
          rio: {
            rank: 0,
            score: 0,
          },
          custom: {
            rank: 0,
            score: 0,
          },
        },
        [Factions.horde]: {
          rio: {
            rank: 0,
            score: 0,
          },
          custom: {
            rank: 0,
            score: 0,
          },
        },
      },
      [Regions.tw]: {
        [Factions.alliance]: {
          rio: {
            rank: 0,
            score: 0,
          },
          custom: {
            rank: 0,
            score: 0,
          },
        },
        [Factions.horde]: {
          rio: {
            rank: 0,
            score: 0,
          },
          custom: {
            rank: 0,
            score: 0,
          },
        },
      },
      [Regions.us]: {
        [Factions.alliance]: {
          rio: {
            rank: 0,
            score: 0,
          },
          custom: {
            rank: 0,
            score: 0,
          },
        },
        [Factions.horde]: {
          rio: {
            rank: 0,
            score: 0,
          },
          custom: {
            rank: 0,
            score: 0,
          },
        },
      },
    },
    history: [],
  };
};

const createPageUrl = (region: Regions, faction: Factions, page = 0) => {
  return `${rioBaseUrl}/mythic-plus-character-faction-rankings/season-sl-2/${region}/all/all/${faction}/${page}`;
};

const createEndpointUrl = (region: Regions) => {
  return `${rioBaseUrl}/api/v1/mythic-plus/season-cutoffs?season=season-sl-2&region=${region}`;
};

export const getStaticProps: GetStaticProps<IndexProps> = async () => {
  if (!String.prototype.replaceAll) {
    // eslint-disable-next-line no-extend-native, func-names
    String.prototype.replaceAll = function (str, newStr) {
      // If a regex pattern
      if (
        Object.prototype.toString.call(str).toLowerCase() === "[object regexp]"
      ) {
        // @ts-expect-error required polyfill
        return this.replace(str, newStr);
      }

      // If a string
      // @ts-expect-error required polyfill
      return this.replace(new RegExp(str, "gu"), newStr);
    };
  }

  const now = Date.now();
  const props = createIndexProps(now);

  await Promise.all(
    regions
      .flatMap((region) => {
        return factions.flatMap((faction) => ({ region, faction }));
      })
      .map(async ({ region, faction }) => {
        const key = `${region}-${faction}`;

        console.time(key);

        const url = createEndpointUrl(region);
        const response = await fetch(url);
        const json: CutoffApiResponse = await response.json();

        props.data[region][faction].rio.rank =
          json.cutoffs.p999[faction].quantilePopulationCount;
        props.data[region][faction].rio.score =
          json.cutoffs.p999[faction].quantileMinValue;

        const firstPageUrl = createPageUrl(region, faction);

        try {
          const firstPageResponse = await fetch(firstPageUrl);
          const firstPageText = await firstPageResponse.text();

          const $firstPage = load(firstPageText);
          const lastPageUrl = $firstPage(".rio-pagination--button")
            .last()
            .attr("href");

          if (!lastPageUrl) {
            return;
          }

          const lastPageResponse = await fetch(`${rioBaseUrl}${lastPageUrl}`);
          const lastPageText = await lastPageResponse.text();

          const $lastPage = load(lastPageText);
          const cellSelector =
            ".mythic-plus-rankings--row:last-of-type .rank-text-normal";

          const totalRankedCharacters = Number.parseInt(
            $lastPage(cellSelector).text().replaceAll(",", "")
          );
          const lastEligibleRank = Math.floor(totalRankedCharacters * 0.001);

          props.data[region][faction].custom.rank = lastEligibleRank;

          const scorePage =
            lastEligibleRank <= 20 ? 0 : Math.floor(lastEligibleRank / 20);
          const scorePageUrl = createPageUrl(region, faction, scorePage);

          const scorePageResponse = await fetch(scorePageUrl);
          const scorePageText = await scorePageResponse.text();

          const $scorePage = load(scorePageText);

          const score = Number.parseFloat(
            $scorePage(".mythic-plus-rankings--row .rank-text-normal")
              .filter((_, element) => {
                return (
                  $scorePage(element).text().replaceAll(",", "") ===
                  `${lastEligibleRank}`
                );
              })
              .parents(".mythic-plus-rankings--row")
              .find("b")
              .text()
          );

          props.data[region][faction].custom.score = Number.isNaN(score)
            ? 0
            : score;
        } catch (error) {
          console.error(error);
        }

        console.timeEnd(key);
      })
  );

  await persistData(props);

  //   const history = await loadHistory(now);

  return {
    props,
    revalidate,
  };
};

type QuantileDataset = {
  quantile: number;
  quantileMinValue: number;
  quantilePopulationCount: number;
  quantilePopulationFraction: number;
  totalPopulationCount: number;
};

type QuantileData = {
  horde: QuantileDataset;
  hordeColor: string;
  allianceColor: string;
  alliance: QuantileDataset;
};

type CutoffApiResponse = {
  cutoffs: {
    region: {
      name: string;
      slug: string;
      short_name: string;
    };
    p999: QuantileData;
    p990: QuantileData;
    p900: QuantileData;
    p750: QuantileData;
    p600: QuantileData;
    keystoneMaster: QuantileData;
    keystoneConqueror: QuantileData;
  };
  uid: {
    season: string;
    region: string;
  };
};

const isFaction = (faction: string): faction is Factions =>
  faction === "horde" || faction === "alliance";
const isRegion = (region: string): region is Regions =>
  region === "eu" || region === "tw" || region === "us" || region === "kr";

const persistData = async ({ data, meta }: IndexProps) => {
  const latestPreviousEntry = await prisma.history.findFirst({
    where: {
      timestamp: {
        lt: meta.generatedAt,
      },
    },
    select: {
      timestamp: true,
    },
  });

  const mayPersist =
    (latestPreviousEntry?.timestamp ?? 0) * 1000 <=
    meta.generatedAt - revalidate * 1000;

  if (mayPersist) {
    const timestamp = Math.round(meta.generatedAt / 1000);
    const upsertableData = Object.entries(data)
      .flatMap(([region, data]) => {
        return Object.entries(data).flatMap(([faction, dataset]) => {
          if (!isFaction(faction) || !isRegion(region)) {
            return null;
          }

          return {
            faction,
            region,
            timestamp,
            rioScore: dataset.rio.score,
            rioRank: dataset.rio.rank,
            customScore: dataset.custom.score,
            customRank: dataset.custom.rank,
          };
        });
      })
      .filter(
        (dataset): dataset is Prisma.HistoryCreateManyInput => dataset !== null
      );

    await prisma.history.createMany({
      data: upsertableData,
      skipDuplicates: true,
    });
  }
};

// const loadHistory = async (now: number) => {
//   const datasets = await prisma.history.findMany({
//     where: {
//       timestamp: {
//         // go back a month
//         gte: now - 28 * 24 * 60 * 60 * 1000,
//       },
//     },
//     select: {
//       timestamp: true,
//       faction: true,
//       region: true,
//       customRank: true,
//       customScore: true,
//       rioRank: true,
//       rioScore: true,
//     },
//   });

//   return datasets.map((dataset) => ({
//     ...dataset,
//     timestamp: Number(dataset.timestamp),
//   }));
// };
