import { type Regions } from "prisma/generated/prisma/enums";

import { type Season } from "../seasons";

export type TempBannerProps = {
  season: Season;
  region: Regions;
};

export default function TempBanner({
  season,
  region,
}: TempBannerProps): JSX.Element {
  return (
    <div className="my-2 bg-red-500 p-2 text-center">
      Leaderboard data on Raider.io's end sadly broke as you can see below. Use{" "}
      <a
        href={`https://raider.io/mythic-plus/cutoffs/${season.rioKey}/${region}`}
        className="cursor-pointer underline"
        target="_blank"
        rel="noreferrer"
      >
        their own tool for the remainder of the season.
      </a>
    </div>
  );
}
