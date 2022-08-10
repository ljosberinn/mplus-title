import type { Factions } from "@prisma/client";
import type {
  Options,
  PointLabelObject,
  SeriesLineOptions,
  XAxisPlotBandsOptions,
  YAxisPlotLinesOptions,
} from "highcharts";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useEffect, useRef } from "react";
import { red, blue, gray } from "tailwindcss/colors";

import type { CrossFactionDataset, Data, LegacyDataset } from "./data";

const factionColors: Record<string, string> = {
  alliance: blue["400"],
  horde: red["400"],
  xFaction: "#B389AF",
};

type GraphProps = {
  data: Omit<
    Data,
    "confirmedCutoff" | "seasonEnding" | "seasonStart" | "bluePosts"
  > & {
    confirmedCutoff: Record<Factions, number> | null;
    seasonEnding: number | null;
    seasonStart: number;
    crossFactionData: { timestamp: number; score: number }[];
    bluePost: string;
  };
  title?: string;
};

const numberFormatParts = new Intl.NumberFormat().formatToParts(1234.5);

const createPlotline = (
  faction: string,
  cutoff: number
): YAxisPlotLinesOptions | null => {
  if (cutoff === 0) {
    return null;
  }

  return {
    label: {
      text: `Confirmed cutoff for ${
        faction === "alliance" ? "Alliance" : "Horde"
      } at ${cutoff}`,
      rotation: 0,
      style: {
        color:
          faction === "alliance" ? factionColors.alliance : factionColors.horde,
      },
    },
    value: cutoff,
    dashStyle: "Dash",
  };
};

const formatter = function (this: PointLabelObject) {
  const max = this.series.data.reduce(
    (acc, dataset) => (acc > dataset.x ? acc : dataset.x),
    0
  );

  return this.x === max ? this.y : null;
};

const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

const extrapolateBy = (
  data: GraphProps["data"]["crossFactionData"],
  seasonEnding: null | number
):
  | {
      value: 0;
      timestamp: 0;
      connector: null;
    }
  | {
      value: number;
      timestamp: number;
      connector:
        | LegacyDataset
        | (CrossFactionDataset & { timestamp: number; score: number });
    } => {
  if ((seasonEnding && Date.now() >= seasonEnding) || data.length === 0) {
    return {
      value: 0,
      timestamp: 0,
      connector: null,
    };
  }

  const last = data[data.length - 1];
  const then = last.timestamp - data[0].timestamp;

  const first = data.find((dataset) => dataset.timestamp >= then);

  if (!first) {
    return {
      value: 0,
      timestamp: 0,
      connector: null,
    };
  }

  const timePassed = last.timestamp - first.timestamp;
  const daysPassed = timePassed / 1000 / 60 / 60 / 24;

  if (daysPassed < 21) {
    return {
      value: 0,
      timestamp: 0,
      connector: null,
    };
  }

  const daysUntilSeasonEndingOrTwoWeeks = seasonEnding
    ? (seasonEnding - Date.now()) / 1000 / 60 / 60 / 24
    : 14;
  const factor = daysUntilSeasonEndingOrTwoWeeks / daysPassed;

  const value = Number.parseFloat(
    (last.score + (last.score - first.score) * factor).toFixed(1)
  );

  return {
    value,
    timestamp:
      seasonEnding ??
      last.timestamp + (daysUntilSeasonEndingOrTwoWeeks / 7) * oneWeekInMs,
    connector: last,
  };
};

const convertExtrapoationToSeries = (
  dataset: ReturnType<typeof extrapolateBy>,
  faction: Factions | null
): null | SeriesLineOptions => {
  if (dataset.value === 0 || !dataset.connector) {
    return null;
  }

  return {
    type: "line",
    name: `Score Extrapolated: ${
      faction ? (faction === "alliance" ? "Alliance" : "Horde") : "X-Faction"
    }`,
    color: `${faction ? factionColors[faction] : factionColors.xFaction}75`,
    data: [
      [dataset.connector.timestamp, dataset.connector.score],
      [dataset.timestamp, dataset.value],
    ],
    dashStyle: "Dash",
    dataLabels: {
      formatter,
    },
  };
};

