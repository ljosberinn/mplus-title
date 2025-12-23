import clsx from "clsx";
import { type Options } from "highcharts";
import { ClientOnly } from "remix-utils/client-only";

import { type EnhancedSeason } from "~/seasons";

import { Highcharts, HighchartsReact } from "./Highcharts.client";
import { ReactNode } from "react";

type DungeonRecordsProps = {
  season: EnhancedSeason;
};

export default function DungeonRecords({
  season,
}: DungeonRecordsProps): ReactNode {
  const options: Options = {
    ...season.score.chartBlueprint,
    time: {
      timezoneOffset: new Date().getTimezoneOffset(),
    },
    series: season.records,
    legend: {
      symbolHeight: 0,
      symbolWidth: 0,
      symbolRadius: 0,
      itemMarginTop: 1,
      itemMarginBottom: 1,
      useHTML: true,
      itemStyle: {
        minWidth: "75px",
      },
      labelFormatter() {
        return `
                  <span style="color: #fff; display:flex; place-items: center; gap: 5px;">
                      ${"userOptions" in this && "iconUrl" in this.userOptions && typeof this.userOptions.iconUrl === "string" ? `<img src="${this.userOptions.iconUrl}" width="24" height="24" />` : ""}
                      ${this.name}
                  </span>
              `;
      },
    },
    yAxis: {
      ...season.score.chartBlueprint.yAxis,
      title: {
        ...(Array.isArray(season.score.chartBlueprint.yAxis)
          ? null
          : season.score.chartBlueprint.yAxis?.title),
        text: "Key Level",
      },
    },
  };

  return (
    <section
      className={clsx(
        "max-w-screen-2xl rounded-md bg-gray-700 transition-all duration-500 ease-linear motion-reduce:transition-none",
      )}
      aria-labelledby="title-dungeon-records"
      id="dungeon-records"
    >
      <h1 id="title-dungeon-records" className="text-center text-lg font-bold">
        Dungeon Records
      </h1>
      <div className="rounded-lg bg-gray-700 p-4">
        <div className="h-[39vh] lg:h-[30vh]">
          <ClientOnly fallback={null}>
            {() => (
              <HighchartsReact highcharts={Highcharts} options={options} />
            )}
          </ClientOnly>
        </div>
      </div>
    </section>
  );
}
