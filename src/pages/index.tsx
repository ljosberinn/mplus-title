/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
import { load } from "cheerio";
import type { GetStaticProps, PageConfig } from "next";
import { Fragment } from "react";

type Region = "eu" | "us" | "tw" | "kr";
type Faction = "alliance" | "horde";
type FactionData = Record<
  Faction,
  {
    rio: Cutoff;
    custom: Cutoff;
  }
>;
type Cutoff = {
  rank: number;
  score: number;
};

type IndexProps = {
  data: Record<Region, FactionData>;
  meta: {
    generatedAt: number;
    nextUpdateAt: number;
  };
};

export default function Index({ data, meta }: IndexProps): JSX.Element {
  return (
    <main className="max-w-2xl m-auto">
      <h1 className="pt-8 pb-4 text-2xl text-center text-semibold">
        Mythic+ Estimated Title Cutoff
      </h1>
      <table className="w-full">
        <caption className="pb-4">
          if any rank/score is 0, an error occured during loading. wait for the
          next update.
          <br />
          numbers in brackets are based on the raider.io api. these seem to lag
          behind my manual calculation, but I've included them for transparency
          reasons.
        </caption>

        <thead>
          <tr>
            <th>Region</th>
            <th>Faction</th>
            <th>Rank</th>
            <th>Score</th>
          </tr>
        </thead>

        <tbody>
          {Object.entries(data).map(([region, factionData]) => {
            return (
              <Fragment key={region}>
                <tr className="text-blue-500 hover:bg-gray-600">
                  <td className="text-center">{region}</td>
                  <td className="text-center">alliance</td>
                  <td className="text-center">
                    {factionData.alliance.custom.rank} (
                    {factionData.alliance.rio.rank})
                  </td>
                  <td className="text-center">
                    {factionData.alliance.custom.score} (
                    {factionData.alliance.rio.score})
                  </td>
                </tr>
                <tr className="text-red-500 hover:bg-gray-600">
                  <td className="text-center">{region}</td>
                  <td className="text-center">horde</td>
                  <td className="text-center">
                    {factionData.horde.custom.rank} (
                    {factionData.horde.rio.rank})
                  </td>
                  <td className="text-center">
                    {factionData.horde.custom.score} (
                    {factionData.horde.rio.score})
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>

        <tfoot>
          <tr>
            <td colSpan={4} className="pt-4 text-center">
              last generated at{" "}
              {new Date(meta.generatedAt).toLocaleString("en-US")} <br /> next
              update around{" "}
              {new Date(meta.nextUpdateAt).toLocaleString("en-US")}
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="text-center">
              <a
                href="https://github.com/ljosberinn/mplus-title"
                rel="noopener noreferrer"
                className="underline"
                target="_blank"
              >
                repo
              </a>{" "}
              |{" "}
              <a
                href="https://twitter.com/gerrit_alex"
                rel="noopener noreferrer"
                className="underline"
                target="_blank"
              >
                twitter
              </a>{" "}
              |{" "}
              <a
                href="https://raider.io/characters/eu/blackmoore/Xepheris"
                rel="noopener noreferrer"
                className="underline"
                target="_blank"
              >
                rio
              </a>
            </td>
          </tr>
        </tfoot>
      </table>
    </main>
  );
}

export const config: PageConfig = {
  unstable_runtimeJS: false,
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

  const regions: Region[] = ["us", "eu", "kr", "tw"];
  const factions: Faction[] = ["alliance", "horde"];

  const now = Date.now();
  const revalidate = 1 * 60 * 60;

  const props: IndexProps = {
    meta: {
      generatedAt: Date.now(),
      nextUpdateAt: now + revalidate * 1000,
    },
    data: {
      eu: {
        alliance: {
          rio: {
            rank: 0,
            score: 0,
          },
          custom: {
            rank: 0,
            score: 0,
          },
        },
        horde: {
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
      kr: {
        alliance: {
          rio: {
            rank: 0,
            score: 0,
          },
          custom: {
            rank: 0,
            score: 0,
          },
        },
        horde: {
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
      tw: {
        alliance: {
          rio: {
            rank: 0,
            score: 0,
          },
          custom: {
            rank: 0,
            score: 0,
          },
        },
        horde: {
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
      us: {
        alliance: {
          rio: {
            rank: 0,
            score: 0,
          },
          custom: {
            rank: 0,
            score: 0,
          },
        },
        horde: {
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
  };

  const rioBaseUrl = "https://raider.io";

  const createPageUrl = (region: Region, faction: Faction, page = 0) => {
    return `${rioBaseUrl}/mythic-plus-character-faction-rankings/season-sl-2/${region}/all/all/${faction}/${page}`;
  };

  const createEndpointUrl = (region: Region) => {
    return `https://raider.io/api/v1/mythic-plus/season-cutoffs?season=season-sl-2&region=${region}`;
  };

  for (const region of regions) {
    for (const faction of factions) {
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
          continue;
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

        props.data[region][faction].custom.score = score;
      } catch (error) {
        console.error(error);
      }

      console.timeEnd(key);
    }
  }

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
