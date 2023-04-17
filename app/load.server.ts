import { Regions } from "@prisma/client";
import { type XAxisPlotLinesOptions } from "highcharts";

import { prisma } from "./prisma.server";
import { type Dataset, type EnhancedSeason, type Season } from "./seasons";
import { calculateFactionDiffForWeek, orderedRegionsBySize } from "./utils";

const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

const getCrossFactionHistory = (
  region: Regions,
  gte: number | null,
  lte?: number
) => {
  if (!gte) {
    return [];
  }

  return prisma.crossFactionHistory.findMany({
    where: {
      region,
      timestamp: {
        gte: Math.ceil(gte / 1000),
        lte: lte ? Math.ceil(lte / 1000) : lte,
      },
    },
    select: {
      timestamp: true,
      score: true,
    },
    orderBy: {
      timestamp: "desc",
    },
  });
};

const getHistory = (region: Regions, gte: number | null, lte?: number) => {
  if (!gte) {
    return [];
  }

  return prisma.history.findMany({
    where: {
      region,
      timestamp: {
        gte: Math.ceil(gte / 1000),
        lte: lte ? Math.ceil(lte / 1000) : lte,
      },
    },
    select: {
      timestamp: true,
      faction: true,
      customScore: true,
    },
    orderBy: {
      timestamp: "desc",
    },
  });
};

export const loadDataForRegion = async (
  region: Regions,
  season: Season
): Promise<Dataset[]> => {
  const gte = season.startDates[region];
  const lte = season.endDates[region] ?? undefined;

  const [rawHistory, rawCrossFactionHistory] = await Promise.all([
    season.crossFactionSupport === "complete"
      ? []
      : getHistory(region, gte, lte),
    season.crossFactionSupport === "none"
      ? []
      : getCrossFactionHistory(region, gte, lte),
  ]);

  return [...rawHistory, ...rawCrossFactionHistory]
    .map((dataset) => {
      const next: Dataset = {
        ts: Number(dataset.timestamp) * 1000,
        score: "customScore" in dataset ? dataset.customScore : dataset.score,
      };

      if ("faction" in dataset) {
        next.faction = dataset.faction;
      }

      return next;
    })
    .filter((dataset) => {
      return dataset.score > 0;
    })
    .sort((a, b) => a.ts - b.ts);
};

export const determineRegionsToDisplay = async (
  request: Request
): Promise<Regions[]> => {
  const params = new URL(request.url).searchParams;
  const possiblyRegions = params.get("regions");

  if (!possiblyRegions) {
    return orderedRegionsBySize;
  }

  const maybeRegions = possiblyRegions
    .split("~")
    .filter((maybeRegion): maybeRegion is Regions => maybeRegion in Regions);

  if (maybeRegions.length === 0) {
    return orderedRegionsBySize;
  }

  return maybeRegions;
};
export const determineRegionsFromFormData = async (
  formData: FormData
): Promise<Regions[]> => {
  return orderedRegionsBySize.filter((region) => formData.get(region) === "on");
};

export const determineExtrapolationEnd = (url: string): number | null => {
  const params = new URL(url).searchParams;

  const maybeDate = params.get("extrapolationEndDate");

  if (!maybeDate) {
    return null;
  }

  try {
    const date = new Date(maybeDate).getTime();

    if (date < Date.now()) {
      return null;
    }

    return date;
  } catch {
    return null;
  }
};