const affixes: Record<number, { icon: string }> = {
  2: { /* name: "Skittish",*/ icon: "spell_magic_lesserinvisibilty" },
  3: { /* name: "Volcanic",*/ icon: "spell_shaman_lavasurge" },
  4: { /* name: "Necrotic",*/ icon: "spell_deathknight_necroticplague" },
  6: { /* name: "Raging",*/ icon: "ability_warrior_focusedrage" },
  7: { /* name: "Bolstering",*/ icon: "ability_warrior_battleshout" },
  8: { /* name: "Sanguine",*/ icon: "spell_shadow_bloodboil" },
  9: { /* name: "Tyrannical",*/ icon: "achievement_boss_archaedas" },
  10: { /* name: "Fortified",*/ icon: "ability_toughness" },
  11: { /* name: "Bursting",*/ icon: "ability_ironmaidens_whirlofblood" },
  12: { /* name: "Grievous",*/ icon: "ability_backstab" },
  13: { /* name: "Explosive",*/ icon: "spell_fire_felflamering_red" },
  14: { /* name: "Quaking",*/ icon: "spell_nature_earthquake" },
  16: { /* name: "Infested",*/ icon: "achievement_nazmir_boss_ghuun" },
  117: {
    /* name: "Reaping",*/ icon: "ability_racial_embraceoftheloa_bwonsomdi",
  },
  119: { /* name: "Beguiling",*/ icon: "spell_shadow_mindshear" },
  20: { /* name: "Awakened",*/ icon: "trade_archaeology_nerubian_obelisk" },
  121: { /* name: "Prideful",*/ icon: "spell_animarevendreth_buff" },
  122: { /* name: "Inspiring",*/ icon: "spell_holy_prayerofspirit" },
  123: { /* name: "Spiteful",*/ icon: "spell_holy_prayerofshadowprotection" },
  124: { /* name: "Storming",*/ icon: "spell_nature_cyclone" },
  128: { /* name: "Tormented",*/ icon: "spell_animamaw_orb" },
  129: { /* name: "Infernal",*/ icon: "inv_infernalbrimstone" },
  130: { /* name: "Encrypted",*/ icon: "spell_progenitor_orb" },
  131: { /* name: "Shrouded",*/ icon: "spell_shadow_nethercloak" },
};

// fun in a bun.
const findTimestampOfExtrapolation = (
  extrapolated: SeriesLineOptions | null
): number => {
  if (!extrapolated || !Array.isArray(extrapolated.data)) {
    return 0;
  }

  const maybeEnd = extrapolated.data[extrapolated.data.length - 1];

  if (!Array.isArray(maybeEnd) || typeof maybeEnd[0] !== "number") {
    return 0;
  }

  return maybeEnd[0];
};

const calculateExtremesToZoomTo = (
  history: LegacyDataset[],
  crossFactionHistory: CrossFactionDataset[] &
    {
      timestamp: number;
      score: number;
    }[],
  extrapolated: SeriesLineOptions | null,
  seasonEnding: number | null
): [number, number] => {
  const maybeEnd = findTimestampOfExtrapolation(extrapolated);

  const end = maybeEnd > 0 ? maybeEnd : history[history.length - 1].timestamp;

  const datasets =
    crossFactionHistory.length > 0 ? crossFactionHistory : history;

  if (seasonEnding) {
    const daysUntilEnd = (seasonEnding - Date.now()) / 1000 / 60 / 60 / 24;

    if (daysUntilEnd < 1) {
      const offset = 1.1 * 7 * 24 * 60 * 60 * 1000;

      const backThen = [...datasets]
        .reverse()
        .find((dataset) => dataset.timestamp < end - offset);

      return [backThen ? backThen.timestamp : 0, end];
    }

    if (daysUntilEnd < 7) {
      const offset = (extrapolated ? 3 : 2) * 7 * 24 * 60 * 60 * 1000;

      const backThen = [...datasets]
        .reverse()
        .find((dataset) => dataset.timestamp < end - offset);

      return [backThen ? backThen.timestamp : 0, end];
    }
  }

  // offset by +2 weeks since extrapolation is at least tw into the future
  const offset = (extrapolated ? 6 : 4) * 7 * 24 * 60 * 60 * 1000;

  const backThen = [...datasets]
    .reverse()
    .find((dataset) => dataset.timestamp < end - offset);

  return [backThen ? backThen.timestamp : 0, end];
};

