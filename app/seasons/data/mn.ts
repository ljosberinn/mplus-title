import { defineSeason, NO_DATES, weeklyEnd, weeklyStart } from "../config";
import { type Season } from "../runtime";

export const mnSeasons: Season[] = [
  defineSeason({
    name: "MN S2",
    slug: "mn-season-2",
    expansion: "mn",
    rioKey: "season-mn-2",
    crossFactionSupport: "complete",
    startDates: weeklyStart("2026-08-18"),
    endDates: NO_DATES,
    affixes: [],
    dungeons: [
      { slug: "altar-of-fangs", name: "Altar of Fangs" },
      { slug: "den-of-nalorakk", name: "Den of Nalorakk" },
      { slug: "kings-rest", name: "Kings' Rest" },
      { slug: "murder-row", name: "Murder Row" },
      { slug: "ruby-life-pools", name: "Ruby Life Pools" },
      { slug: "temple-of-sethraliss", name: "Temple of Sethraliss" },
      { slug: "the-blinding-vale", name: "The Blinding Vale" },
      { slug: "voidscar-arena", name: "Voidscar Arena" },
    ],
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-55.png",
    startingPeriod: 0,
    wcl: {
      zoneId: 55,
      weekIndexToAffixSetId: [],
    },
    supportsExtrapolationHistory: true,
    annotations: [],
  }),
  defineSeason({
    name: "MN S1",
    slug: "mn-season-1",
    expansion: "mn",
    rioKey: "season-mn-1",
    crossFactionSupport: "complete",
    startDates: weeklyStart("2026-03-24"),
    endDates: weeklyEnd("2026-08-11", "reset"),
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
    cutoffs: {
      EU: {
        score: 4236,
        score100: 4008,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-umbral-champion-and-umbral-hero-scores-updated-4-august/625085/1",
      },
      US: {
        score: 4211,
        score100: 3960,
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-umbral-champion-and-umbral-hero-scores-updated-august-4/2333001/1",
      },
    },
  }),
];
