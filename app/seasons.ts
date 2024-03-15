import { type Factions, type Regions } from "@prisma/client";
import { type XAxisPlotLinesOptions } from "highcharts";

import { type Overlay } from "~/utils";

import { Affix, getAffixIconUrl } from "./affixes";

type CutoffSource = { score: number; source: string | null };

const UNKNOWN_SEASON_START_OR_ENDING = null;

export type Season = {
  name: string;
  slug: string;
  startDates: Record<Regions, number | null>;
  endDates: Record<Regions, number | null>;
  confirmedCutoffs: Record<
    Regions,
    CutoffSource | ({ source: string | null } & Record<Factions, number>)
  >;
  affixes: [Affix, Affix, Affix, Affix][] | [Affix, Affix, Affix][];
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
  dungeons: number;
  startingPeriod: number | null;
};

export type EnhancedSeason = Season & {
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
  regionsToDisplay: Regions[];
  overlaysToDisplay: Overlay[];
};

export type Dataset = {
  ts: number;
  score: number;
  faction?: Factions;
  rank: number | null;
};

function offsetByRegion(timestamp: number, region: Regions): number {
  switch (region) {
    case "us": {
      return timestamp;
    }
    case "eu": {
      return timestamp + 46_800_000;
    }
    case "kr":
    case "tw": {
      return timestamp + 111_600_000;
    }
  }
}

