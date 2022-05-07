import type { Factions } from "@prisma/client";
import type {
  Options,
  PointLabelObject,
  YAxisPlotLinesOptions,
} from "highcharts";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { red, blue, gray } from "tailwindcss/colors";

import type { Data } from "./data";

const factionColors: Record<Factions, string> = {
  alliance: blue["400"],
  horde: red["400"],
};

type GraphProps = {
  data: Omit<Data, "confirmedCutoff"> & {
    confirmedCutoff: Record<Factions, number>;
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

export function Graph({ data, title }: GraphProps): JSX.Element {
  const sanitizedScore = data.history.filter(
    (dataset) => dataset.customScore > 0
  );
  const sanitizedRank = data.history.filter(
    (dataset) => dataset.customRank > 0
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
    ],
  };

  return (
    <div className="p-4 ">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}
