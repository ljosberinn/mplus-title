import { type Factions, type Regions } from "@prisma/client";
import {
  type Options,
  type SeriesLineOptions,
  type XAxisPlotBandsOptions,
  type XAxisPlotLinesOptions,
  type YAxisPlotLinesOptions,
} from "highcharts";

import { type Overlay } from "~/utils";

import { Affix, getAffixIconUrl } from "./affixes";

type CutoffSource = { score: number; source: string | null };

const UNKNOWN_SEASON_START_OR_ENDING = null;

export type Dungeon = {
  name: string;
  slug: string;
};

export type Season = {
  name: string;
  slug: string;
  startDates: Record<Regions, number | null>;
  endDates: Record<Regions, number | null>;
  confirmedCutoffs: Record<
    Regions,
    CutoffSource | ({ source: string | null } & Record<Factions, number>)
  >;
  affixes:
    | [Affix, Affix, Affix, Affix][]
    | [Affix, Affix, Affix][]
    | [Affix, Affix][];
  rioKey: string;
  crossFactionSupport: "complete" | "none" | "partial";
  wcl?: {
    zoneId: number;
    partition?: number;
    weekIndexToAffixSetId: (number | null)[];
  };
  seasonIcon: string;
  dungeonHotfixes: Record<string, Record<Regions, number>>;
  patches: Record<string, Record<Regions, number>>;
  dungeons: number | Dungeon[];
  startingPeriod: number | null;
};

export type DungeonRecord = {
  slug: string;
  timestamp: number;
  keyLevel: number;
};

export type EnhancedSeason = Season & {
  score: {
    dataByRegion: Record<Regions, Dataset[]>;
    extrapolation: Record<
      Regions,
      | null
      | [number, number][]
      | {
          from: Omit<Dataset, "rank">;
          to: Omit<Dataset, "rank">;
        }
    >;
    initialZoom: Record<Regions, null | [number, number]>;
    xAxisPlotLines: Record<Regions, XAxisPlotLinesOptions[]>;
    xAxisPlotBands: Record<Regions, XAxisPlotBandsOptions[]>;
    yAxisPlotLines: Record<Regions, YAxisPlotLinesOptions[]>;
    regionsToDisplay: Regions[];
    overlaysToDisplay: Overlay[];
    series: Record<Regions, SeriesLineOptions[]>;
    chartBlueprint: Options;
  };
  records: SeriesLineOptions[];
};

export type Dataset = {
  ts: number;
  score: number;
  faction?: Factions;
  rank: number | null;
};

function offsetStartDateForRegion(timestamp: number, region: Regions): number {
  switch (region) {
    case "US": {
      return timestamp;
    }
    case "EU": {
      return timestamp + 46_800_000;
    }
    case "KR":
    case "TW":
    case "CN": {
      return timestamp + 111_600_000;
    }
  }
}

function offsetEndDateForRegion(timestamp: number, region: Regions): number {
  switch (region) {
    case "US": {
      return timestamp;
    }
    case "EU": {
      return timestamp + 61_200_000;
    }
    case "KR":
    case "TW":
    case "CN": {
      return timestamp + 129_600_000;
    }
  }
}

const oneWeekInMilliseconds = 7 * 24 * 60 * 60 * 1000;

