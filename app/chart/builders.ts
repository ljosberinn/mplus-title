/**
 * Pure, client-safe chart/view builders extracted from `load.server.ts`.
 *
 * Everything here derives Highcharts presentation objects from a season's
 * config + already-loaded `Dataset[]` (+ a precomputed extrapolation). None of
 * it touches the DB, Redis, env or any other server-only dependency, so it can
 * run in the browser. The data-loading and the extrapolation/`logDamped` math
 * stay in `load.server.ts` (the backtest regression guard).
 */
import {
  type Options,
  type SeriesArearangeOptions,
  type SeriesLineOptions,
  type SeriesScatterOptions,
  type XAxisPlotBandsOptions,
  type XAxisPlotLinesOptions,
  type YAxisPlotLinesOptions,
} from "highcharts";
import { type Regions } from "prisma/generated/prisma/enums";

import { getAffixIconUrl } from "../affixes";
import { type Dataset, type EnhancedSeason, type Season } from "../seasons";
import { type Overlay } from "../utils";

const dayInMs = 24 * 60 * 60 * 1000;
const oneWeekInMs = 7 * dayInMs;

/** The shape returned by `calculateExtrapolation` in `load.server.ts`. */
export type Extrapolation =
  | null
  | [number, number][]
  | {
      from: Omit<Dataset, "rank" | "rank100" | "score100">;
      to: Omit<Dataset, "rank" | "rank100" | "score100">;
    };

export const colors = {
  alliance: "#60a5fa",
  horde: "#f87171",
  xFaction: "#EEE7D8",
  extrapolation: "#ccaa8aff",
  extrapolationHistory: "gray",
  top1: "orange",
} as const;

export function toOneDigit(int: number): number {
  return Number.parseFloat(int.toFixed(1));
}

/** Static Highcharts options shared by every region chart (no per-season data). */
export const chartBlueprint: Options = {
  accessibility: {
    enabled: true,
  },
  title: {
    text: "",
  },
  chart: {
    backgroundColor: "transparent",
    zooming: {
      type: "x",
      resetButton: {
        position: {
          verticalAlign: "middle",
        },
      },
    },
  },
  credits: {
    enabled: false,
  },
  legend: {
    itemStyle: {
      color: "#c2c7d0",
      fontSize: "15px",
    },
    itemHoverStyle: {
      color: "#fff",
    },
  },
  xAxis: {
    title: {
      text: "Date",
      style: {
        color: "#fff",
        lineColor: "#333",
        tickColor: "#333",
      },
    },
    labels: {
      style: {
        color: "#fff",
        fontWeight: "normal",
      },
    },
    type: "datetime",
    plotBands: [],
    plotLines: [],
  },
  yAxis: {
    title: {
      text: "Score",
      style: {
        color: "#fff",
      },
    },
    gridLineColor: `rgba(255, 255, 255, 0.25)`,
    labels: {
      style: {
        color: "#fff",
        fontWeight: "normal",
      },
    },
    plotLines: [],
  },
  tooltip: {
    shared: true,
    outside: true,
  },
  plotOptions: {
    line: {
      dataLabels: {
        enabled: true,
        color: "#fff",
      },
      marker: {
        lineColor: "#333",
        enabled: false,
      },
    },
  },
};

// Per-day upper margin of the confidence band, as a fraction of the *current*
// (anchor) score. Calibrated by leave-one-season-out, ONE-SIDED conformal
// prediction in scripts/backtest-advanced.ts: the 0.9-quantile of the signed
// upside residual (actual - pred) / anchorScore was +1.18% at the 21-day lead
// (excluding the anomalous df-season-2), giving ~92% one-sided coverage
// ("≥90% of cutoffs land at or below the upper bound").
// Replaces the previous ±1.72% which was the 90% band on the |error| magnitude
// applied one-sided — i.e. the ~95th upper percentile, hence too high.
// The band starts at zero width "now" and grows linearly with the lead.
const CONFORMAL_BAND_RATE_PER_DAY = 0.0118 / 21;

