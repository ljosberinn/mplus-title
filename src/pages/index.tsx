import { GetStaticProps } from "next";
import { load } from "cheerio";
import { Fragment } from "react";

type Region = "eu" | "us" | "tw" | "kr";
type Faction = "alliance" | "horde";
type FactionData = Record<Faction, Cutoff>;
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

export default function Index({ data, meta }: IndexProps) {
  return (
    <>
      <h1 className="text-semibold text-2xl text-center pt-8 pb-4">
        Mythic+ Estimated Title Cutoff
      </h1>
      <table className="w-full">
        <caption className="pb-4">
          if any rank/score is 0, an error occured during loading. wait for the
          next update.
          <br />
          all numbers are estimations based on raider.io.
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
                <tr className="hover:bg-gray-600 text-red-500">
                  <td className="text-center">{region}</td>
                  <td className="text-center">alliance</td>
                  <td className="text-center">{factionData.alliance.rank}</td>
                  <td className="text-center">{factionData.alliance.score}</td>
                </tr>
                <tr className="hover:bg-gray-600 text-blue-500">
                  <td className="text-center">{region}</td>
                  <td className="text-center">horde</td>
                  <td className="text-center">{factionData.horde.rank}</td>
                  <td className="text-center">{factionData.horde.score}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>

        <tfoot>
          <tr>
            <td colSpan={4} className="text-center pt-4">
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
              >
                repo
              </a>{" "}
              |{" "}
              <a
                href="https://twitter.com/gerrit_alex"
                rel="noopener noreferrer"
                className="underline"
              >
                twitter
              </a>{" "}
              |{" "}
              <a
                href="https://raider.io/characters/eu/blackmoore/Xepheris"
                rel="noopener noreferrer"
                className="underline"
              >
                rio
              </a>
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

export const config = {
  unstable_runtimeJS: false,
};

export const getStaticProps: GetStaticProps<IndexProps> = async (ctx) => {
  const regions: Region[] = ["us", "eu", "kr", "tw"];
  const factions: Faction[] = ["alliance", "horde"];

  const now = Date.now();
  const revalidate = 12 * 60 * 60;

  const props: IndexProps = {
    meta: {
      generatedAt: Date.now(),
      nextUpdateAt: now + revalidate * 1000,
    },
    data: {
      eu: {
        alliance: {
          rank: 0,
          score: 0,
        },
        horde: {
          rank: 0,
          score: 0,
        },
      },
      kr: {
        alliance: {
          rank: 0,
          score: 0,
        },
        horde: {
          rank: 0,
          score: 0,
        },
      },
      tw: {
        alliance: {
          rank: 0,
          score: 0,
        },
        horde: {
          rank: 0,
          score: 0,
        },
      },
      us: {
        alliance: {
          rank: 0,
          score: 0,
        },
        horde: {
          rank: 0,
          score: 0,
        },
      },
    },
  };

  const rioBaseUrl = "https://raider.io";

  const createPageUrl = (region: Region, faction: Faction, page = 0) => {
    return `${rioBaseUrl}/mythic-plus-character-faction-rankings/season-sl-2/${region}/all/all/${faction}/${page}`;
  };

  for (const region of regions) {
    for (const faction of factions) {
      const key = `${region}-${faction}`;

      console.time(key);

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

        props.data[region][faction].rank = lastEligibleRank;

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

        props.data[region][faction].score = score;
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
