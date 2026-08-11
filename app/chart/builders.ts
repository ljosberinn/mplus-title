/**
 * Pure, client-safe chart/view builders extracted from `load.server.ts`.
 *
 * Everything here derives the renderer-agnostic presentation objects in
 * `types.ts` (series/plot lines/plot bands) from a season's config +
 * already-loaded `Dataset[]` (+ a precomputed extrapolation). None of it touches
 * the DB, Redis, env or any other server-only dependency, so it can run in the
 * browser. The data-loading and the extrapolation/`logDamped` math stay in
 * `load.server.ts` (the backtest regression guard). The uPlot adapters in
 * `uplotData.ts` / `dungeonRecordsData.ts` consume what these produce.
 */
import { type Regions } from "prisma/generated/prisma/enums";

import { type Dataset, type EnhancedSeason, type Season } from "../seasons";
import { type Overlay } from "../utils";
import {
  type ChartSeries,
  type PlotBand,
  type PlotLine,
  type ScatterPoint,
} from "./types";

const dayInMs = 24 * 60 * 60 * 1000;
const oneWeekInMs = 7 * dayInMs;

/** The shape returned by `calculateExtrapolation` in `load.server.ts`. */
export type Extrapolation =
  | null
  | [number, number][]
  | {
      from: Omit<Dataset, "score100">;
      to: Omit<Dataset, "score100">;
    };

export const colors = {
  alliance: "#60a5fa",
  horde: "#f87171",
  xFaction: "#EEE7D8",
  extrapolation: "#ccaa8aff",
  extrapolationHistory: "gray",
  top1: "orange",
} as const;

/** Which cutoff line a level-completion pass tracks: the 0.1% (title) `score` or
 * the top-1% `score100`. */
type ScoreKey = "score" | "score100";

/** Reads the cutoff value for the given key, treating a missing `score100` as
 * unreachable so threshold comparisons stay false. */
const scoreValue = (dataset: Dataset, key: ScoreKey): number =>
  (key === "score" ? dataset.score : dataset.score100) ??
  Number.NEGATIVE_INFINITY;

export function toOneDigit(int: number): number {
  return Number.parseFloat(int.toFixed(1));
}

/**
 * The last timestamp the extrapolation reaches (its target), or null when there
 * is no extrapolation. This is what pushes the right edge of the graph into the
 * future, so week bands and week-number markers extend out to it.
 */
function extrapolationEndTs(extrapolation: Extrapolation): number | null {
  if (extrapolation === null) {
    return null;
  }

  if (Array.isArray(extrapolation)) {
    return extrapolation.length > 0
      ? extrapolation[extrapolation.length - 1][0]
      : null;
  }

  return extrapolation.to.ts;
}

// Confidence band margins, as a fraction of the *current* (anchor) score, for a
// lead of `days`: `A · (days / 21)^p`. Calibrated leave-one-season-out in
// scripts/backtest-bands.ts (`npm run db:backtest:bands`) against the signed
// residual (actual - pred) / anchorScore, excluding the anomalous df-season-2.
//
// The previous rate was a single number applied *linearly* in the lead, fitted
// at 21 days and then stretched to the season end — which the chart draws, and
// which early in a season is 100+ days out. Measured, the residual quantiles
// grow markedly sub-linearly (exponents below), so the linear form ballooned far
// out: 9.44% wide at an 84-day lead, against 4.65% here.
//
// The edges are the *q80* and *q20* of the residual, not the q90/q10 they used
// to be. Both tails are fat and driven by a few surprise seasons — at a 70-day
// lead the upper q75 is +0.56% but q90 is +3.10%, a 5.5x jump — so the outer
// quantiles mostly described outcomes that don't happen, and read as a best/worst
// case rather than a forecast. The two targets have to mirror each other, or the
// projection sits visibly off-centre inside its own band.
//
// This makes the band a 60% central interval: the cutoff lands inside it about 3
// times in 5, and finishes above it roughly 1 time in 5. Realised LOSO coverage
// is 56-62% from 5 to 56 days, so it is honest about being that and not more.
const BAND_REFERENCE_DAYS = 21;
const BAND_UPPER_AT_REFERENCE = 0.0049;
const BAND_LOWER_AT_REFERENCE = 0.0087;
const BAND_UPPER_EXPONENT = 0.734;
const BAND_LOWER_EXPONENT = 0.682;

/** The band's margin on one side, as a fraction of the anchor score. */
function bandMarginFraction(
  daysAhead: number,
  atReference: number,
  exponent: number,
): number {
  if (daysAhead <= 0) {
    return 0;
  }

  return atReference * (daysAhead / BAND_REFERENCE_DAYS) ** exponent;
}

