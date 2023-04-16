import  { type Regions } from "@prisma/client";

import  { type Dataset} from "./seasons";
import { type Season } from "./seasons";

export const calculateFactionDiffForWeek = (
  data: Dataset[],
  crossFactionSupport: Season["crossFactionSupport"],
  isFirstWeek: boolean,
  from: number,
  to: number
): { hordeDiff: number; allianceDiff: number; xFactionDiff: number } => {
  const hasCompleteXFactionSupport = crossFactionSupport === "complete";
  const thisWeeksData = data.filter(
    (dataset) => dataset.ts >= from && dataset.ts <= to
  );

  const horde = hasCompleteXFactionSupport
    ? []
    : thisWeeksData.filter((dataset) => dataset.faction === "horde");
  const alliance = hasCompleteXFactionSupport
    ? []
    : thisWeeksData.filter((dataset) => dataset.faction === "alliance");

  const hordeEndMatch = hasCompleteXFactionSupport
    ? null
    : [...horde].reverse()[0];
  const hordeStartMatch = hasCompleteXFactionSupport ? null : horde[0];

  const allianceEndMatch = hasCompleteXFactionSupport
    ? null
    : [...alliance].reverse()[0];
  const allianceStartMatch = hasCompleteXFactionSupport ? null : alliance[0];

  const xFactionEndMatch = hasCompleteXFactionSupport
    ? thisWeeksData[thisWeeksData.length - 1]
    : crossFactionSupport === "partial"
    ? [...thisWeeksData].reverse().find((dataset) => !dataset.faction)
    : null;
  const xFactionStartMatch = hasCompleteXFactionSupport
    ? thisWeeksData[0]
    : crossFactionSupport === "partial"
    ? thisWeeksData.find((dataset) => !dataset.faction)
    : null;

  const hordeDiff =
    hordeEndMatch && hordeStartMatch
      ? hordeEndMatch.score -
        (isFirstWeek && hordeStartMatch === data[0] ? 0 : hordeStartMatch.score)
      : 0;
  const allianceDiff =
    allianceEndMatch && allianceStartMatch
      ? allianceEndMatch.score -
        (isFirstWeek && allianceStartMatch === data[0]
          ? 0
          : allianceStartMatch.score)
      : 0;

  const xFactionDiff =
    xFactionEndMatch && xFactionStartMatch
      ? xFactionEndMatch.score -
        (isFirstWeek && xFactionStartMatch === data[0]
          ? 0
          : xFactionStartMatch.score)
      : 0;

  return {
    hordeDiff,
    allianceDiff,
    xFactionDiff,
  };
};

export const orderedRegionsBySize: Regions[] = ["eu", "us", "tw", "kr"];
