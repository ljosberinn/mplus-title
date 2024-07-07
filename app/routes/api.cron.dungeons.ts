import { Regions } from "@prisma/client";
import { json } from "@remix-run/node";
import { type ActionFunction } from "@remix-run/server-runtime";

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

  if (typeof season.dungeons === "number" || season.dungeons.length === 0) {
    throw new TypeError("Season has no dungeon information");
  }

  const data = await Promise.all(
    season.dungeons.map<Promise<Record>>(async (dungeon) => {
      const url = createEndpointUrl(season.rioKey, dungeon.slug);

      try {
        const response = await fetch(url);
        const json = await response.json();

        if (json.rankings.length === 0) {
          return { slug: dungeon.slug, keyLevel: 0, timestamp: 0 };
        }

        return {
          slug: dungeon.slug,
          keyLevel: json.rankings[0].run.mythic_level,
          timestamp: Math.round(
            new Date(json.rankings[0].run.completed_at).getTime() / 1000,
          ),
        };
      } catch {
        return { slug: dungeon.slug, keyLevel: 0, timestamp: 0 };
      }
    }),
  );

  const filtered = data.filter((dataset) => dataset.keyLevel > 0);

  if (filtered.length === 0) {
    return json([], 204);
  }

  const inserted = await Promise.all(
    filtered.map(async (dataset) => {
      const latest = await prisma.dungeonHistory.findFirst({
        where: { slug: dataset.slug },
        orderBy: { timestamp: "desc" },
      });

      if (!latest || dataset.keyLevel > latest.keyLevel) {
        await prisma.dungeonHistory.create({
          data: {
            slug: dataset.slug,
            keyLevel: dataset.keyLevel,
            timestamp: dataset.timestamp,
          },
        });

        return dataset;
      }

      return null;
    }),
  );

  return json({ added: inserted.filter(Boolean) });
};