/**
 * Derives an arearange [x, low, high] band around an extrapolation trajectory.
 * Width is ~0 at the anchor (now) and widens sub-linearly with the lead time.
 *
 * The band is drawn around the projection with its own margin per side —
 * `high = projection + upper`, `low = projection - lower` — since the residual
 * distribution is not symmetric.
 *
 * The lower bound is floored at the anchor (current) score. The cutoff is a
 * rank threshold over a growing pool of runs, so it essentially cannot fall —
 * backtesting agrees: it finished below its anchor in ~0.5% of snapshots inside
 * 4 weeks and in *zero* beyond that (the smallest 42-day gain on record is
 * +0.36%, the smallest 84-day gain +4.03%). An unfloored lower bound therefore
 * spent most of its width on an outcome that doesn't happen. The residual
 * quantile still governs how far above today's score the bound sits; the floor
 * only stops it dipping below.
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
    // margins are a fraction of the anchor (current) score, not the projected
    // score, so they don't compound with the projection's own rise (option B).
    const high =
      score +
      anchorScore *
        bandMarginFraction(
          daysAhead,
          BAND_UPPER_AT_REFERENCE,
          BAND_UPPER_EXPONENT,
        );
    // floored at the anchor: the cutoff effectively never falls.
    const low = Math.max(
      anchorScore,
      score -
        anchorScore *
          bandMarginFraction(
            daysAhead,
            BAND_LOWER_AT_REFERENCE,
            BAND_LOWER_EXPONENT,
          ),
    );

    return [ts, toOneDigit(low), toOneDigit(high)];
  });
}

/** Pushes a dashed extrapolation line plus its confidence band onto `options`.
 * `visible` is slaved to the parent score line's feature toggle. */
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
  visible: boolean,
): void {
  if (extrapolation === null) {
    return;
  }

  const data: number[][] = Array.isArray(extrapolation)
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
      color: config.color,
      data: band,
      visible,
    });
  }

  options.push({
    type: "line",
    id: config.lineId,
    name: config.name,
    color: config.color,
    data,
    dashed: true,
    visible,
  });
}

export function calculateSeries(
  season: Season,
  data: Dataset[],
  extrapolation: Extrapolation,
  extrapolationHistory: ScatterPoint[],
  overlays: readonly Overlay[],
  extrapolation100: Extrapolation = null,
): ChartSeries[] {
  const options: ChartSeries[] = [];

  // the score cutoff lines (+ their forward extrapolation) are now toggled
  // globally via the Features menu instead of the per-chart legend.
  const showScore = overlays.includes("score");
  const showScore100 = overlays.includes("score100");

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
      visible: showScore,
      data: data
        .filter((dataset) => !("faction" in dataset))
        .map((dataset) => {
          return [dataset.ts, dataset.score];
        }),
    });
  }

  pushExtrapolationSeries(
    options,
    extrapolation,
    {
      lineId: "extrapolation",
      bandId: "extrapolation-confidence",
      name: "Score Extrapolated",
      bandName: "Extrapolation Confidence",
      color: colors.extrapolation,
    },
    showScore,
  );

  if (
    overlays.includes("extrapolation") &&
    Array.isArray(extrapolationHistory) &&
    extrapolationHistory.length > 0
  ) {
    options.push({
      type: "scatter",
      id: "extrapolation-history",
      name: "Extrapolation History",
      color: colors.extrapolationHistory,
      visible: true,
      data: extrapolationHistory,
    });
  }

  if (data.some((dataset) => dataset.score100 !== null)) {
    options.push({
      type: "line",
      name: "Score 1%",
      id: "score100",
      color: colors.top1,
      visible: showScore100,
      data: data
        .filter((dataset) => dataset.score100 !== null)
        .map((dataset) => {
          return [dataset.ts, dataset.score100!];
        }),
    });

    pushExtrapolationSeries(
      options,
      extrapolation100,
      {
        lineId: "extrapolation-score100",
        bandId: "extrapolation-score100-confidence",
        name: "Score 1% Extrapolated",
        bandName: "Score 1% Confidence",
        color: colors.top1,
      },
      showScore100,
    );
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
  extrapolation: Extrapolation,
): PlotBand[] {
  const seasonStart = season.startDates[region];

  if (!seasonStart) {
    return [];
  }

  const seasonEnd = season.endDates[region];
  const { crossFactionSupport } = season;

  // bands run until the right edge of the graph, which the extrapolation can
  // push far into the future. For an ended season that means the season end;
  // otherwise the latest of now (+3 weeks of empty future weeks, as before),
  // the last data point and the extrapolation target.
  const extrapolationEnd = extrapolationEndTs(extrapolation);
  const lastDataTs = data.length > 0 ? data[data.length - 1].ts : seasonStart;
  const graphEnd = seasonEnd
    ? Math.max(seasonEnd, extrapolationEnd ?? 0)
    : Math.max(Date.now() + oneWeekInMs * 3, lastDataTs, extrapolationEnd ?? 0);

  const weeks = (graphEnd - seasonStart) / oneWeekInMs + 1;

  const now = Date.now();

  return Array.from({
    length: weeks,
  }).flatMap<PlotBand>((_, index) => {
    const options: PlotBand[] = [];

    const from = seasonStart + index * oneWeekInMs;
    const to = from + oneWeekInMs;
    const color = index % 2 === 0 ? "#4b5563" : "#1f2937";

    // the alternating week background. The future-week fade is encoded as a
    // trailing "50" alpha suffix that the uPlot adapter reads back.
    options.push({
      id: "background-color",
      from,
      to,
      color: from > now ? `${color}50` : color,
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
        text: text.join("<br>"),
      },
    });

    return options;
  });
}