/**
 * Derives an arearange [x, low, high] band around an extrapolation trajectory.
 * Width is ~0 at the anchor (now) and widens with the lead time; the lower bound
 * never drops below the current score, since the cutoff cannot decrease.
 */
export function calculateExtrapolationBand(
  extrapolation: Extrapolation,
): [number, number, number][] {
  if (extrapolation === null) {
    return [];
  }

  const points: [number, number][] = Array.isArray(extrapolation)
    ? extrapolation
    : [
        [extrapolation.from.ts, extrapolation.from.score],
        [extrapolation.to.ts, extrapolation.to.score],
      ];

  if (points.length === 0) {
    return [];
  }

  const anchorTs = points[0][0];
  const anchorScore = points[0][1];

  return points.map(([ts, score]): [number, number, number] => {
    const daysAhead = (ts - anchorTs) / dayInMs;
    // margin is a fraction of the anchor (current) score, not the projected
    // score, so it doesn't compound with the projection's own rise (option B).
    const upperMargin = anchorScore * CONFORMAL_BAND_RATE_PER_DAY * daysAhead;

    // The lower bound is pinned to the current score: the cutoff cannot drop
    // below where it stands today, so the band is the uncertainty fan between
    // "no further gain" (current score) and the optimistic projection plus a
    // one-sided 90% upper margin.
    return [ts, toOneDigit(anchorScore), toOneDigit(score + upperMargin)];
  });
}

type ChartSeries =
  | SeriesLineOptions
  | SeriesScatterOptions
  | SeriesArearangeOptions;

/** Pushes a dashed extrapolation line plus its confidence band onto `options`. */
function pushExtrapolationSeries(
  options: ChartSeries[],
  extrapolation: Extrapolation,
  config: {
    lineId: string;
    bandId: string;
    name: string;
    bandName: string;
    color: string;
  },
): void {
  if (extrapolation === null) {
    return;
  }

  const data: [number, number][] = Array.isArray(extrapolation)
    ? extrapolation
    : [
        [extrapolation.from.ts, extrapolation.from.score],
        [extrapolation.to.ts, extrapolation.to.score],
      ];

  // push the band first so the extrapolation line renders on top of it
  const band = calculateExtrapolationBand(extrapolation);

  if (band.length > 0) {
    options.push({
      type: "arearange",
      id: config.bandId,
      name: config.bandName,
      accessibility: {
        description:
          "Confidence band around the extrapolation; historically ~90% of outcomes landed within it.",
      },
      color: config.color,
      fillOpacity: 0.15,
      lineWidth: 0,
      data: band,
      marker: {
        enabled: false,
      },
      enableMouseTracking: false,
      visible: true,
    });
  }

  options.push({
    type: "line",
    id: config.lineId,
    name: config.name,
    accessibility: {
      description:
        "A projection of how the cutoff will evolve over time based on various parameters.",
    },
    color: config.color,
    data,
    dashStyle: "ShortDash",
    marker: {
      enabled: true,
      radius: 3,
      symbol: "triangle",
    },
    visible: true,
  });
}

