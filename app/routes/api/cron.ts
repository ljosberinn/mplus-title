/* eslint-disable no-console */
import type { Prisma, Regions } from "@prisma/client";
import { Factions } from "@prisma/client";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { load } from "cheerio";
import { seasonStartDates } from "src/meta";
import { prisma } from "src/prisma";

const rioBaseUrl = "https://raider.io";

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

const determineSeason = (region: Regions) => {
  const firstMatch = Object.entries(seasonStartDates).find(
    ([, regionStartMap]) => {
      return Date.now() >= regionStartMap[region];
    }
  );

  if (!firstMatch) {
    throw new Error("could not determine current season");
  }

  return firstMatch[0].replace("-season", "");
};

const createPageUrl = (region: Regions, faction: Factions, page = 0) => {
  const season = determineSeason(region);
  return `${rioBaseUrl}/mythic-plus-character-faction-rankings/season-${season}/${region}/all/all/${faction}/${page}`;
};

const createEndpointUrl = (region: Regions) => {
  const season = determineSeason(region);
  return `${rioBaseUrl}/api/v1/mythic-plus/season-cutoffs?season=season-${season}&region=${region}`;
};

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

export const loader: LoaderFunction = async ({ request }) => {
  if (request.method !== "GET") {
    return json([], 404);
  }

  if (process.env.NODE_ENV === "production") {
    const secret = process.env.SECRET;

    if (!secret) {
      return json({ error: "secret missing" }, 500);
    }

    const maybeSecret = new URL(request.url).searchParams.get("secret");

    if (!maybeSecret || secret !== maybeSecret) {
      return json({ error: "secret missing" }, 403);
    }
  }

  console.time("getMostOutdatedRegion");
  const mostOutdatedRegion = await getMostOutdatedRegion();
  console.timeEnd("getMostOutdatedRegion");

  if (!mostOutdatedRegion) {
    return json([], 204);
  }

  console.time("parseRegionData");
  const regionData = await parseRegionData(mostOutdatedRegion);
  console.timeEnd("parseRegionData");

  console.log(regionData);

  if (process.env.NODE_ENV === "production") {
    console.time("persistRegionData");
    await persistRegionData(regionData);
    console.timeEnd("persistRegionData");
  } else {
    console.info("skipping persistence");
  }

  return json({ mostOutdatedRegion });
};

const getMostOutdatedRegion = async () => {
  const threshold = Math.round(Date.now() / 1000 - 1 * 60 * 60);

  const mostRecentData = await prisma.history.findMany({
    where: {
      timestamp: {
        gte: threshold,
      },
    },
    orderBy: {
      timestamp: "desc",
    },
    select: {
      region: true,
      timestamp: true,
    },
  });

  const mostRecentlyUpdatedRegions = new Set(
    mostRecentData.map((dataset) => dataset.region)
  );

  const datasets = await prisma.history.findMany({
    where: {
      timestamp: {
        lte: threshold,
      },
    },
    orderBy: {
      timestamp: "desc",
    },
    select: {
      region: true,
      timestamp: true,
    },
  });

  const mostOutdated = datasets.reduce((acc, dataset) => {
    if (mostRecentlyUpdatedRegions.has(dataset.region)) {
      return acc;
    }

    return acc.timestamp < dataset.timestamp ? acc : dataset;
  }, datasets[0]);

  if (mostRecentlyUpdatedRegions.has(mostOutdated.region)) {
    return null;
  }

  return mostOutdated.region;
};

const persistRegionData = async (data: Prisma.HistoryCreateManyInput[]) => {
  await prisma.history.createMany({ data, skipDuplicates: true });
};

const parseRegionData = async (
  region: Regions
): Promise<Prisma.HistoryCreateManyInput[]> => {
  const now = Math.round(Date.now() / 1000);

  const url = createEndpointUrl(region);
  const response = await fetch(url);
  const json: CutoffApiResponse = await response.json();

  const parsedData = await Promise.all(
    Object.values(Factions).map(async (faction) => {
      try {
        const firstPageUrl = createPageUrl(region, faction);
        const firstPageResponse = await fetch(firstPageUrl);
        const firstPageText = await firstPageResponse.text();

        const $firstPage = load(firstPageText);
        const lastPageUrl = $firstPage(".rio-pagination--button")
          .last()
          .attr("href");

        if (!lastPageUrl) {
          return {
            faction,
            score: 0,
            rank: 0,
          };
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

        const scorePage =
          lastEligibleRank <= 20 ? 0 : Math.floor(lastEligibleRank / 20);
        const scorePageUrl = createPageUrl(
          region,
          faction,
          // if rank is divisible by 20, e.g. 80, it would result in page 4
          // but its still on page 3
          lastEligibleRank % 20 === 0 && lastEligibleRank > 20
            ? scorePage - 1
            : scorePage
        );

        const scorePageResponse = await fetch(scorePageUrl);
        const scorePageText = await scorePageResponse.text();

        const $scorePage = load(scorePageText);

        const maybeScore = Number.parseFloat(
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

        const score = Number.isNaN(maybeScore) ? 0 : maybeScore;

        return {
          faction,
          score,
          rank: lastEligibleRank,
        };
      } catch (error) {
        console.error(error);

        return {
          faction,
          score: 0,
          rank: 0,
        };
      }
    })
  );

  const parsedHordeData = parsedData.find(
    (dataset) => dataset.faction === "horde"
  );
  const parsedAllianceData = parsedData.find(
    (dataset) => dataset.faction === "alliance"
  );

  if (!parsedHordeData || !parsedAllianceData) {
    return [];
  }

  return [
    {
      region,
      faction: "horde",
      customRank: parsedHordeData.rank,
      customScore: parsedHordeData.score,
      rioRank: json.cutoffs?.p999?.horde?.quantilePopulationCount ?? 0,
      rioScore: json.cutoffs?.p999?.horde?.quantileMinValue ?? 0,
      timestamp: now,
    },
    {
      region,
      faction: "alliance",
      customRank: parsedAllianceData.rank,
      customScore: parsedAllianceData.score,
      rioRank: json.cutoffs?.p999?.alliance?.quantilePopulationCount ?? 0,
      rioScore: json.cutoffs?.p999?.alliance?.quantileMinValue ?? 0,
      timestamp: now,
    },
  ];
};
