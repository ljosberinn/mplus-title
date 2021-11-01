import type { Regions } from "@prisma/client";
import type { PageConfig } from "next";
import { Fragment } from "react";

import type { FactionData } from "../lib/getStaticProps";

export type IndexProps = {
  data: Record<Regions, FactionData>;
  meta: {
    generatedAt: number;
    nextUpdateAt: number;
  };
  history: [];
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
          <br />
          numbers in brackets are based on the raider.io api. these seem to lag
          behind my manual calculation, but I've included them for transparency
          reasons.
          <br />
          <br />
          historical data coming soon!
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
                <tr className="text-center text-blue-400 hover:bg-gray-800">
                  <td>{region}</td>
                  <td>alliance</td>
                  <td>
                    {factionData.alliance.custom.rank} (
                    {factionData.alliance.rio.rank})
                  </td>
                  <td>
                    {factionData.alliance.custom.score} (
                    {factionData.alliance.rio.score})
                  </td>
                </tr>
                <tr className="text-center text-red-400 hover:bg-gray-800">
                  <td>{region}</td>
                  <td>horde</td>
                  <td>
                    {factionData.horde.custom.rank} (
                    {factionData.horde.rio.rank})
                  </td>
                  <td>
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

export { getStaticProps } from "../lib/getStaticProps";