export function calculateSeries(
  season: Season,
  data: Dataset[],
  extrapolation: Extrapolation,
  extrapolationHistory: SeriesScatterOptions["data"],
  extrapolation100: Extrapolation = null,
): ChartSeries[] {
  const options: ChartSeries[] = [];

  if (season.crossFactionSupport !== "complete") {
    options.push(
      {
        type: "line",
        name: "Score Horde",
        id: "horde",
        color: colors.horde,
        data: data
          .filter((dataset) => dataset.faction === "horde")
          .map((dataset) => {
            return [dataset.ts, dataset.score];
          }),
      },
      {
        type: "line",
        name: "Score Alliance",
        id: "alliance",
        color: colors.alliance,
        data: data
          .filter((dataset) => dataset.faction === "alliance")
          .map((dataset) => {
            return [dataset.ts, dataset.score];
          }),
      },
    );
  }

  if (season.crossFactionSupport !== "none") {
    options.push({
      type: "line",
      name: "Score 0.1%",
      id: "score",
      color: colors.xFaction,
      data: data
        .filter((dataset) => !("faction" in dataset))
        .map((dataset) => {
          return [dataset.ts, dataset.score];
        }),
    });
  }

  pushExtrapolationSeries(options, extrapolation, {
    lineId: "extrapolation",
    bandId: "extrapolation-confidence",
    name: "Score Extrapolated",
    bandName: "Extrapolation Confidence",
    color: colors.extrapolation,
  });

  if (Array.isArray(extrapolationHistory) && extrapolationHistory.length > 0) {
    options.push({
      type: "scatter",
      id: "extrapolation-history",
      name: "Extrapolation History",
      color: colors.extrapolationHistory,
      accessibility: {
        description:
          "Series of data the score was expected to be at for a given point in time. Useful to compare how accurate prediction was.",
      },
      dashStyle: "Dot",
      marker: {
        enabled: true,
        radius: 2,
        symbol: "circle",
      },
      visible: false,
      data: extrapolationHistory,
    });
  }

  if (data.some((dataset) => dataset.score100 !== null)) {
    options.push({
      type: "line",
      name: "Score 1%",
      id: "score100",
      color: colors.top1,
      data: data
        .filter((dataset) => dataset.score100 !== null)
        .map((dataset) => {
          return [dataset.ts, dataset.score100];
        }),
    });

    pushExtrapolationSeries(options, extrapolation100, {
      lineId: "extrapolation-score100",
      bandId: "extrapolation-score100-confidence",
      name: "Score 1% Extrapolated",
      bandName: "Score 1% Confidence",
      color: colors.top1,
    });
  }

  {
    const charactersAboveCutoff = data
      .reduce<Dataset[]>((acc, dataset) => {
        if (dataset.rank === null) {
          return acc;
        }

        const prev = acc[acc.length - 1];

        if (prev?.rank !== dataset.rank) {
          acc.push(dataset);
        }

        return acc;
      }, [])
      .map((dataset) => [dataset.ts, dataset.rank]);

    if (charactersAboveCutoff.length > 0) {
      options.push({
        type: "line",
        name: "# Characters Above Cutoff",
        data: charactersAboveCutoff,
        color: "white",
        visible: false,
      });
    }
  }

  return options;
}

function createWeekDiffString(value: number, color: string): string {
  const prefix = value > 0 ? "+" : value === 0 ? "±" : "";
  return `<span style='font-size: 10px; color: ${color};'>${prefix}${value.toFixed(1)}</span>`;
}