export function calculateYAxisPlotLines(
  season: Season,
  region: Regions,
): PlotLine[] {
  const cutoffs = season.confirmedCutoffs[region];

  if ("alliance" in cutoffs && "horde" in cutoffs) {
    return [
      {
        label: {
          text: `Confirmed cutoff for Alliance at ${cutoffs.alliance}`,
          color: colors.alliance,
        },
        value: cutoffs.alliance,
      },
      {
        label: {
          text: `Confirmed cutoff for Horde at ${cutoffs.horde}`,
          color: colors.horde,
        },
        value: cutoffs.horde,
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
        color: colors.xFaction,
      },
      value: cutoffs.score,
    },
  ];
}

export function calculateXAxisPlotLines(
  season: Season,
  region: Regions,
  data: Dataset[],
  extrapolation: Extrapolation,
  overlays: readonly Overlay[],
  extrapolation100: Extrapolation = null,
): PlotLine[] {
  const endDate = season.endDates[region];
  const startDate = season.startDates[region];

  const lines: PlotLine[] = [];

  if (overlays.includes("patches")) {
    Object.entries(season.patches).forEach(([description, regionalData]) => {
      const timestamp = regionalData[region];

      lines.push({
        label: {
          text: description,
          y: 100,
          color: "orange",
        },
        value: timestamp,
        color: "orange",
      });
    });
  }

  if (overlays.includes("dungeonHotfixes")) {
    Object.entries(season.dungeonHotfixes).forEach(
      ([description, regionalData]) => {
        const timestamp = regionalData[region];

        lines.push({
          label: {
            text: description,
            y: 75,
            color: "yellow",
          },
          value: timestamp,
          color: "yellow",
        });
      },
    );
  }

  if (endDate) {
    lines.push({
      label: {
        text: "Season End",
        y: 225,
        color: "red",
      },
      value: endDate,
      color: "red",
    });
  }

  // since the score computation is partially season dependant, dont bother for older seasons
  if (
    (overlays.includes("levelCompletion") ||
      overlays.includes("levelCompletion100")) &&
    season.crossFactionSupport === "complete" &&
    (season.wcl?.zoneId ?? 0) >= 32 &&
    data.length > 0 &&
    startDate
  ) {
    const zoneId = season.wcl?.zoneId ?? 0;

    // One pass per enabled cutoff: the 0.1% (title) line in white and the top-1%
    // line in its own colour. Same level thresholds, each matched against its own
    // cutoff value + forward extrapolation.
    const passes: {
      scoreKey: ScoreKey;
      color: string;
      extrapolation: Extrapolation;
    }[] = [];

    if (overlays.includes("levelCompletion")) {
      passes.push({ scoreKey: "score", color: "white", extrapolation });
    }

    if (
      overlays.includes("levelCompletion100") &&
      data.some((dataset) => dataset.score100 !== null)
    ) {
      passes.push({
        scoreKey: "score100",
        color: colors.top1,
        extrapolation: extrapolation100,
      });
    }

    for (const { scoreKey, color, extrapolation: ex } of passes) {
      if (zoneId < 37) {
        lines.push(
          ...calcOldLevelCompletionLines(
            season,
            data,
            startDate,
            ex,
            scoreKey,
            color,
          ),
        );
      } else if (zoneId === 39) {
        lines.push(
          ...calcTwwS1LevelCompletionLines(
            season,
            data,
            startDate,
            ex,
            scoreKey,
            color,
          ),
        );
      } else if (zoneId >= 43) {
        lines.push(
          ...calcTwwS2LevelCompletionLines(
            season,
            data,
            startDate,
            ex,
            scoreKey,
            color,
          ),
        );
      }
    }
  }

  if (startDate) {
    // week markers run to the right edge of the graph too — the extrapolation
    // can push that past the season end / now into the future (e.g. W14).
    const extrapolationEnd = extrapolationEndTs(extrapolation);
    const end = Math.max(endDate ?? Date.now(), extrapolationEnd ?? 0);

    for (let i = startDate; i <= end; i += oneWeekInMs) {
      const weeksSinceStart = Math.round((i - startDate) / oneWeekInMs) + 1;

      lines.push({
        id: "week-number",
        label: {
          text: `W${weeksSinceStart}`,
          y: 15,
          color: "lightgreen",
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
          label: {
            // sit directly beneath the `W{n}` marker (y: 15) so the week reads
            // as "W14" / "4085.08" stacked, instead of pinned to the x-axis.
            text: `${match.score}`,
            y: 28,
            color: "lightgreen",
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
  const now = Date.now();
  const seasonEnding = season.endDates[region];
  const seasonEnded = seasonEnding !== null && seasonEnding <= now;

  const daysUntilSeasonEnding =
    seasonEnding !== null && !seasonEnded
      ? (seasonEnding - now) / 1000 / 60 / 60 / 24
      : null;

  const dataEnd =
    (Array.isArray(extrapolation)
      ? extrapolation[extrapolation.length - 1][0]
      : extrapolation?.to.ts) ?? data[data.length - 1].ts;

  // for a concluded season the last data point can sit slightly before the
  // season ending, which would push the "Season End" marker just outside the
  // viewport - include it, plus a little air so it isn't flush with the axis.
  const zoomEnd =
    seasonEnded && seasonEnding !== null
      ? Math.max(dataEnd, seasonEnding) + oneWeekInMs * 0.03
      : dataEnd;

  // concluded seasons keep the view they had on their final day instead of
  // zooming all the way out.
  const lateSeasonOffsetInWeeks = seasonEnded
    ? 1.5
    : daysUntilSeasonEnding === null
      ? null
      : daysUntilSeasonEnding < 3
        ? 1.02
        : daysUntilSeasonEnding < 7
          ? 2.5
          : daysUntilSeasonEnding < 14
            ? 3.5
            : null;

  if (lateSeasonOffsetInWeeks) {
    const backThen = [...data]
      .reverse()
      .find(
        (dataset) =>
          dataset.ts < zoomEnd - lateSeasonOffsetInWeeks * oneWeekInMs,
      );

    return [backThen ? backThen.ts : 0, zoomEnd];
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
  scoreKey: ScoreKey = "score",
  color = "white",
): PlotLine[] {
  const lines: PlotLine[] = [];
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

    let match: Omit<Dataset, "score100"> | undefined = data.find(
      (dataset) => scoreValue(dataset, scoreKey) >= total,
    );

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
          const scoreDiff = extrapolationMatch[1] - scoreValue(last, scoreKey);

          const step = scoreDiff / timeDiff;

          // expensive, but a lot more precise than just picking next match
          for (let i = 0; i <= timeDiff; i += 60_000) {
            if (scoreValue(last, scoreKey) + step * i >= total) {
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
        label: {
          text: `All ${level}`,
          y: 200,
          color,
        },
        value: match.ts,
        color,
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
  scoreKey: ScoreKey = "score",
  color = "white",
): PlotLine[] {
  const lines: PlotLine[] = [];
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

    let match: Omit<Dataset, "score100"> | undefined = data.find((dataset) => {
      if (dataset.ts - startDate < oneWeekInMs) {
        return scoreValue(dataset, scoreKey) >= total;
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
        const scoreDiff = extrapolationMatch[1] - scoreValue(last, scoreKey);

        const step = scoreDiff / timeDiff;

        // expensive, but a lot more precise than just picking next match
        for (let i = 0; i < timeDiff; i += 60_000) {
          if (scoreValue(last, scoreKey) + step * i > total) {
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
        label: {
          text: `All ${level}`,
          y: 200,
          color,
        },
        value: match.ts,
        color,
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
  scoreKey: ScoreKey = "score",
  color = "white",
): PlotLine[] {
  const lines: PlotLine[] = [];
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

    const match: Dataset | undefined = data.find((dataset) => {
      if (dataset.ts - startDate < oneWeekInMs) {
        return scoreValue(dataset, scoreKey) >= firstWeek;
      }

      return false;
    });

    if (match) {
      lines.push({
        label: {
          text: `All ${level}`,
          y: 200,
          color,
        },
        value: match.ts,
        color,
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

    let match: Omit<Dataset, "score100"> | undefined = data.find((dataset) => {
      return scoreValue(dataset, scoreKey) >= allDungeonsBothWeeks;
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
        const scoreDiff = extrapolationMatch[1] - scoreValue(last, scoreKey);

        const step = scoreDiff / timeDiff;

        // expensive, but a lot more precise than just picking next match
        for (let i = 0; i < timeDiff; i += 60_000) {
          if (scoreValue(last, scoreKey) + step * i > allDungeonsBothWeeks) {
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
        label: {
          text: `All ${level}`,
          y: 200,
          color,
        },
        value: match.ts,
        color,
      });
    }
  }

  return lines;
}