export const seasons: Season[] = [
  {
    name: "TWW S2",
    slug: "tww-season-2",
    rioKey: "season-tww-2",
    crossFactionSupport: "complete",
    startDates: {
      US: new Date("2025-03-04T15:00:00Z").getTime(),
      EU: new Date("2025-03-05T04:00:00Z").getTime(),
      CN: new Date("2025-03-05T23:00:00Z").getTime(),
      TW: new Date("2025-03-05T23:00:00Z").getTime(),
      KR: new Date("2025-03-05T23:00:00Z").getTime(),
    },
    endDates: {
      US: null,
      EU: null,
      KR: null,
      TW: null,
      CN: null,
    },
    affixes: [],
    confirmedCutoffs: {
      EU: {
        score: 0,
        source: null,
      },
      US: {
        score: 0,
        source: null,
      },
      KR: { score: 0, source: null },
      TW: { score: 0, source: null },
      CN: { score: 0, source: null },
    },
    dungeonHotfixes: {
      "Dungeon Tuning": {
        US: 1741377600000,
        EU: 1741377600000,
        KR: 1741377600000,
        TW: 1741377600000,
        CN: 1741377600000,
      },
      "More Dungeon Tuning": {
        US: 1742360400000,
        EU: 1742360400000,
        KR: 1742360400000,
        TW: 1742360400000,
        CN: 1742360400000,
      },
    },
    dungeons: [
      {
        name: "Cinderbrew Meadery",
        slug: "cinderbrew-meadery",
      },
      {
        name: "Darkflame Cleft",
        slug: "darkflame-cleft",
      },
      {
        name: "Operation: Floodgate",
        slug: "operation-floodgate",
      },
      {
        name: "Operation: Mechagon - Workshop",
        slug: "operation-mechagon-workshop",
      },
      {
        name: "Priory of the Sacred Flame",
        slug: "priory-of-the-sacred-flame",
      },
      {
        name: "The MOTHERLODE!!",
        slug: "the-motherlode",
      },
      {
        name: "The Rookery",
        slug: "the-rookery",
      },
      {
        name: "Theater of Pain",
        slug: "theater-of-pain",
      },
    ],
    patches: {},
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-43.png",
    startingPeriod: 0,
    wcl: {
      weekIndexToAffixSetId: [],
      zoneId: 43,
    },
  },
  {
    name: "TWW S1",
    slug: "tww-season-1",
    rioKey: "season-tww-1",
    crossFactionSupport: "complete",
    startDates: {
      US: 1_726_585_200_000,
      EU: 1_726_632_000_000,
      KR: 1_726_700_400_000,
      TW: 1_726_700_400_000,
      CN: 1_726_700_400_000,
    },
    endDates: {
      US: new Date("2025-03-04T15:00:00Z").getTime() - oneWeekInMilliseconds,
      EU: new Date("2025-03-05T04:00:00Z").getTime() - oneWeekInMilliseconds,
      TW: new Date("2025-03-05T23:00:00Z").getTime() - oneWeekInMilliseconds,
      KR: new Date("2025-03-05T23:00:00Z").getTime() - oneWeekInMilliseconds,
      CN: new Date("2025-03-05T23:00:00Z").getTime() - oneWeekInMilliseconds,
    },
    affixes: [
      [Affix.BargainAscendant, Affix.Fortified],
      [Affix.BargainOblivion, Affix.Fortified],
      [Affix.BargainVoidbound, Affix.Fortified],
      [Affix.BargainDevour, Affix.Fortified],
      [Affix.BargainOblivion, Affix.Tyrannical],
      [Affix.BargainAscendant, Affix.Tyrannical],
      [Affix.BargainDevour, Affix.Tyrannical],
      [Affix.BargainVoidbound, Affix.Tyrannical],
    ],
    confirmedCutoffs: {
      EU: {
        score: 3483,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-thundering-hero-title-updated-19-february/562387",
      },
      US: {
        score: 3458,
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-thundering-hero-title-updated-february-19/2062504/1",
      },
      KR: { score: 0, source: null },
      TW: { score: 0, source: null },
      CN: { score: 0, source: null },
    },
    dungeonHotfixes: {
      "Dungeon Tuning": {
        US: offsetStartDateForRegion(1727794800000, "US"),
        EU: offsetStartDateForRegion(1727794800000, "EU"),
        KR: offsetStartDateForRegion(1727794800000, "KR"),
        TW: offsetStartDateForRegion(1727794800000, "TW"),
        CN: offsetStartDateForRegion(1727794800000, "CN"),
      },
      "Xal'atath's Guile Nerf": {
        US: 1728594316832,
        EU: 1728594316832,
        KR: 1728594316832,
        CN: 1728594316832,
        TW: 1728594316832,
      },
      "NW/SV Nerf": {
        US: offsetStartDateForRegion(1729004400000, "US"),
        EU: offsetStartDateForRegion(1729004400000, "EU"),
        KR: offsetStartDateForRegion(1729004400000, "KR"),
        TW: offsetStartDateForRegion(1729004400000, "TW"),
        CN: offsetStartDateForRegion(1729004400000, "CN"),
      },
      Tuning: {
        US: offsetStartDateForRegion(1730210400000, "US"),
        EU: offsetStartDateForRegion(1730210400000, "EU"),
        KR: offsetStartDateForRegion(1730210400000, "KR"),
        TW: offsetStartDateForRegion(1730210400000, "TW"),
        CN: offsetStartDateForRegion(1730210400000, "CN"),
      },
      "More Tuning": {
        US: offsetStartDateForRegion(1734447600000, "US"),
        EU: offsetStartDateForRegion(1734447600000, "EU"),
        KR: offsetStartDateForRegion(1734444000000 + 60 * 60 * 1000, "KR"),
        TW: offsetStartDateForRegion(1734444000000 + 60 * 60 * 1000, "TW"),
        CN: offsetStartDateForRegion(1734444000000 + 60 * 60 * 1000, "CN"),
      },
    },
    dungeons: [
      {
        name: "Ara-Kara, City of Echoes",
        slug: "arakara-city-of-echoes",
      },
      {
        name: "City of Threads",
        slug: "city-of-threads",
      },
      {
        name: "Grim Batol",
        slug: "grim-batol",
      },
      {
        name: "Mists of Tirna Scithe",
        slug: "mists-of-tirna-scithe",
      },
      {
        name: "Siege of Boralus",
        slug: "siege-of-boralus",
      },
      {
        name: "The Dawnbreaker",
        slug: "the-dawnbreaker",
      },
      {
        name: "The Necrotic Wake",
        slug: "the-necrotic-wake",
      },
      {
        name: "The Stonevault",
        slug: "the-stonevault",
      },
    ],
    patches: {
      "11.0.5": {
        US: offsetStartDateForRegion(1729605600000, "US"),
        EU: offsetStartDateForRegion(1729605600000, "EU"),
        KR: offsetStartDateForRegion(1729605600000, "KR"),
        TW: offsetStartDateForRegion(1729605600000, "TW"),
        CN: offsetStartDateForRegion(1729605600000, "CN"),
      },
      "11.0.7": {
        US: offsetStartDateForRegion(1734447600000, "US"),
        EU: offsetStartDateForRegion(1734447600000, "EU"),
        KR: offsetStartDateForRegion(1734444000000 + 60 * 60 * 1000, "KR"),
        TW: offsetStartDateForRegion(1734444000000 + 60 * 60 * 1000, "TW"),
        CN: offsetStartDateForRegion(1734444000000 + 60 * 60 * 1000, "CN"),
      },
    },
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-39.png",
    startingPeriod: 977,
    wcl: {
      zoneId: 39,
      weekIndexToAffixSetId: [],
    },
  },
  {
    name: "DF S4",
    slug: "df-season-4",
    rioKey: "season-df-4",
    crossFactionSupport: "complete",
    startDates: {
      US: offsetStartDateForRegion(1_713_884_400_000, "US"),
      EU: offsetStartDateForRegion(1_713_884_400_000, "EU"),
      KR: offsetStartDateForRegion(1_713_884_400_000, "KR"),
      TW: offsetStartDateForRegion(1_713_884_400_000, "TW"),
      CN: offsetStartDateForRegion(1_713_884_400_000, "CN"),
    },
    endDates: {
      US: offsetStartDateForRegion(1_721_746_800_000, "US"),
      EU: offsetStartDateForRegion(1_721_746_800_000, "EU"),
      KR: offsetStartDateForRegion(1_721_746_800_000, "KR"),
      TW: offsetStartDateForRegion(1_721_746_800_000, "TW"),
      CN: offsetStartDateForRegion(1_721_746_800_000, "CN"),
    },
    affixes: [
      [Affix.Tyrannical, Affix.Storming, Affix.Raging],
      [Affix.Fortified, Affix.Entangling, Affix.Bolstering],
      [Affix.Tyrannical, Affix.Incorporeal, Affix.Spiteful],
      [Affix.Fortified, Affix.Afflicted, Affix.Raging],
      [Affix.Tyrannical, Affix.Volcanic, Affix.Sanguine],
      [Affix.Fortified, Affix.Storming, Affix.Bursting],
      [Affix.Tyrannical, Affix.Afflicted, Affix.Bolstering],
      [Affix.Fortified, Affix.Incorporeal, Affix.Sanguine],
      [Affix.Tyrannical, Affix.Entangling, Affix.Bursting],
      [Affix.Fortified, Affix.Volcanic, Affix.Spiteful],
    ],
    confirmedCutoffs: {
      EU: { score: 0, source: null },
      US: { score: 0, source: null },
      KR: { score: 0, source: null },
      TW: { score: 0, source: null },
      CN: { score: 0, source: null },
    },
    dungeonHotfixes: {},
    dungeons: [
      { name: "The Azure Vault", slug: "the-azure-vault" },
      { name: "Algeth'ar Academy", slug: "algethar-academy" },
      {
        name: "The Nokhud Offensive",

        slug: "the-nokhud-offensive",
      },
      {
        name: "Halls of Infusion",

        slug: "halls-of-infusion",
      },
      { name: "Ruby Life Pools", slug: "ruby-life-pools" },
      {
        name: "Brackenhide Hollow",

        slug: "brackenhide-hollow",
      },
      { name: "Neltharus", slug: "neltharus" },
      {
        name: "Uldaman: Legacy of Tyr",

        slug: "uldaman-legacy-of-tyr",
      },
    ],
    patches: {},
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-37.png",
    startingPeriod: 956,
    wcl: {
      zoneId: 37,
      weekIndexToAffixSetId: [706, 762, 765, 767, 769, 419, 771, 775, 785, 502],
    },
  },
  {
    name: "DF S3",
    slug: "df-season-3",
    rioKey: "season-df-3",
    crossFactionSupport: "complete",
    startDates: {
      US: offsetStartDateForRegion(1_699_974_000_000, "US"),
      EU: offsetStartDateForRegion(1_699_974_000_000, "EU"),
      KR: offsetStartDateForRegion(1_699_974_000_000, "KR"),
      TW: offsetStartDateForRegion(1_699_974_000_000, "TW"),
      CN: offsetStartDateForRegion(1_699_974_000_000, "CN"),
    },
    endDates: {
      US: offsetEndDateForRegion(1_713_848_400_000, "US"),
      EU: offsetEndDateForRegion(1_713_848_400_000, "EU"),
      KR: offsetEndDateForRegion(1_713_848_400_000, "KR"),
      TW: offsetEndDateForRegion(1_713_848_400_000, "TW"),
      CN: offsetEndDateForRegion(1_713_848_400_000, "CN"),
    },
    confirmedCutoffs: {
      EU: {
        score: 3719,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-dreaming-hero-title-updated-16-april/507523",
      },
      US: {
        score: 3684,
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-dreaming-hero-title-updated-april-16/1831618",
      },
      KR: { score: 0, source: null },
      TW: { score: 0, source: null },
      CN: { score: 0, source: null },
    },
    affixes: [
      [Affix.Fortified, Affix.Incorporeal, Affix.Sanguine],
      [Affix.Tyrannical, Affix.Entangling, Affix.Bursting],
      [Affix.Fortified, Affix.Volcanic, Affix.Spiteful],
      [Affix.Tyrannical, Affix.Storming, Affix.Raging],
      [Affix.Fortified, Affix.Entangling, Affix.Bolstering],
      [Affix.Tyrannical, Affix.Incorporeal, Affix.Spiteful],
      [Affix.Fortified, Affix.Afflicted, Affix.Raging],
      [Affix.Tyrannical, Affix.Volcanic, Affix.Sanguine],
      [Affix.Fortified, Affix.Storming, Affix.Bursting],
      [Affix.Tyrannical, Affix.Afflicted, Affix.Bolstering],
    ],
    wcl: {
      zoneId: 36,
      weekIndexToAffixSetId: [775, 785, 502, 706, 762, 765, 767, 769, 419, 771],
    },
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-36.png",
    dungeonHotfixes: {
      "Rise +1 min": {
        US: offsetStartDateForRegion(
          1_699_974_000_000 + 2 * 7 * 24 * 60 * 60 * 1000,
          "US",
        ),
        EU: offsetStartDateForRegion(
          1_699_974_000_000 + 2 * 7 * 24 * 60 * 60 * 1000,
          "EU",
        ),
        KR: offsetStartDateForRegion(
          1_699_974_000_000 + 2 * 7 * 24 * 60 * 60 * 1000,
          "KR",
        ),
        TW: offsetStartDateForRegion(
          1_699_974_000_000 + 2 * 7 * 24 * 60 * 60 * 1000,
          "TW",
        ),
        CN: offsetStartDateForRegion(
          1_699_974_000_000 + 2 * 7 * 24 * 60 * 60 * 1000,
          "CN",
        ),
      },
      "WCM Thorns -35% hp": {
        US: offsetStartDateForRegion(
          1_699_974_000_000 + 7 * 7 * 24 * 60 * 60 * 1000,
          "US",
        ),
        EU: offsetStartDateForRegion(
          1_699_974_000_000 + 7 * 7 * 24 * 60 * 60 * 1000,
          "EU",
        ),
        KR: offsetStartDateForRegion(
          1_699_974_000_000 + 7 * 7 * 24 * 60 * 60 * 1000,
          "KR",
        ),
        TW: offsetStartDateForRegion(
          1_699_974_000_000 + 7 * 7 * 24 * 60 * 60 * 1000,
          "TW",
        ),
        CN: offsetStartDateForRegion(
          1_699_974_000_000 + 7 * 7 * 24 * 60 * 60 * 1000,
          "CN",
        ),
      },
      "Spec Tuning & Rise nerfs": {
        US: offsetStartDateForRegion(
          1_699_974_000_000 + 10 * 7 * 24 * 60 * 60 * 1000,
          "US",
        ),
        EU: offsetStartDateForRegion(
          1_699_974_000_000 + 10 * 7 * 24 * 60 * 60 * 1000,
          "EU",
        ),
        KR: offsetStartDateForRegion(
          1_699_974_000_000 + 10 * 7 * 24 * 60 * 60 * 1000,
          "KR",
        ),
        TW: offsetStartDateForRegion(
          1_699_974_000_000 + 10 * 7 * 24 * 60 * 60 * 1000,
          "TW",
        ),
        CN: offsetStartDateForRegion(
          1_699_974_000_000 + 10 * 7 * 24 * 60 * 60 * 1000,
          "CN",
        ),
      },
    },
    dungeons: 8,
    patches: {
      "10.2.5": {
        US: offsetStartDateForRegion(
          1_699_974_000_000 + 9 * 7 * 24 * 60 * 60 * 1000,
          "US",
        ),
        EU: offsetStartDateForRegion(
          1_699_974_000_000 + 9 * 7 * 24 * 60 * 60 * 1000,
          "EU",
        ),
        KR: offsetStartDateForRegion(
          1_699_974_000_000 + 9 * 7 * 24 * 60 * 60 * 1000,
          "KR",
        ),
        TW: offsetStartDateForRegion(
          1_699_974_000_000 + 9 * 7 * 24 * 60 * 60 * 1000,
          "TW",
        ),
        CN: offsetStartDateForRegion(
          1_699_974_000_000 + 9 * 7 * 24 * 60 * 60 * 1000,
          "CN",
        ),
      },
      "10.2.6": {
        US: offsetStartDateForRegion(
          1_699_974_000_000 + 18 * 7 * 24 * 60 * 60 * 1000,
          "US",
        ),
        EU: offsetStartDateForRegion(
          1_699_974_000_000 + 18 * 7 * 24 * 60 * 60 * 1000,
          "EU",
        ),
        KR: offsetStartDateForRegion(
          1_699_974_000_000 + 18 * 7 * 24 * 60 * 60 * 1000,
          "KR",
        ),
        TW: offsetStartDateForRegion(
          1_699_974_000_000 + 18 * 7 * 24 * 60 * 60 * 1000,
          "TW",
        ),
        CN: offsetStartDateForRegion(
          1_699_974_000_000 + 18 * 7 * 24 * 60 * 60 * 1000,
          "CN",
        ),
      },
    },
    startingPeriod: 933,
  },
  {
    name: "DF S2",
    slug: "df-season-2",
    rioKey: "season-df-2",
    crossFactionSupport: "complete",
    startDates: {
      US: offsetStartDateForRegion(1_683_644_400_000, "US"),
      EU: offsetStartDateForRegion(1_683_644_400_000, "EU"),
      KR: offsetStartDateForRegion(1_683_644_400_000, "KR"),
      TW: offsetStartDateForRegion(1_683_644_400_000, "TW"),
      CN: offsetStartDateForRegion(1_683_644_400_000, "CN"),
    },
    endDates: {
      US: offsetStartDateForRegion(1_699_336_800_000, "US"),
      EU: offsetStartDateForRegion(1_699_336_800_000, "EU"),
      KR: offsetStartDateForRegion(1_699_336_800_000, "KR"),
      TW: offsetStartDateForRegion(1_699_336_800_000, "TW"),
      CN: offsetStartDateForRegion(1_699_336_800_000, "CN"),
    },
    confirmedCutoffs: {
      EU: {
        score: 0,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-smoldering-hero-title-updated-november-2/474193",
      },
      US: {
        score: 0,
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-smoldering-hero-title-updated-november-2/1697884",
      },
      KR: { score: 0, source: null },
      TW: { score: 0, source: null },
      CN: { score: 0, source: null },
    },
    affixes: [
      [Affix.Tyrannical, Affix.Storming, Affix.Raging],
      [Affix.Fortified, Affix.Entangling, Affix.Bolstering],
      [Affix.Tyrannical, Affix.Incorporeal, Affix.Spiteful],
      [Affix.Fortified, Affix.Afflicted, Affix.Raging],
      [Affix.Tyrannical, Affix.Volcanic, Affix.Sanguine],
      [Affix.Fortified, Affix.Storming, Affix.Bursting],
      [Affix.Tyrannical, Affix.Afflicted, Affix.Bolstering],
      [Affix.Fortified, Affix.Incorporeal, Affix.Sanguine],
      [Affix.Tyrannical, Affix.Entangling, Affix.Bursting],
      [Affix.Fortified, Affix.Volcanic, Affix.Spiteful],
    ],
    wcl: {
      zoneId: 34,
      weekIndexToAffixSetId: [706, 762, 765, 767, 769, 419, 771, 775, 785, 502],
    },
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-34.png",
    dungeonHotfixes: {
      "Scaling Adjustment": {
        US: offsetStartDateForRegion(1_692_716_400_000, "US"),
        EU: offsetStartDateForRegion(1_692_716_400_000, "EU"),
        KR: offsetStartDateForRegion(1_692_716_400_000, "KR"),
        TW: offsetStartDateForRegion(1_692_716_400_000, "TW"),
        CN: offsetStartDateForRegion(1_692_716_400_000, "CN"),
      },
      "Larger Class Tuning": {
        US: offsetStartDateForRegion(1_691_506_800_000, "US"),
        EU: offsetStartDateForRegion(1_691_506_800_000, "EU"),
        KR: offsetStartDateForRegion(1_691_506_800_000, "KR"),
        TW: offsetStartDateForRegion(1_691_506_800_000, "TW"),
        CN: offsetStartDateForRegion(1_691_506_800_000, "CN"),
      },
      "Small Class Tuning": {
        US: offsetStartDateForRegion(1_690_297_200_000, "US"),
        EU: offsetStartDateForRegion(1_690_297_200_000, "EU"),
        KR: offsetStartDateForRegion(1_690_297_200_000, "KR"),
        TW: offsetStartDateForRegion(1_690_297_200_000, "TW"),
        CN: offsetStartDateForRegion(1_690_297_200_000, "CN"),
      },
      "Various Nerfs": {
        US: offsetStartDateForRegion(1_688_130_000_000, "US"),
        EU: offsetStartDateForRegion(1_688_130_000_000, "EU"),
        KR: offsetStartDateForRegion(1_688_130_000_000, "KR"),
        TW: offsetStartDateForRegion(1_688_130_000_000, "TW"),
        CN: offsetStartDateForRegion(1_688_130_000_000, "CN"),
      },
    },
    patches: {
      "10.1.5": {
        US: offsetStartDateForRegion(1_689_087_600_000, "US"),
        EU: offsetStartDateForRegion(1_689_087_600_000, "EU"),
        KR: offsetStartDateForRegion(1_689_087_600_000, "KR"),
        TW: offsetStartDateForRegion(1_689_087_600_000, "TW"),
        CN: offsetStartDateForRegion(1_689_087_600_000, "CN"),
      },
      "10.1.7": {
        US: offsetStartDateForRegion(1_693_926_000_000, "US"),
        EU: offsetStartDateForRegion(1_693_926_000_000, "EU"),
        KR: offsetStartDateForRegion(1_693_926_000_000, "KR"),
        TW: offsetStartDateForRegion(1_693_926_000_000, "TW"),
        CN: offsetStartDateForRegion(1_693_926_000_000, "CN"),
      },
    },
    dungeons: 8,
    startingPeriod: 906,
  },
  {
    name: "DF S1",
    slug: "df-season-1",
    rioKey: "season-df-1",
    crossFactionSupport: "complete",
    startDates: {
      US: offsetStartDateForRegion(1_670_943_600_000, "US"),
      EU: offsetStartDateForRegion(1_670_943_600_000, "EU"),
      KR: offsetStartDateForRegion(1_670_943_600_000, "KR"),
      TW: offsetStartDateForRegion(1_670_943_600_000, "TW"),
      CN: offsetStartDateForRegion(1_670_943_600_000, "CN"),
    },
    endDates: {
      US: offsetStartDateForRegion(1_683_007_200_000, "US"),
      EU: offsetStartDateForRegion(1_683_007_200_000, "EU"),
      KR: offsetStartDateForRegion(1_683_007_200_000, "KR"),
      TW: offsetStartDateForRegion(1_683_007_200_000, "TW"),
      CN: offsetStartDateForRegion(1_683_007_200_000, "CN"),
    },
    confirmedCutoffs: {
      EU: {
        score: 0,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-thundering-hero-title-updated-27-april/444828",
      },
      US: {
        score: 0,
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-thundering-hero-title-updated-april-27/1576546/1",
      },
      KR: { score: 0, source: null },
      TW: { score: 0, source: null },
      CN: { score: 0, source: null },
    },
    affixes: [
      [Affix.Fortified, Affix.Raging, Affix.Quaking, Affix.Thundering],
      [Affix.Tyrannical, Affix.Bursting, Affix.Grievous, Affix.Thundering],
      [Affix.Fortified, Affix.Sanguine, Affix.Volcanic, Affix.Thundering],
      [Affix.Tyrannical, Affix.Raging, Affix.Storming, Affix.Thundering],
      [Affix.Fortified, Affix.Spiteful, Affix.Grievous, Affix.Thundering],
      [Affix.Tyrannical, Affix.Sanguine, Affix.Explosive, Affix.Thundering],
      [Affix.Fortified, Affix.Bolstering, Affix.Storming, Affix.Thundering],
      [Affix.Tyrannical, Affix.Spiteful, Affix.Quaking, Affix.Thundering],
      [Affix.Fortified, Affix.Bursting, Affix.Explosive, Affix.Thundering],
      [Affix.Tyrannical, Affix.Bolstering, Affix.Volcanic, Affix.Thundering],
    ],
    wcl: {
      zoneId: 32,
      weekIndexToAffixSetId: [702, 703, 705, 707, 708, 715, 723, 727, 712, 733],
    },
    seasonIcon: getAffixIconUrl(Affix.Thundering),
    dungeonHotfixes: {
      "Azure Vault +1.5 Minutes": {
        US: offsetStartDateForRegion(1_678_798_800_000, "US"),
        EU: offsetStartDateForRegion(1_678_798_800_000, "EU"),
        KR: offsetStartDateForRegion(1_678_798_800_000, "KR"),
        TW: offsetStartDateForRegion(1_678_798_800_000, "TW"),
        CN: offsetStartDateForRegion(1_678_798_800_000, "CN"),
      },
    },
    patches: {
      "10.0.7": {
        US: offsetStartDateForRegion(1_679_410_800_000, "US"),
        EU: offsetStartDateForRegion(1_679_410_800_000, "EU"),
        KR: offsetStartDateForRegion(1_679_410_800_000, "KR"),
        TW: offsetStartDateForRegion(1_679_410_800_000, "TW"),
        CN: offsetStartDateForRegion(1_679_410_800_000, "CN"),
      },
      "10.0.5": {
        US: offsetStartDateForRegion(1_675_177_200_000, "US"),
        EU: offsetStartDateForRegion(1_675_177_200_000, "EU"),
        KR: offsetStartDateForRegion(1_675_177_200_000, "KR"),
        TW: offsetStartDateForRegion(1_675_177_200_000, "TW"),
        CN: offsetStartDateForRegion(1_675_177_200_000, "CN"),
      },
    },
    dungeons: 8,
    startingPeriod: 885,
  },
  {
    name: "SL S4",
    slug: "sl-season-4",
    rioKey: "season-sl-4",
    crossFactionSupport: "complete",
    startDates: {
      US: offsetStartDateForRegion(1_659_452_400_000, "US"),
      EU: offsetStartDateForRegion(1_659_452_400_000, "EU"),
      KR: offsetStartDateForRegion(1_659_452_400_000, "KR"),
      TW: offsetStartDateForRegion(1_659_452_400_000, "TW"),
      CN: offsetStartDateForRegion(1_659_452_400_000, "CN"),
    },
    endDates: {
      US: offsetStartDateForRegion(1_666_710_000_000, "US"),
      EU: offsetStartDateForRegion(1_666_710_000_000, "EU"),
      KR: offsetStartDateForRegion(1_666_710_000_000, "KR"),
      TW: offsetStartDateForRegion(1_666_710_000_000, "TW"),
      CN: offsetStartDateForRegion(1_666_710_000_000, "CN"),
    },
    confirmedCutoffs: {
      EU: {
        score: 3120,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-shrouded-hero-title-november-16-update/395176/19",
      },
      US: {
        score: 3087,
        source:
          "https://www.bluetracker.gg/wow/topic/us-en/1374207-m-shrouded-hero-title-updated-november-16/",
      },
      KR: { score: 0, source: null },
      TW: { score: 0, source: null },
      CN: { score: 0, source: null },
    },
    affixes: [
      [Affix.Tyrannical, Affix.Inspiring, Affix.Quaking, Affix.Shrouded],
      [Affix.Fortified, Affix.Sanguine, Affix.Grievous, Affix.Shrouded],
      [Affix.Tyrannical, Affix.Bolstering, Affix.Explosive, Affix.Shrouded],
      [Affix.Fortified, Affix.Bursting, Affix.Storming, Affix.Shrouded],
      [Affix.Tyrannical, Affix.Raging, Affix.Volcanic, Affix.Shrouded],
      [Affix.Fortified, Affix.Inspiring, Affix.Grievous, Affix.Shrouded],
      [Affix.Tyrannical, Affix.Spiteful, Affix.Necrotic, Affix.Shrouded],
      [Affix.Fortified, Affix.Bolstering, Affix.Quaking, Affix.Shrouded],
      [Affix.Tyrannical, Affix.Sanguine, Affix.Storming, Affix.Shrouded],
      [Affix.Fortified, Affix.Raging, Affix.Explosive, Affix.Shrouded],
      [Affix.Tyrannical, Affix.Bursting, Affix.Volcanic, Affix.Shrouded],
      [Affix.Fortified, Affix.Spiteful, Affix.Necrotic, Affix.Shrouded],
    ],
    wcl: {
      zoneId: 30,
      weekIndexToAffixSetId: [
        673, 666, 686, 671, 670, 694, 667, 684, 668, 665, 683, 672,
      ],
    },
    seasonIcon: getAffixIconUrl(Affix.Shrouded),
    dungeonHotfixes: {},
    patches: {},
    dungeons: 8,
    startingPeriod: 866,
  },
  {
    name: "SL S3",
    slug: "sl-season-3",
    rioKey: "season-sl-3",
    crossFactionSupport: "partial",
    startDates: {
      US: offsetStartDateForRegion(1_646_146_800_000, "US"),
      EU: offsetStartDateForRegion(1_646_146_800_000, "EU"),
      KR: offsetStartDateForRegion(1_646_146_800_000, "KR"),
      TW: offsetStartDateForRegion(1_659_452_400_000, "TW"),
      CN: offsetStartDateForRegion(1_646_146_800_000, "CN"),
    },
    endDates: {
      US: offsetStartDateForRegion(1_659_452_400_000, "US"),
      EU: offsetStartDateForRegion(1_659_452_400_000, "EU"),
      KR: offsetStartDateForRegion(1_659_452_400_000, "KR"),
      TW: offsetStartDateForRegion(1_659_452_400_000, "TW"),
      CN: offsetStartDateForRegion(1_659_452_400_000, "CN"),
    },
    confirmedCutoffs: {
      EU: {
        score: 3725,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-cryptic-hero-title-score-updated-daily/371434",
      },
      US: { score: 0, source: null },
      KR: { score: 0, source: null },
      TW: { score: 0, source: null },
      CN: { score: 0, source: null },
    },
    affixes: [
      [Affix.Tyrannical, Affix.Bolstering, Affix.Explosive, Affix.Encrypted],
      [Affix.Fortified, Affix.Bursting, Affix.Storming, Affix.Encrypted],
      [Affix.Tyrannical, Affix.Raging, Affix.Volcanic, Affix.Encrypted],
      [Affix.Fortified, Affix.Inspiring, Affix.Grievous, Affix.Encrypted],
      [Affix.Tyrannical, Affix.Spiteful, Affix.Necrotic, Affix.Encrypted],
      [Affix.Fortified, Affix.Bolstering, Affix.Quaking, Affix.Encrypted],
      [Affix.Tyrannical, Affix.Sanguine, Affix.Storming, Affix.Encrypted],
      [Affix.Fortified, Affix.Raging, Affix.Explosive, Affix.Encrypted],
      [Affix.Tyrannical, Affix.Bursting, Affix.Volcanic, Affix.Encrypted],
      [Affix.Fortified, Affix.Spiteful, Affix.Necrotic, Affix.Encrypted],
      [Affix.Tyrannical, Affix.Inspiring, Affix.Quaking, Affix.Encrypted],
      [Affix.Fortified, Affix.Sanguine, Affix.Grievous, Affix.Encrypted],
    ],
    wcl: {
      zoneId: 25,
      partition: 3,
      weekIndexToAffixSetId: [
        630, 631, 632, 636, 641, 648, 622, 656, 619, 655, 628, 657,
      ],
    },
    seasonIcon: getAffixIconUrl(Affix.Encrypted),
    dungeonHotfixes: {},
    patches: {},
    dungeons: 10,
    startingPeriod: 844,
  },
  {
    name: "SL S2",
    slug: "sl-season-2",
    rioKey: "season-sl-2",
    crossFactionSupport: "none",
    startDates: {
      US: offsetStartDateForRegion(1_625_583_600_000, "US"),
      EU: offsetStartDateForRegion(1_625_583_600_000, "EU"),
      KR: offsetStartDateForRegion(1_625_583_600_000, "KR"),
      TW: offsetStartDateForRegion(1_625_583_600_000, "TW"),
      CN: offsetStartDateForRegion(1_625_583_600_000, "CN"),
    },
    endDates: {
      US: offsetStartDateForRegion(1_645_542_000_000, "US"),
      EU: offsetStartDateForRegion(1_645_542_000_000, "EU"),
      KR: offsetStartDateForRegion(1_645_542_000_000, "KR"),
      TW: offsetStartDateForRegion(1_645_542_000_000, "TW"),
      CN: offsetStartDateForRegion(1_645_542_000_000, "CN"),
    },
    confirmedCutoffs: {
      EU: {
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-tormented-hero-title-score-updated-daily/341108",
        alliance: 2788,
        horde: 2875,
      },
      US: {
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-tormented-hero-title-score-updated-daily/1184111",
        alliance: 2768,
        horde: 2847,
      },
      KR: {
        source: null,
        alliance: 0,
        horde: 0,
      },
      TW: {
        source: null,
        alliance: 0,
        horde: 0,
      },
      CN: {
        source: null,
        alliance: 0,
        horde: 0,
      },
    },
    affixes: [
      [Affix.Tyrannical, Affix.Bursting, Affix.Volcanic, Affix.Tormented],
      [Affix.Fortified, Affix.Inspiring, Affix.Grievous, Affix.Tormented],
      [Affix.Tyrannical, Affix.Spiteful, Affix.Necrotic, Affix.Tormented],
      [Affix.Fortified, Affix.Bolstering, Affix.Quaking, Affix.Tormented],
      [Affix.Tyrannical, Affix.Sanguine, Affix.Storming, Affix.Tormented],
      [Affix.Fortified, Affix.Raging, Affix.Explosive, Affix.Tormented],
      [Affix.Tyrannical, Affix.Bursting, Affix.Volcanic, Affix.Tormented],
      [Affix.Fortified, Affix.Necrotic, Affix.Grievous, Affix.Tormented],
      [Affix.Tyrannical, Affix.Inspiring, Affix.Quaking, Affix.Tormented],
      [Affix.Fortified, Affix.Sanguine, Affix.Necrotic, Affix.Tormented],
      [Affix.Tyrannical, Affix.Bolstering, Affix.Explosive, Affix.Tormented],
      [Affix.Fortified, Affix.Bursting, Affix.Storming, Affix.Tormented],
    ],
    seasonIcon: getAffixIconUrl(Affix.Tormented),
    dungeonHotfixes: {},
    patches: {},
    // data is technically available but since tracking for this season started mid-season, its offset by x weeks and I cba
    // wcl: {
    //   zoneId: 25,
    //   partition: 2,
    //   weekIndexToAffixSetId: [
    //     543, 544, 546, 548, 550, 553, 564, 568, 573, 576, 577, 570,
    //   ],
    // },
    dungeons: 8,
    startingPeriod: null,
  },
];