export function calculateXAxisPlotBands(
  season: Season,
  region: Regions,
  data: Dataset[],
  overlays: readonly Overlay[],
): XAxisPlotBandsOptions[] {
  const seasonStart = season.startDates[region];

  if (!seasonStart) {
    return [];
  }

  const seasonEnd = season.endDates[region];
  const { affixes, crossFactionSupport, wcl } = season;

  let weeks: number;

  if (seasonEnd) {
    weeks = (seasonEnd - seasonStart) / oneWeekInMs + 1;
  } else {
    const hasExtrapolation = true;
    weeks =
      (Date.now() + (hasExtrapolation ? oneWeekInMs * 3 : 0) - seasonStart) /
        oneWeekInMs +
      1;
  }

  const now = Date.now();

  return Array.from({
    length: weeks,
  }).flatMap<XAxisPlotBandsOptions>((_, index) => {
    const options: XAxisPlotBandsOptions[] = [];

    const from = seasonStart + index * oneWeekInMs;
    const to = from + oneWeekInMs;
    const color = index % 2 === 0 ? "#4b5563" : "#1f2937";

    const rotation =
      affixes[index >= affixes.length ? index % affixes.length : index] ?? [];

    const relevantRotationSlice =
      // for future weeks early into a season without a full rotation, default to -1 // questionmarks
      from > now && affixes.length < 10
        ? [-1, -1, -1]
        : rotation.length === 3
          ? rotation
          : rotation.slice(0, 3);

    options.push({
      id: "background-color",
      from,
      to,
      color: from > now ? `${color}50` : color,
      label: {
        useHTML: true,
        style: {
          display: "flex",
        },
        text:
          (wcl?.zoneId ?? 0) < 39 && overlays.includes("affixes")
            ? relevantRotationSlice
                .map((affix) => {
                  return `<img width="18" height="18" style="transform: rotate(-90deg); opacity: 0.75;" src="${getAffixIconUrl(
                    affix,
                  )}"/>`;
                })
                .join("")
            : undefined,
        rotation: 90,
        align: "left",
        x: 5,
        y: 5,
      },
    });

    const { allianceDiff, hordeDiff, xFactionDiff, score100Diff } =
      calculateFactionDiffForWeek(
        data,
        crossFactionSupport,
        index === 0,
        from,
        to,
      );

    const text: string[] = [];

    if (crossFactionSupport !== "complete") {
      text.push(
        createWeekDiffString(hordeDiff, colors.horde),
        createWeekDiffString(allianceDiff, colors.alliance),
      );
    }

    if (
      from > now ||
      crossFactionSupport === "none" ||
      (crossFactionSupport === "partial" && xFactionDiff === 0)
    ) {
    } else {
      const xFactionStr = createWeekDiffString(xFactionDiff, colors.xFaction);
      const score100Str =
        score100Diff === 0
          ? ""
          : ` | ${createWeekDiffString(score100Diff, colors.top1)}`;
      text.push(xFactionStr + score100Str);
    }

    options.push({
      from,
      to,
      id: "weekly-difference",
      color: "transparent",
      label: {
        verticalAlign: "bottom",
        text: text.join("<br>"),
        useHTML: true,
        y: text.length * -15,
      },
    });

    return options.filter(
      (options): options is XAxisPlotBandsOptions => options !== null,
    );
  });
}

export function calculateYAxisPlotLines(
  season: Season,
  region: Regions,
): YAxisPlotLinesOptions[] {
  const cutoffs = season.confirmedCutoffs[region];

  if ("alliance" in cutoffs && "horde" in cutoffs) {
    return [
      {
        label: {
          text: `Confirmed cutoff for Alliance at ${cutoffs.alliance}`,
          rotation: 0,
          style: { color: colors.alliance },
        },
        value: cutoffs.alliance,
        dashStyle: "Dash",
      },
      {
        label: {
          text: `Confirmed cutoff for Horde at ${cutoffs.horde}`,
          rotation: 0,
          style: { color: colors.horde },
        },
        value: cutoffs.horde,
        dashStyle: "Dash",
      },
    ];
  }

  if (cutoffs.score === 0) {
    return [];
  }

  return [
    {
      label: {
        text: `Confirmed cutoff at ${cutoffs.score}`,
        rotation: 0,
        style: { color: colors.xFaction },
      },
      value: cutoffs.score,
      dashStyle: "Dash",
    },
  ];
}