export const calculateExtrapolation = (
  season: Season,
  region: Regions,
  data: Dataset[],
  endOverride: number | null
): null | [number, number][] | { from: Dataset; to: Dataset } => {
  let seasonEnding = season.endDates[region];

  if (seasonEnding && Date.now() >= seasonEnding) {
    return null;
  }

  const seasonStart = season.startDates[region];

  if (!seasonStart) {
    return null;
  }

  if (!seasonEnding && endOverride) {
    // the date is unaware of hours, so adjust based on start time regionally
    const endOverrideDate = new Date(endOverride);
    endOverrideDate.setHours(new Date(seasonStart).getUTCHours());
    seasonEnding = endOverrideDate.getTime();
  }

  const daysUntilSeasonEnding = (() => {
    if (seasonEnding && seasonEnding > Date.now()) {
      return (seasonEnding - Date.now()) / 1000 / 60 / 60 / 24;
    }

    return null;
  })();

  const lastDataset = data[data.length - 1];
  const firstRelevantDataset = determineExtrapolationStart(
    data,
    season,
    region
  );

  if (!firstRelevantDataset) {
    return null;
  }

  const weeks = seasonEnding ? (seasonEnding - seasonStart) / oneWeekInMs : 36;

  const passedWeeksDiff = Array.from({ length: weeks }, (_, index) => {
    const from = seasonStart + index * oneWeekInMs;
    const to = from + oneWeekInMs;

    return calculateFactionDiffForWeek(
      data,
      season.crossFactionSupport,
      index === 0,
      from,
      to
    ).xFactionDiff;
  })
    .filter(Boolean)
    .slice(4);

  const daysUntilSeasonEndingOrFourWeeks = daysUntilSeasonEnding ?? 21;
  const to =
    seasonEnding ??
    lastDataset.ts + (daysUntilSeasonEndingOrFourWeeks / 7) * oneWeekInMs;
  const timeUntilExtrapolationEnd = to - lastDataset.ts;

  // given a couple weeks past the first four, apply weighting on older weeks
  if (
    passedWeeksDiff.length >= 4 &&
    timeUntilExtrapolationEnd > oneWeekInMs / 7
  ) {
    const interval =
      timeUntilExtrapolationEnd / daysUntilSeasonEndingOrFourWeeks;
    const scoreIncreaseSteps =
      passedWeeksDiff.reduce((acc, diff, index) => {
        // looking at week 5 in week 10 means its 5 weeks ago, applying a weight of 0.5
        // looking at week 10 in week 10 means its the current week, applying a weight of 1
        const factor = 1 - (passedWeeksDiff.length - index - 1) / 10;
        return acc + diff * (factor > 0 ? factor : 0.1);
      }) /
      passedWeeksDiff.length /
      7;

    return [
      [lastDataset.ts, lastDataset.score],
      ...Array.from<number, [number, number]>(
        { length: daysUntilSeasonEndingOrFourWeeks - 1 },
        (_, i) => {
          return [
            lastDataset.ts + interval * (i + 1),
            toOneDigit(lastDataset.score + scoreIncreaseSteps * (i + 1)),
          ];
        }
      ),
      [
        to,
        toOneDigit(
          lastDataset.score +
            scoreIncreaseSteps * daysUntilSeasonEndingOrFourWeeks
        ),
      ],
    ];
  }

  const timePassed = lastDataset.ts - firstRelevantDataset.ts;
  const daysPassed = timePassed / 1000 / 60 / 60 / 24;
  const factor = daysUntilSeasonEndingOrFourWeeks / daysPassed;

  const score = toOneDigit(
    lastDataset.score +
      (lastDataset.score - firstRelevantDataset.score) * factor
  );

  if (timeUntilExtrapolationEnd > oneWeekInMs / 7) {
    const interval =
      timeUntilExtrapolationEnd / daysUntilSeasonEndingOrFourWeeks;
    const scoreIncreaseSteps =
      (score - lastDataset.score) / daysUntilSeasonEndingOrFourWeeks;

    return [
      [lastDataset.ts, lastDataset.score],
      ...Array.from<number, [number, number]>(
        { length: daysUntilSeasonEndingOrFourWeeks - 1 },
        (_, i) => {
          return [
            lastDataset.ts + interval * (i + 1),
            toOneDigit(lastDataset.score + scoreIncreaseSteps * (i + 1)),
          ];
        }
      ),
      [to, score],
    ];
  }

  return {
    from: lastDataset,
    to: {
      score,
      ts: to,
    },
  };
};

const determineExtrapolationStart = (
  data: Dataset[],
  season: Season,
  region: Regions
): Dataset | null => {
  const seasonStart = season.startDates[region];

  if (!seasonStart) {
    return null;
  }

  const firstDataset = data.find((dataset) => {
    return dataset.ts >= seasonStart + 4 * oneWeekInMs;
  });

  return firstDataset ?? null;
};

const toOneDigit = (int: number) => {
  return Number.parseFloat(int.toFixed(1));
};

