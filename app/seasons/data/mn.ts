import { defineSeason, NO_DATES, weeklyStart } from "../config";
import { type Season } from "../runtime";

export const mnSeasons: Season[] = [
  defineSeason({
    name: "MN S1",
    slug: "mn-season-1",
    expansion: "mn",
    rioKey: "season-mn-1",
    crossFactionSupport: "complete",
    startDates: weeklyStart("2026-03-24"),
    endDates: NO_DATES,
    affixes: [],
    annotations: [
      { kind: "hotfix", label: "Academy to 30 min", week: 2 },
      { kind: "patch", label: "12.0.5", week: 4 },
      { kind: "hotfix", label: "Academy to 31 min", week: 5 },
      { kind: "hotfix", label: "Turbo Boost", week: 7 },
      { kind: "patch", label: "12.0.7", week: 12 },
    ],
    dungeons: [
      { slug: "algethar-academy", name: "Algeth'ar Academy" },
      { slug: "magisters-terrace", name: "Magister's Terrace" },
      { slug: "maisara-caverns", name: "Maisara Caverns" },
      { slug: "nexuspoint-xenas", name: "Nexus-Point Xenas" },
      { slug: "pit-of-saron", name: "Pit of Saron" },
      { slug: "seat-of-the-triumvirate", name: "Seat of the Triumvirate" },
      { slug: "skyreach", name: "Skyreach" },
      { slug: "windrunner-spire", name: "Windrunner Spire" },
    ],
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-47.png",
    startingPeriod: 1056,
    wcl: { zoneId: 47, weekIndexToAffixSetId: [] },
    supportsExtrapolationHistory: true,
  }),
];
