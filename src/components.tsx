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
import { red, blue, gray } from "tailwindcss/colors";

import type { Data, Dataset } from "./data";

const factionColors: Record<Factions, string> = {
  alliance: blue["400"],
  horde: red["400"],
};

type GraphProps = {
  data: Omit<Data, "confirmedCutoff" | "seasonEnding" | "seasonStart"> & {
    confirmedCutoff: Record<Factions, number> | null;
    seasonEnding: number | null;
    seasonStart: number;
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

const extrapolateByFaction = (
  data: Dataset[],
  type: "customScore" | "customRank",
  faction: Factions
):
  | {
      value: 0;
      timestamp: 0;
      connector: null;
    }
  | {
      value: number;
      timestamp: number;
      connector: Dataset;
    } => {
  const now = Date.now();
  const last = [...data]
    .reverse()
    .find((dataset) => dataset.timestamp <= now && dataset.faction === faction);

  if (!last) {
    return {
      value: 0,
      timestamp: 0,
      connector: null,
    };
  }

  const twoWeeksAgo = last.timestamp - 2 * 7 * 24 * 60 * 60 * 1000;
  const first = data.find(
    (dataset) => dataset.timestamp >= twoWeeksAgo && dataset.faction === faction
  );

  if (!first) {
    return {
      value: 0,
      timestamp: 0,
      connector: null,
    };
  }

  const timePassed = last.timestamp - first.timestamp;
  const daysPassed = timePassed / 1000 / 60 / 60 / 24;
  const twoWeeksInDays = 14;
  const factor = twoWeeksInDays / daysPassed;

  return {
    value: Math.round(last[type] + (last[type] - first[type]) * factor),
    timestamp: last.timestamp + twoWeeksInDays * 24 * 60 * 60 * 1000,
    connector: last,
  };
};

const convertExtrapoationToSeries = (
  dataset: ReturnType<typeof extrapolateByFaction>,
  type: "customScore" | "customRank",
  faction: Factions
): null | SeriesLineOptions => {
  if (dataset.value === 0 || !dataset.connector) {
    return null;
  }

  return {
    type: "line",
    name: `${type === "customRank" ? "Rank" : "Score"} Extrapolated: ${
      faction === "alliance" ? "Alliance" : "Horde"
    }`,
    color: factionColors[faction],
    data: [
      [dataset.connector.timestamp, dataset.connector[type]],
      [dataset.timestamp, dataset.value],
    ],
    visible: type === "customScore",
    dashStyle: "Dash",
    dataLabels: {
      formatter,
    },
  };
};

const affixes: Record<number, { name: string; icon: string }> = {
  2: { name: "Skittish", icon: "spell_magic_lesserinvisibilty" },
  3: { name: "Volcanic", icon: "spell_shaman_lavasurge" },
  4: { name: "Necrotic", icon: "spell_deathknight_necroticplague" },
  6: { name: "Raging", icon: "ability_warrior_focusedrage" },
  7: { name: "Bolstering", icon: "ability_warrior_battleshout" },
  8: { name: "Sanguine", icon: "spell_shadow_bloodboil" },
  9: { name: "Tyrannical", icon: "achievement_boss_archaedas" },
  10: { name: "Fortified", icon: "ability_toughness" },
  11: { name: "Bursting", icon: "ability_ironmaidens_whirlofblood" },
  12: { name: "Grievous", icon: "ability_backstab" },
  13: { name: "Explosive", icon: "spell_fire_felflamering_red" },
  14: { name: "Quaking", icon: "spell_nature_earthquake" },
  16: { name: "Infested", icon: "achievement_nazmir_boss_ghuun" },
  117: { name: "Reaping", icon: "ability_racial_embraceoftheloa_bwonsomdi" },
  119: { name: "Beguiling", icon: "spell_shadow_mindshear" },
  20: { name: "Awakened", icon: "trade_archaeology_nerubian_obelisk" },
  121: { name: "Prideful", icon: "spell_animarevendreth_buff" },
  122: { name: "Inspiring", icon: "spell_holy_prayerofspirit" },
  123: { name: "Spiteful", icon: "spell_holy_prayerofshadowprotection" },
  124: { name: "Storming", icon: "spell_nature_cyclone" },
  128: { name: "Tormented", icon: "spell_animamaw_orb" },
  129: { name: "Infernal", icon: "inv_infernalbrimstone" },
  130: { name: "Encrypted", icon: "spell_progenitor_orb" },
};
const extrapolate = (
  data: Dataset[],
  type: "customScore" | "customRank",
  seasonEnding: number | null
) => {
  // do not show extrapolation for seasons that have ended or are ending
  if (seasonEnding !== null) {
    return { horde: null, alliance: null };
  }

  const horde = extrapolateByFaction(data, type, "horde");
  const alliance = extrapolateByFaction(data, type, "alliance");

  return {
    horde: convertExtrapoationToSeries(horde, type, "horde"),
    alliance: convertExtrapoationToSeries(alliance, type, "alliance"),
  };
};

export function Graph({ data, title }: GraphProps): JSX.Element {
  const sanitizedScore = data.history.filter(
    (dataset) => dataset.customScore > 0
  );
  const sanitizedRank = data.history.filter(
    (dataset) => dataset.customRank > 0
  );

  const extrapolatedScore = extrapolate(
    sanitizedScore,
    "customScore",
    data.seasonEnding
  );
  const extrapolatedRank = extrapolate(
    sanitizedRank,
    "customRank",
    data.seasonEnding
  );

  const options: Options = {
    title: {
      text: title,
      style: {
        color: "#fff",
      },
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
      plotBands: data.affixRotation
        ? data.affixRotation.map<XAxisPlotBandsOptions>((rotation, index) => {
            const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

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
                    const { name, icon } = affixes[affix];
                    return `<img width="18" height="18" style="transform: rotate(-90deg); opacity: 0.75;" alt="${name}" src="https://keystone-heroes.com/static/icons/${icon}.jpg" loading="lazy" />`;
                  })
                  .join(""),
                rotation: 90,
                align: "left",
                x: 5,
                y: 5,
              },
            };
          })
        : undefined,
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
        text: "Rank",
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
      {
        type: "line",
        name: "Rank: Horde",
        color: factionColors.horde,
        data: sanitizedRank
          .filter((dataset) => dataset.faction === "horde")
          .map((dataset) => {
            return [dataset.timestamp, dataset.customRank];
          }),
        visible: false,
        dataLabels: {
          formatter,
        },
      },
      {
        type: "line",
        name: "Rank: Alliance",
        color: factionColors.alliance,
        data: sanitizedRank
          .filter((dataset) => dataset.faction === "alliance")
          .map((dataset) => {
            return [dataset.timestamp, dataset.customRank];
          }),
        visible: false,
        dataLabels: {
          formatter,
        },
      },
      {
        type: "line",
        name: "Score: Horde",
        color: factionColors.horde,
        data: sanitizedScore
          .filter((dataset) => dataset.faction === "horde")
          .map((dataset) => {
            return [dataset.timestamp, dataset.customScore];
          }),
        dataLabels: {
          formatter,
        },
      },
      {
        type: "line",
        name: "Score: Alliance",
        color: factionColors.alliance,
        data: sanitizedScore
          .filter((dataset) => dataset.faction === "alliance")
          .map((dataset) => {
            return [dataset.timestamp, dataset.customScore];
          }),
        dataLabels: {
          formatter,
        },
      },
      extrapolatedRank.alliance,
      extrapolatedRank.horde,
      extrapolatedScore.alliance,
      extrapolatedScore.horde,
    ].filter((series): series is SeriesLineOptions => series !== null),
  };

  return (
    <div className="p-4">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}