export const calculateZoom = (
  season: Season,
  region: Regions,
  data: Dataset[],
  extrapolation: EnhancedSeason["extrapolation"]["eu"]
): [number, number] => {
  const seasonEnding = season.endDates[region];

  const daysUntilSeasonEnding =
    seasonEnding && seasonEnding > Date.now()
      ? (seasonEnding - Date.now()) / 1000 / 60 / 60 / 24
      : null;

  const zoomEnd =
    (Array.isArray(extrapolation)
      ? extrapolation[extrapolation.length - 1][0]
      : extrapolation?.to.ts) ?? data[data.length - 1].ts;

  if (daysUntilSeasonEnding) {
    if (daysUntilSeasonEnding < 1) {
      const offset = (1 + 1 / 7) * oneWeekInMs;
      const backThen = [...data]
        .reverse()
        .find((dataset) => dataset.ts < zoomEnd - offset);

      return [backThen ? backThen.ts : 0, zoomEnd];
    }

    if (daysUntilSeasonEnding < 7) {
      const offset = (extrapolation ? 3 : 2) * oneWeekInMs;

      const backThen = [...data]
        .reverse()
        .find((dataset) => dataset.ts < zoomEnd - offset);

      return [backThen ? backThen.ts : 0, zoomEnd];
    }
  }

  // offset by +2 weeks since extrapolation is at least tw into the future
  const offset = (extrapolation ? 6 : 4) * oneWeekInMs;

  const backThen = [...data]
    .reverse()
    .find((dataset) => dataset.ts < zoomEnd - offset);

  return [backThen ? backThen.ts : 0, zoomEnd];
};

export const calculateXAxisPlotLines = (
  season: Season,
  region: Regions,
  data: Dataset[],
  extrapolation: ReturnType<typeof calculateExtrapolation>
): XAxisPlotLinesOptions[] => {
  const endDate = season.endDates[region];

  const lines = Object.entries(season.patches).map<XAxisPlotLinesOptions>(
    ([description, regionalData]) => {
      const timestamp = regionalData[region];

      return {
        zIndex: 100,
        label: {
          text: description,
          rotation: 0,
          y: 100,
          style: {
            color: "orange",
          },
        },
        value: timestamp,
        dashStyle: "Dash",
        color: "orange",
      };
    }
  );

  Object.entries(season.dungeonHotfixes).forEach(
    ([description, regionalData]) => {
      const timestamp = regionalData[region];

      lines.push({
        zIndex: 100,
        label: {
          text: description,
          rotation: 0,
          y: 75,
          style: {
            color: "yellow",
          },
        },
        value: timestamp,
        dashStyle: "Dash",
        color: "yellow",
      });
    }
  );

  if (endDate) {
    lines.push({
      zIndex: 100,
      label: {
        text: "Season End",
        rotation: 0,
        x: -75,
        y: 225,
        style: {
          color: "red",
        },
      },
      value: endDate,
      color: "red",
      dashStyle: "Dash",
    });
  }

  // since the score computation is partially season dependant, dont bother for older seasons
  if (
    season.crossFactionSupport === "complete" &&
    (season.wcl?.zoneId ?? 0) >= 32
  ) {
    for (let level = 16; level <= 35; level++) {
      const base = 25;
      const levelPoints = 5 * level + (level - 10) * 2;
      const affixPoints = 25;

      const total = base + levelPoints + affixPoints;

      const tyrannicalAndFortified = total * 1.5 + total * 0.5;
      const allDungeons = tyrannicalAndFortified * season.dungeons;

      let match = data.find((dataset) => {
        return dataset.score >= allDungeons;
      });

      // if we have an extrapolation, check whether a key level threshold is
      // reached during the extrapolation window
      if (!match && Array.isArray(extrapolation)) {
        const extrapolationMatchIndex = extrapolation.findIndex(
          ([, score]) => score >= allDungeons
        );

        if (extrapolationMatchIndex > -1) {
          const last = data[data.length - 1];
          const extrapolationMatch = extrapolation[extrapolationMatchIndex];

          const timeDiff = extrapolationMatch[0] - last.ts;
          const scoreDiff = extrapolationMatch[1] - last.score;

          const step = scoreDiff / timeDiff;

          // expensive, but a lot more precise than just picking next match
          for (let i = 0; i < timeDiff; i += 60_000) {
            if (last.score + step * i > allDungeons) {
              match = {
                ts: last.ts + i,
                score: allDungeons,
              };
              break;
            }
          }
        }
      }

      if (match) {
        lines.push({
          zIndex: 100,
          label: {
            text: `All ${level}`,
            rotation: 0,
            y: 200,
            style: {
              color: "white",
            },
          },
          value: match.ts,
          dashStyle: "Dash",
          color: "white",
        });
      }
    }
  }

  return lines;
};