export function hasSeasonEndedForAllRegions(slug: string): boolean {
  const season = seasons.find((season) => season.slug === slug);

  if (!season) {
    return true;
  }

  const endDates = Object.values(season.endDates);

  if (endDates.includes(UNKNOWN_SEASON_START_OR_ENDING)) {
    return false;
  }

  const now = Date.now();

  return endDates.every((date) => now >= (date ?? 0));
}

export function findSeasonByTimestamp(
  regions: Regions[] | null = null,
  timestamp = Date.now(),
): Season | null {
  const season = seasons.find((season) => {
    if (regions) {
      return regions.some((region) => {
        const startDate = season.startDates[region];

        return startDate && startDate < timestamp;
      });
    }

    return (
      Object.values(season.startDates).some(
        (start) => start && timestamp >= start,
      ) &&
      Object.values(season.endDates).some(
        (end) => end === UNKNOWN_SEASON_START_OR_ENDING || end > timestamp,
      )
    );
  });

  return season ?? null;
}

export function findSeasonByName(
  slug: string,
  regions: Regions[] | null,
): Season | null {
  if (slug === "latest") {
    const ongoingSeason = findSeasonByTimestamp(regions);

    if (ongoingSeason) {
      return ongoingSeason;
    }

    const mostRecentlyStartedSeason = seasons.find(
      (season) =>
        season.startDates.US !== null && Date.now() >= season.startDates.US,
    );

    if (mostRecentlyStartedSeason) {
      return mostRecentlyStartedSeason;
    }
  }

  const match = seasons.find((season) => {
    return season.slug === slug;
  });

  return match ?? null;
}