export const seasons: Season[] = [
  {
    name: "DF S4",
    slug: "df-season-4",
    rioKey: "season-df-4",
    crossFactionSupport: "complete",
    startDates: {
      us: UNKNOWN_SEASON_START_OR_ENDING,
      eu: UNKNOWN_SEASON_START_OR_ENDING,
      kr: UNKNOWN_SEASON_START_OR_ENDING,
      tw: UNKNOWN_SEASON_START_OR_ENDING,
    },
    endDates: {
      us: UNKNOWN_SEASON_START_OR_ENDING,
      eu: UNKNOWN_SEASON_START_OR_ENDING,
      kr: UNKNOWN_SEASON_START_OR_ENDING,
      tw: UNKNOWN_SEASON_START_OR_ENDING,
    },
    affixes: [],
    confirmedCutoffs: {
      eu: { score: 0, source: null },
      us: { score: 0, source: null },
      kr: { score: 0, source: null },
      tw: { score: 0, source: null },
    },
    dungeonHotfixes: {},
    dungeons: 8,
    patches: {},
    seasonIcon:
      "https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg",
    startingPeriod: 0,
  },
  {
    name: "DF S3",
    slug: "df-season-3",
    rioKey: "season-df-3",
    crossFactionSupport: "complete",
    startDates: {
      us: offsetByRegion(1_699_974_000_000, "us"),
      eu: offsetByRegion(1_699_974_000_000, "eu"),
      kr: offsetByRegion(1_699_974_000_000, "kr"),
      tw: offsetByRegion(1_699_974_000_000, "tw"),
    },
    endDates: {
      us: UNKNOWN_SEASON_START_OR_ENDING,
      eu: UNKNOWN_SEASON_START_OR_ENDING,
      kr: UNKNOWN_SEASON_START_OR_ENDING,
      tw: UNKNOWN_SEASON_START_OR_ENDING,
    },
    confirmedCutoffs: {
      eu: { score: 0, source: null },
      us: { score: 0, source: null },
      kr: { score: 0, source: null },
      tw: { score: 0, source: null },
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
        us: offsetByRegion(
          1_699_974_000_000 + 2 * 7 * 24 * 60 * 60 * 1000,
          "us",
        ),
        eu: offsetByRegion(
          1_699_974_000_000 + 2 * 7 * 24 * 60 * 60 * 1000,
          "eu",
        ),
        kr: offsetByRegion(
          1_699_974_000_000 + 2 * 7 * 24 * 60 * 60 * 1000,
          "kr",
        ),
        tw: offsetByRegion(
          1_699_974_000_000 + 2 * 7 * 24 * 60 * 60 * 1000,
          "tw",
        ),
      },
      "WCM Thorns -35% hp": {
        us: offsetByRegion(
          1_699_974_000_000 + 7 * 7 * 24 * 60 * 60 * 1000,
          "us",
        ),
        eu: offsetByRegion(
          1_699_974_000_000 + 7 * 7 * 24 * 60 * 60 * 1000,
          "eu",
        ),
        kr: offsetByRegion(
          1_699_974_000_000 + 7 * 7 * 24 * 60 * 60 * 1000,
          "kr",
        ),
        tw: offsetByRegion(
          1_699_974_000_000 + 7 * 7 * 24 * 60 * 60 * 1000,
          "tw",
        ),
      },
      "Spec Tuning & Rise nerfs": {
        us: offsetByRegion(
          1_699_974_000_000 + 10 * 7 * 24 * 60 * 60 * 1000,
          "us",
        ),
        eu: offsetByRegion(
          1_699_974_000_000 + 10 * 7 * 24 * 60 * 60 * 1000,
          "eu",
        ),
        kr: offsetByRegion(
          1_699_974_000_000 + 10 * 7 * 24 * 60 * 60 * 1000,
          "kr",
        ),
        tw: offsetByRegion(
          1_699_974_000_000 + 10 * 7 * 24 * 60 * 60 * 1000,
          "tw",
        ),
      },
    },
    dungeons: 8,
    patches: {
      "10.2.5": {
        us: offsetByRegion(
          1_699_974_000_000 + 9 * 7 * 24 * 60 * 60 * 1000,
          "us",
        ),
        eu: offsetByRegion(
          1_699_974_000_000 + 9 * 7 * 24 * 60 * 60 * 1000,
          "eu",
        ),
        kr: offsetByRegion(
          1_699_974_000_000 + 9 * 7 * 24 * 60 * 60 * 1000,
          "kr",
        ),
        tw: offsetByRegion(
          1_699_974_000_000 + 9 * 7 * 24 * 60 * 60 * 1000,
          "tw",
        ),
      },
      "10.2.6": {
        us: offsetByRegion(
          1_699_974_000_000 + 18 * 7 * 24 * 60 * 60 * 1000,
          "us",
        ),
        eu: offsetByRegion(
          1_699_974_000_000 + 18 * 7 * 24 * 60 * 60 * 1000,
          "eu",
        ),
        kr: offsetByRegion(
          1_699_974_000_000 + 18 * 7 * 24 * 60 * 60 * 1000,
          "kr",
        ),
        tw: offsetByRegion(
          1_699_974_000_000 + 18 * 7 * 24 * 60 * 60 * 1000,
          "tw",
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
      us: offsetByRegion(1_683_644_400_000, "us"),
      eu: offsetByRegion(1_683_644_400_000, "eu"),
      kr: offsetByRegion(1_683_644_400_000, "kr"),
      tw: offsetByRegion(1_683_644_400_000, "tw"),
    },
    endDates: {
      us: offsetByRegion(1_699_336_800_000, "us"),
      eu: offsetByRegion(1_699_336_800_000, "eu"),
      kr: offsetByRegion(1_699_336_800_000, "kr"),
      tw: offsetByRegion(1_699_336_800_000, "tw"),
    },
    confirmedCutoffs: {
      eu: {
        score: 0,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-smoldering-hero-title-updated-november-2/474193",
      },
      us: {
        score: 0,
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-smoldering-hero-title-updated-november-2/1697884",
      },
      kr: { score: 0, source: null },
      tw: { score: 0, source: null },
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
        us: offsetByRegion(1_692_716_400_000, "us"),
        eu: offsetByRegion(1_692_716_400_000, "eu"),
        kr: offsetByRegion(1_692_716_400_000, "kr"),
        tw: offsetByRegion(1_692_716_400_000, "tw"),
      },
      "Larger Class Tuning": {
        us: offsetByRegion(1_691_506_800_000, "us"),
        eu: offsetByRegion(1_691_506_800_000, "eu"),
        kr: offsetByRegion(1_691_506_800_000, "kr"),
        tw: offsetByRegion(1_691_506_800_000, "tw"),
      },
      "Small Class Tuning": {
        us: offsetByRegion(1_690_297_200_000, "us"),
        eu: offsetByRegion(1_690_297_200_000, "eu"),
        kr: offsetByRegion(1_690_297_200_000, "kr"),
        tw: offsetByRegion(1_690_297_200_000, "tw"),
      },
      "Various Nerfs": {
        us: offsetByRegion(1_688_130_000_000, "us"),
        eu: offsetByRegion(1_688_130_000_000, "eu"),
        kr: offsetByRegion(1_688_130_000_000, "kr"),
        tw: offsetByRegion(1_688_130_000_000, "tw"),
      },
    },
    patches: {
      "10.1.5": {
        us: offsetByRegion(1_689_087_600_000, "us"),
        eu: offsetByRegion(1_689_087_600_000, "eu"),
        kr: offsetByRegion(1_689_087_600_000, "kr"),
        tw: offsetByRegion(1_689_087_600_000, "tw"),
      },
      "10.1.7": {
        us: offsetByRegion(1_693_926_000_000, "us"),
        eu: offsetByRegion(1_693_926_000_000, "eu"),
        kr: offsetByRegion(1_693_926_000_000, "kr"),
        tw: offsetByRegion(1_693_926_000_000, "tw"),
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
      us: offsetByRegion(1_670_943_600_000, "us"),
      eu: offsetByRegion(1_670_943_600_000, "eu"),
      kr: offsetByRegion(1_670_943_600_000, "kr"),
      tw: offsetByRegion(1_670_943_600_000, "tw"),
    },
    endDates: {
      us: offsetByRegion(1_683_007_200_000, "us"),
      eu: offsetByRegion(1_683_007_200_000, "eu"),
      kr: offsetByRegion(1_683_007_200_000, "kr"),
      tw: offsetByRegion(1_683_007_200_000, "tw"),
    },
    confirmedCutoffs: {
      eu: {
        score: 0,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-thundering-hero-title-updated-27-april/444828",
      },
      us: {
        score: 0,
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-thundering-hero-title-updated-april-27/1576546/1",
      },
      kr: { score: 0, source: null },
      tw: { score: 0, source: null },
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
        us: offsetByRegion(1_678_798_800_000, "us"),
        eu: offsetByRegion(1_678_798_800_000, "eu"),
        kr: offsetByRegion(1_678_798_800_000, "kr"),
        tw: offsetByRegion(1_678_798_800_000, "tw"),
      },
    },
    patches: {
      "10.0.7": {
        us: offsetByRegion(1_679_410_800_000, "us"),
        eu: offsetByRegion(1_679_410_800_000, "eu"),
        kr: offsetByRegion(1_679_410_800_000, "kr"),
        tw: offsetByRegion(1_679_410_800_000, "tw"),
      },
      "10.0.5": {
        us: offsetByRegion(1_675_177_200_000, "us"),
        eu: offsetByRegion(1_675_177_200_000, "eu"),
        kr: offsetByRegion(1_675_177_200_000, "kr"),
        tw: offsetByRegion(1_675_177_200_000, "tw"),
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
      us: offsetByRegion(1_659_452_400_000, "us"),
      eu: offsetByRegion(1_659_452_400_000, "eu"),
      kr: offsetByRegion(1_659_452_400_000, "kr"),
      tw: offsetByRegion(1_659_452_400_000, "tw"),
    },
    endDates: {
      us: offsetByRegion(1_666_710_000_000, "us"),
      eu: offsetByRegion(1_666_710_000_000, "eu"),
      kr: offsetByRegion(1_666_710_000_000, "kr"),
      tw: offsetByRegion(1_666_710_000_000, "tw"),
    },
    confirmedCutoffs: {
      eu: {
        score: 3120,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-shrouded-hero-title-november-16-update/395176/19",
      },
      us: {
        score: 3087,
        source:
          "https://www.bluetracker.gg/wow/topic/us-en/1374207-m-shrouded-hero-title-updated-november-16/",
      },
      kr: { score: 0, source: null },
      tw: { score: 0, source: null },
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
      us: offsetByRegion(1_646_146_800_000, "us"),
      eu: offsetByRegion(1_646_146_800_000, "eu"),
      kr: offsetByRegion(1_646_146_800_000, "kr"),
      tw: offsetByRegion(1_646_146_800_000, "tw"),
    },
    endDates: {
      us: offsetByRegion(1_659_452_400_000, "us"),
      eu: offsetByRegion(1_659_452_400_000, "eu"),
      kr: offsetByRegion(1_659_452_400_000, "kr"),
      tw: offsetByRegion(1_659_452_400_000, "tw"),
    },
    confirmedCutoffs: {
      eu: {
        score: 3725,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-cryptic-hero-title-score-updated-daily/371434",
      },
      us: { score: 0, source: null },
      kr: { score: 0, source: null },
      tw: { score: 0, source: null },
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
      us: offsetByRegion(1_625_583_600_000, "us"),
      eu: offsetByRegion(1_625_583_600_000, "eu"),
      kr: offsetByRegion(1_625_583_600_000, "kr"),
      tw: offsetByRegion(1_625_583_600_000, "tw"),
    },
    endDates: {
      us: offsetByRegion(1_645_542_000_000, "us"),
      eu: offsetByRegion(1_645_542_000_000, "eu"),
      kr: offsetByRegion(1_645_542_000_000, "kr"),
      tw: offsetByRegion(1_645_542_000_000, "tw"),
    },
    confirmedCutoffs: {
      eu: {
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-tormented-hero-title-score-updated-daily/341108",
        alliance: 2788,
        horde: 2875,
      },
      us: {
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-tormented-hero-title-score-updated-daily/1184111",
        alliance: 2768,
        horde: 2847,
      },
      kr: {
        source: null,
        alliance: 0,
        horde: 0,
      },
      tw: {
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

export const hasSeasonEndedForAllRegions = (slug: string): boolean => {
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
};

export const findSeasonByTimestamp = (
  timestamp = Date.now(),
): Season | null => {
  const season = seasons.find(
    (season) =>
      Object.values(season.startDates).some(
        (start) => start && timestamp >= start,
      ) &&
      Object.values(season.endDates).some(
        (end) => end === UNKNOWN_SEASON_START_OR_ENDING || end > timestamp,
      ),
  );

  return season ?? null;
};

export const findSeasonByName = (slug: string): Season | null => {
  if (slug === "latest") {
    const ongoingSeason = findSeasonByTimestamp();

    if (ongoingSeason) {
      return ongoingSeason;
    }

    const mostRecentlyStartedSeason = seasons.find(
      (season) =>
        season.startDates.us !== null && Date.now() >= season.startDates.us,
    );

    if (mostRecentlyStartedSeason) {
      return mostRecentlyStartedSeason;
    }
  }

  const match = seasons.find((season) => {
    return season.slug === slug;
  });

  return match ?? null;
};