export function calculateXAxisPlotLines(
  season: Season,
  region: Regions,
  data: Dataset[],
  extrapolation: Extrapolation,
  overlays: readonly Overlay[],
): XAxisPlotLinesOptions[] {
  const endDate = season.endDates[region];
  const startDate = season.startDates[region];

  const lines: XAxisPlotLinesOptions[] = [];

  if (overlays.includes("patches")) {
    Object.entries(season.patches).forEach(([description, regionalData]) => {
      const timestamp = regionalData[region];

      lines.push({
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
      });
    });
  }

  if (overlays.includes("dungeonHotfixes")) {
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
      },
    );
  }

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
    overlays.includes("levelCompletion") &&
    season.crossFactionSupport === "complete" &&
    (season.wcl?.zoneId ?? 0) >= 32 &&
    data.length > 0 &&
    startDate
  ) {
    if ((season.wcl?.zoneId ?? 0) < 37) {
      lines.push(
        ...calcOldLevelCompletionLines(season, data, startDate, extrapolation),
      );
    } else if ((season.wcl?.zoneId ?? 0) === 39) {
      lines.push(
        ...calcTwwS1LevelCompletionLines(
          season,
          data,
          startDate,
          extrapolation,
        ),
      );
    } else if ((season.wcl?.zoneId ?? 0) >= 43) {
      lines.push(
        ...calcTwwS2LevelCompletionLines(
          season,
          data,
          startDate,
          extrapolation,
        ),
      );
    }
  }

  if (startDate) {
    const end = endDate ?? Date.now();

    for (let i = startDate; i <= end; i += oneWeekInMs) {
      const weeksSinceStart = Math.round((i - startDate) / oneWeekInMs) + 1;

      lines.push({
        zIndex: 100,
        id: "week-number",
        label: {
          text: `W${weeksSinceStart}`,
          align: "center",
          rotation: 0,
          y: 15,
          x: 25,
          style: {
            color: "lightgreen",
          },
        },
        color: "transparent",
        value: i,
      });

      if (weeksSinceStart === 1) {
        continue;
      }

      const match = data.find((dataset) => dataset.ts >= i);

      if (match) {
        lines.push({
          zIndex: 100,
          label: {
            text: `${match.score}`,
            align: "center",
            rotation: 0,
            y: 265,
            style: {
              color: "lightgreen",
            },
          },
          color: "transparent",
          value: i,
        });
      }
    }
  }

  return lines;
}

export function calculateZoom(
  season: Season,
  region: Regions,
  data: Dataset[],
  extrapolation: EnhancedSeason["score"]["extrapolation"]["EU"],
): [number, number] {
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
    const offset =
      daysUntilSeasonEnding < 3
        ? 1.5
        : daysUntilSeasonEnding < 7
          ? 2.5
          : daysUntilSeasonEnding < 14
            ? 3.5
            : null;

    if (offset) {
      const backThen = [...data]
        .reverse()
        .find((dataset) => dataset.ts < zoomEnd - offset * oneWeekInMs);

      return [backThen ? backThen.ts : 0, zoomEnd];
    }
  }

  // offset by +2 weeks since extrapolation is at least two into the future
  const offset = (extrapolation ? 6 : 4) * oneWeekInMs;

  const backThen = [...data]
    .reverse()
    .find((dataset) => dataset.ts < zoomEnd - offset);

  return [backThen ? backThen.ts : 0, zoomEnd];
}

function calculateFactionDiffForWeek(
  data: Dataset[],
  crossFactionSupport: Season["crossFactionSupport"],
  isFirstWeek: boolean,
  from: number,
  to: number,
): {
  hordeDiff: number;
  allianceDiff: number;
  xFactionDiff: number;
  score100Diff: number;
} {
  const hasCompleteXFactionSupport = crossFactionSupport === "complete";
  const thisWeeksData = data.filter(
    (dataset) => dataset.ts >= from && dataset.ts <= to,
  );

  let horde: Dataset[];
  let alliance: Dataset[];
  let hordeEndMatch = null;
  let hordeStartMatch = null;
  let allianceEndMatch = null;
  let allianceStartMatch = null;
  let xFactionEndMatch = null;
  let xFactionStartMatch = null;

  if (hasCompleteXFactionSupport) {
    xFactionEndMatch = thisWeeksData[thisWeeksData.length - 1];
    xFactionStartMatch = thisWeeksData[0];
  } else {
    horde = thisWeeksData.filter((dataset) => dataset.faction === "horde");
    alliance = thisWeeksData.filter(
      (dataset) => dataset.faction === "alliance",
    );

    hordeEndMatch = [...horde].reverse()[0];
    hordeStartMatch = horde[0];
    allianceEndMatch = [...alliance].reverse()[0];
    allianceStartMatch = alliance[0];

    if (crossFactionSupport === "partial") {
      xFactionEndMatch = [...thisWeeksData]
        .reverse()
        .find((dataset) => !dataset.faction);
      xFactionStartMatch = thisWeeksData.find((dataset) => !dataset.faction);
    }
  }

  const score100Data = thisWeeksData.filter(
    (dataset) => dataset.score100 !== null,
  );
  const score100StartMatch = score100Data[0];
  const score100EndMatch = score100Data[score100Data.length - 1];

  let hordeDiff = 0;
  let allianceDiff = 0;
  let xFactionDiff = 0;
  let score100Diff = 0;

  if (hordeEndMatch && hordeStartMatch) {
    hordeDiff =
      hordeEndMatch.score -
      (isFirstWeek && hordeStartMatch === data[0] ? 0 : hordeStartMatch.score);
  }

  if (allianceEndMatch && allianceStartMatch) {
    allianceDiff =
      allianceEndMatch.score -
      (isFirstWeek && allianceStartMatch === data[0]
        ? 0
        : allianceStartMatch.score);
  }

  if (xFactionEndMatch && xFactionStartMatch) {
    xFactionDiff =
      xFactionEndMatch.score -
      (isFirstWeek && xFactionStartMatch === data[0]
        ? 0
        : xFactionStartMatch.score);
  }

  if (score100EndMatch && score100StartMatch) {
    const firstScore100InData = data.find((d) => d.score100 !== null);
    score100Diff =
      score100EndMatch.score100! -
      (isFirstWeek && score100StartMatch === firstScore100InData
        ? 0
        : score100StartMatch.score100!);
  }

  return {
    hordeDiff,
    allianceDiff,
    xFactionDiff,
    score100Diff,
  };
}

