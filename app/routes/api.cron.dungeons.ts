import { json } from "@remix-run/node";
import { type ActionFunction } from "@remix-run/server-runtime";
import { Regions } from "prisma/generated/prisma/enums";

import { protectCronRoute } from "~/load.server";
import { prisma } from "~/prisma.server";

import { findSeasonByName } from "../seasons";

function createEndpointUrl(season: string, slug: string): string {
  return `https://raider.io/api/v1/mythic-plus/runs?season=${season}&region=world&dungeon=${slug}&page=0`;
}

type Record = {
  slug: string;
  keyLevel: number;
  timestamp: number;
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return json([], 404);
  }

  const failed = await protectCronRoute(request);

  if (failed) {
    return json(failed.payload, failed.status);
  }

  const season = findSeasonByName("latest", [Regions.US]);

  if (!season) {
    throw new Error("Could not determine latest season.");
  }

  const americanStartDate = season.startDates.US;

  if (!americanStartDate) {
    throw new Error("Could not determine season start date.");
  }

  if (typeof season.dungeons === "number" || season.dungeons.length === 0) {
    throw new TypeError("Season has no dungeon information");
  }

  const newDatasets = await Promise.all(
    season.dungeons.map<Promise<Record | null>>(async (dungeon) => {
      const url = createEndpointUrl(season.rioKey, dungeon.slug);

      try {
        const response = await fetch(url);
        const json = await response.json();

        if (json.rankings.length === 0) {
          return null;
        }

        const { mythic_level: keyLevel, completed_at } = json.rankings[0].run;

        const latest = await prisma.dungeonHistory.findFirst({
          where: {
            slug: dungeon.slug,
            timestamp: { gt: Math.floor(americanStartDate / 1000) },
          },
          orderBy: { keyLevel: "desc" },
          select: {
            keyLevel: true,
          },
        });

        if (!latest || keyLevel > latest.keyLevel) {
          const timestamp = Math.round(new Date(completed_at).getTime() / 1000);

          const data = {
            slug: dungeon.slug,
            keyLevel,
            timestamp,
          };

          await prisma.dungeonHistory.create({
            data,
          });

          return data;
        }

        return null;
      } catch (error) {
        console.error(
          dungeon.slug,
          url,
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    }),
  );

  return json({ added: newDatasets.filter(Boolean) });
};
