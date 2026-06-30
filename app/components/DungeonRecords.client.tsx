import clsx from "clsx";
import { lazy, type ReactNode, Suspense } from "react";

import { type EnhancedSeason } from "~/seasons";

const UplotDungeonRecords = lazy(
  () => import("../chart/UplotDungeonRecords.client"),
);

type DungeonRecordsProps = {
  season: EnhancedSeason;
};

export default function DungeonRecords({
  season,
}: DungeonRecordsProps): ReactNode {
  return (
    <section
      className={clsx(
        "max-w-screen-2xl border border-gray-600 bg-gray-700 transition-all duration-500 ease-linear motion-reduce:transition-none",
      )}
      aria-labelledby="title-dungeon-records"
      id="dungeon-records"
    >
      <h1 id="title-dungeon-records" className="text-center text-lg font-bold">
        Dungeon Records
      </h1>
      <div className="h-[39vh] lg:h-[30vh]">
        <Suspense fallback={null}>
          <UplotDungeonRecords season={season} />
        </Suspense>
      </div>
    </section>
  );
}