export { calculateFactionDiffForWeek };

function calcTwwS2LevelCompletionLines(
  season: Season,
  data: Dataset[],
  startDate: number,
  extrapolation: Extrapolation,
): XAxisPlotLinesOptions[] {
  const lines: XAxisPlotLinesOptions[] = [];
  const base = 125;
  const perLevelPoints = 15;

  const numberOfDungeons =
    typeof season.dungeons === "number"
      ? season.dungeons
      : season.dungeons.length;

  for (let level = 5; level <= 25; level++) {
    let affixPoints = 0;

    if (level >= 7) {
      affixPoints += 15;
    }

    if (level >= 10) {
      affixPoints += 15;
    }

    if (level >= 4 && level <= 11) {
      affixPoints += 15;
    }

    if (level >= 12) {
      affixPoints += 30;
    }

    const total =
      (base + perLevelPoints * level + affixPoints) * numberOfDungeons;

    let match: Omit<Dataset, "rank" | "rank100" | "score100"> | undefined =
      data.find((dataset) => dataset.score >= total);

    if (!match && Array.isArray(extrapolation)) {
      const extrapolationMatchIndex = extrapolation.findIndex(
        ([, score]) => score >= total,
      );

      if (extrapolationMatchIndex > -1) {
        const extrapolationMatch = extrapolation[extrapolationMatchIndex];

        if (extrapolationMatch[1] === total) {
          match = {
            ts: extrapolationMatch[0],
            score: total,
          };
        } else {
          const last = data[data.length - 1];
          const timeDiff = extrapolationMatch[0] - last.ts;
          const scoreDiff = extrapolationMatch[1] - last.score;

          const step = scoreDiff / timeDiff;

          // expensive, but a lot more precise than just picking next match
          for (let i = 0; i <= timeDiff; i += 60_000) {
            if (last.score + step * i >= total) {
              match = {
                ts: last.ts + i,
                score: total,
              };
              break;
            }
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

  return lines;
}

// TODO: merge these eventually
function calcTwwS1LevelCompletionLines(
  season: Season,
  data: Dataset[],
  startDate: number,
  extrapolation: Extrapolation,
): XAxisPlotLinesOptions[] {
  const lines: XAxisPlotLinesOptions[] = [];
  const base = 125;
  const perLevelPoints = 15;

  const numberOfDungeons =
    typeof season.dungeons === "number"
      ? season.dungeons
      : season.dungeons.length;

  for (let level = 5; level <= 20; level++) {
    let affixPoints = 0;

    if (level >= 4) {
      affixPoints += 10;
    }

    if (level >= 10) {
      affixPoints += 10;
    }

    if (level >= 7) {
      affixPoints += 15;
    }

    if (level >= 2 && level <= 11) {
      affixPoints += 10;
    }

    if (level >= 12) {
      affixPoints += 25;
    }

    const total =
      (base + perLevelPoints * level + affixPoints) * numberOfDungeons;

    let match: Omit<Dataset, "rank" | "rank100" | "score100"> | undefined =
      data.find((dataset) => {
        if (dataset.ts - startDate < oneWeekInMs) {
          return dataset.score >= total;
        }

        return false;
      });

    if (!match && Array.isArray(extrapolation)) {
      const extrapolationMatchIndex = extrapolation.findIndex(
        ([, score]) => score >= total,
      );

      if (extrapolationMatchIndex > -1) {
        const last = data[data.length - 1];
        const extrapolationMatch = extrapolation[extrapolationMatchIndex];

        const timeDiff = extrapolationMatch[0] - last.ts;
        const scoreDiff = extrapolationMatch[1] - last.score;

        const step = scoreDiff / timeDiff;

        // expensive, but a lot more precise than just picking next match
        for (let i = 0; i < timeDiff; i += 60_000) {
          if (last.score + step * i > total) {
            match = {
              ts: last.ts + i,
              score: total,
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

  return lines;
}

function calcOldLevelCompletionLines(
  season: Season,
  data: Dataset[],
  startDate: number,
  extrapolation: Extrapolation,
): XAxisPlotLinesOptions[] {
  const lines: XAxisPlotLinesOptions[] = [];
  const base = 25;
  const affixPoints = 25;

  const startLevel = 15;
  const endLevel = 23;
  const numberOfDungeons =
    typeof season.dungeons === "number"
      ? season.dungeons
      : season.dungeons.length;

  // calculate thresholds for week 1 separeately in order to show low key levels again across both weeks
  for (let level = startLevel; level <= endLevel; level++) {
    const levelPoints = 5 * level + (level - (level > 10 ? 10 : 0)) * 2;
    const total = base + levelPoints + affixPoints;
    // week 1 naturally has only 1 affix set
    const firstWeek = total * 1.5 * numberOfDungeons;

    const match: Omit<Dataset, "rank"> | undefined = data.find((dataset) => {
      if (dataset.ts - startDate < oneWeekInMs) {
        return dataset.score >= firstWeek;
      }

      return false;
    });

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

  for (let level = startLevel + 1; level <= 35; level++) {
    const levelPoints = 5 * level + (level - (level > 10 ? 10 : 0)) * 2;

    const total = base + levelPoints + affixPoints;

    const set1 = total * 1.5; // basically tyrannical only
    const set2 = total * 0.5; // fort

    // week 1 naturally has only 1 affix set
    const bothWeeks = set1 + set2;
    const allDungeonsBothWeeks = bothWeeks * numberOfDungeons;

    let match: Omit<Dataset, "rank" | "rank100" | "score100"> | undefined =
      data.find((dataset) => {
        return dataset.score >= allDungeonsBothWeeks;
      });

    // if we have an extrapolation, check whether a key level threshold is
    // reached during the extrapolation window
    if (!match && Array.isArray(extrapolation)) {
      const extrapolationMatchIndex = extrapolation.findIndex(
        ([, score]) => score >= allDungeonsBothWeeks,
      );

      if (extrapolationMatchIndex > -1) {
        const last = data[data.length - 1];
        const extrapolationMatch = extrapolation[extrapolationMatchIndex];

        const timeDiff = extrapolationMatch[0] - last.ts;
        const scoreDiff = extrapolationMatch[1] - last.score;

        const step = scoreDiff / timeDiff;

        // expensive, but a lot more precise than just picking next match
        for (let i = 0; i < timeDiff; i += 60_000) {
          if (last.score + step * i > allDungeonsBothWeeks) {
            match = {
              ts: last.ts + i,
              score: allDungeonsBothWeeks,
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

  return lines;
}