const createPlotBands = (
  data: GraphProps["data"],
  { horde, alliance }: Record<Factions, LegacyDataset[]>
): XAxisPlotBandsOptions[] => {
  const sanitizedXFactionScore = data.crossFactionData.filter(
    (dataset) => dataset.score > 0
  );
  const sanitizedXFactionScoreReversed = [...sanitizedXFactionScore].reverse();
  const sanitizedScoreHordeReverse = [...horde].reverse();
  const sanitizedScoreAllianceReverse = [...alliance].reverse();

  return [
    ...(data.affixRotation
      ? data.affixRotation.map<XAxisPlotBandsOptions>((rotation, index) => {
          const start = data.seasonStart + index * oneWeekInMs;
          const end = start + oneWeekInMs;

          return {
            from: start,
            to: end,
            color: index % 2 === 0 ? gray["600"] : gray["800"],
            label: {
              useHTML: true,
              style: {
                display: "flex",
              },
              text: rotation
                .map((affix) => {
                  return `<img width="18" height="18" style="transform: rotate(-90deg); opacity: 0.75;" src="https://keystone-heroes.com/static/icons/${affixes[affix].icon}.jpg" />`;
                })
                .join(""),
              rotation: 90,
              align: "left",
              x: 5,
              y: 5,
            },
          };
        })
      : []),
    ...(data.affixRotation
      ? data.affixRotation
          .map<XAxisPlotBandsOptions | null>((_, index) => {
            const oneHourInMs = 60 * 60 * 1000;
            const start = data.seasonStart + index * oneWeekInMs - oneHourInMs;
            const end = start + oneWeekInMs + oneHourInMs;

            const xFactionStartMatch = sanitizedXFactionScore.find(
              (dataset) =>
                dataset.timestamp >= start && dataset.timestamp <= end
            );
            const xFactionEndMatch = sanitizedXFactionScoreReversed.find(
              (dataset) => dataset.timestamp < end && dataset.timestamp > start
            );

            const hordeStartMatch = horde.find(
              (dataset) =>
                dataset.timestamp >= start && dataset.timestamp <= end
            );
            const hordeEndMatch = sanitizedScoreHordeReverse.find(
              (dataset) => dataset.timestamp < end && dataset.timestamp > start
            );

            const allianceStartMatch = alliance.find(
              (dataset) =>
                dataset.timestamp >= start && dataset.timestamp <= end
            );
            const allianceEndMatch = sanitizedScoreAllianceReverse.find(
              (dataset) => dataset.timestamp < end && dataset.timestamp > start
            );

            if (
              !hordeStartMatch &&
              !hordeEndMatch &&
              !allianceEndMatch &&
              !allianceEndMatch &&
              xFactionEndMatch &&
              xFactionStartMatch
            ) {
              const isFirstElement =
                xFactionStartMatch.timestamp ===
                sanitizedXFactionScore[0].timestamp;
              const result =
                xFactionEndMatch.score -
                (isFirstElement ? 0 : xFactionStartMatch.score);

              if (result <= 0) {
                return null;
              }

              return {
                from: start + oneHourInMs,
                to: end,
                color: "transparent",
                label: {
                  verticalAlign: "bottom",
                  useHTML: true,
                  text: `<span style="font-size: 10px; color: ${
                    factionColors.xFaction
                  }">${result > 0 ? "+" : ""}${result.toFixed(1)}</span>`,
                  y: -15,
                },
              };
            }

            return {
              from: start + oneHourInMs,
              to: end,
              color: "transparent",
              label: {
                verticalAlign: "bottom",
                text: [
                  hordeEndMatch &&
                  hordeStartMatch &&
                  hordeEndMatch.score - hordeStartMatch.score !== 0
                    ? `<span style="font-size: 10px; color: ${
                        factionColors.horde
                      }">${
                        hordeEndMatch.score - hordeStartMatch.score > 0
                          ? "+"
                          : ""
                      }${(
                        hordeEndMatch.score -
                        (hordeStartMatch.timestamp === horde[0].timestamp
                          ? 0
                          : hordeStartMatch.score)
                      ).toFixed(1)}</span>`
                    : null,
                  allianceEndMatch &&
                  allianceStartMatch &&
                  allianceEndMatch.score - allianceStartMatch.score !== 0
                    ? `<span style="font-size: 10px; color: ${
                        factionColors.alliance
                      }">${
                        allianceEndMatch.score - allianceStartMatch.score > 0
                          ? "+"
                          : ""
                      }${(
                        allianceEndMatch.score -
                        (allianceStartMatch.timestamp === alliance[0].timestamp
                          ? 0
                          : allianceStartMatch.score)
                      ).toFixed(1)}</span>`
                    : null,
                  xFactionStartMatch &&
                  xFactionEndMatch &&
                  xFactionEndMatch.score - xFactionStartMatch.score > 0
                    ? `<span style="font-size: 10px; color: ${
                        factionColors.xFaction
                      }">${
                        xFactionEndMatch.score - xFactionStartMatch.score > 0
                          ? "+"
                          : ""
                      }${(
                        xFactionEndMatch.score - xFactionStartMatch.score
                      ).toFixed(1)}</span>`
                    : null,
                ]
                  .filter(Boolean)
                  .join("<br />"),
                useHTML: true,
                y: xFactionStartMatch && xFactionEndMatch ? -45 : -25,
              },
            };
          })
          .filter(
            (dataset): dataset is XAxisPlotBandsOptions => dataset !== null
          )
      : []),
  ];
};

const createOptions = (
  data: GraphProps["data"],
  title: GraphProps["title"],
  xFactionExtrapolation: SeriesLineOptions | null
): Options => {
  const sanitizedScore = data.history.filter((dataset) => dataset.score > 0);

  const sanitizedScoreHorde = sanitizedScore.filter(
    (dataset) => dataset.faction === "horde"
  );
  const sanitizedScoreAlliance = sanitizedScore.filter(
    (dataset) => dataset.faction === "alliance"
  );

  const allianceExtrapolation =
    data.crossFactionData.length > 0
      ? null
      : convertExtrapoationToSeries(
          extrapolateBy(sanitizedScoreAlliance, data.seasonEnding),
          "alliance"
        );
  const hordeExtrapolation =
    data.crossFactionData.length > 0
      ? null
      : convertExtrapoationToSeries(
          extrapolateBy(sanitizedScoreHorde, data.seasonEnding),
          "horde"
        );

  const plotBands = createPlotBands(data, {
    horde: sanitizedScoreHorde,
    alliance: sanitizedScoreAlliance,
  });

  return {
    accessibility: {
      enabled: true,
    },
    time: {
      timezoneOffset: -120,
    },
    title: {
      text:
        data.bluePost && title
          ? `<a target="_blank" style="text-decoration: underline;" href="${data.bluePost}">${title} (click for daily updated bluepost)</a>`
          : title,
      style: {
        color: "#fff",
      },
      useHTML: true,
    },
    chart: {
      backgroundColor: gray["700"],
      borderRadius: 4,
      zoomType: "x",
      resetZoomButton: {
        position: {
          verticalAlign: "middle",
        },
      },
    },
    lang: {
      thousandsSep:
        numberFormatParts.find((i) => i.type === "group")?.value ?? ",",
      decimalPoint:
        numberFormatParts.find((i) => i.type === "decimal")?.value ?? ".",
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
        text: "Day",
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
      plotBands,
      plotLines: data.seasonEnding
        ? [
            {
              label: {
                text: `Season End`,
                rotation: 0,
                style: {
                  color: "#fff",
                },
              },
              value: data.seasonEnding,
              dashStyle: "Dash",
            },
          ]
        : undefined,
    },
    yAxis: {
      title: {
        text: "Score",
        style: {
          color: "#fff",
        },
      },
      labels: {
        style: {
          color: "#fff",
          fontWeight: "normal",
        },
      },
      plotLines: data.confirmedCutoff
        ? [
            createPlotline("alliance", data.confirmedCutoff.alliance),
            createPlotline("horde", data.confirmedCutoff.horde),
          ].filter(
            (dataset): dataset is YAxisPlotLinesOptions => dataset !== null
          )
        : undefined,
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
    series: [
      sanitizedScoreHorde.length > 0
        ? {
            type: "line",
            name: "Score: Horde",
            color: factionColors.horde,
            data: sanitizedScoreHorde.map((dataset) => {
              return [dataset.timestamp, dataset.score];
            }),
            dataLabels: {
              formatter,
            },
          }
        : null,
      sanitizedScoreAlliance.length > 0
        ? {
            type: "line",
            name: "Score: Alliance",
            color: factionColors.alliance,
            data: sanitizedScoreAlliance.map((dataset) => {
              return [dataset.timestamp, dataset.score];
            }),
            dataLabels: {
              formatter,
            },
          }
        : null,
      data.crossFactionData.length > 0
        ? {
            type: "line",
            name: "Score: X-Faction",
            color: factionColors.xFaction,
            data: data.crossFactionData.map((dataset) => [
              dataset.timestamp,
              dataset.score,
            ]),
            dataLabels: {
              formatter,
            },
          }
        : null,
      hordeExtrapolation,
      allianceExtrapolation,
      xFactionExtrapolation,
    ].filter((series): series is SeriesLineOptions => series !== null),
  };
};

export function Graph({ data, title }: GraphProps): JSX.Element {
  const ref = useRef<HighchartsReact.RefObject | null>(null);

  const xFactionExtrapolation = convertExtrapoationToSeries(
    extrapolateBy(data.crossFactionData, data.seasonEnding),
    null
  );

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    if (!xFactionExtrapolation) {
      ref.current.chart.zoomOut();

      return;
    }

    const [start, end] = calculateExtremesToZoomTo(
      data.history,
      data.crossFactionData,
      xFactionExtrapolation,
      data.seasonEnding
    );

    if (start === 0 || end === 0) {
      return;
    }

    ref.current.chart.xAxis[0].setExtremes(start, end);
    ref.current.chart.showResetZoom();
  }, [data, xFactionExtrapolation]);

  if (data.crossFactionData.length === 0 && data.history.length === 0) {
    return (
      <div className="p-4 bg-gray-700 rounded-lg">
        <h2>
          No data yet in <b>{title}</b>, give it a couple hours.
        </h2>
      </div>
    );
  }

  const options = createOptions(data, title, xFactionExtrapolation);

  return (
    <HighchartsReact highcharts={Highcharts} options={options} ref={ref} />
  );
}
