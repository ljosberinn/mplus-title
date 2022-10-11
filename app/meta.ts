import type { Factions, Regions } from "@prisma/client";

export const orderedRegionsBySize: Regions[] = ["eu", "us", "tw", "kr"];
const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

export const seasonStartDates: Record<string, Record<Regions, number>> = {
  'df-season-1': {
    us: 1_670_943_600_000,
    eu: 1_671_001_200_000,
    kr: 1_671_058_800_000,
    tw: 1_671_058_800_000,
  },
  "sl-season-4": {
    us: 1_659_452_400_000,
    eu: 1_659_495_600_000,
    kr: 1_659_564_000_000,
    tw: 1_659_564_000_000,
  },
  "sl-season-3": {
    us: 1_646_146_800_000,
    eu: 1_646_190_000_000,
    kr: 1_646_258_400_000,
    tw: 1_646_258_400_000,
  },
  "sl-season-2": {
    us: 1_625_583_600_000,
    eu: 1_625_626_800_000,
    kr: 1_625_695_200_000,
    tw: 1_625_695_200_000,
  },
};

export const crossFactionSupportDates: Record<Regions, number> = {
  // eslint-disable-next-line sonarjs/no-duplicate-string
  eu: seasonStartDates["sl-season-3"].eu + 13 * oneWeekInMs,
  us: seasonStartDates["sl-season-3"].us + 13 * oneWeekInMs,
  kr: seasonStartDates["sl-season-3"].kr + 13 * oneWeekInMs,
  tw: seasonStartDates["sl-season-3"].tw + 13 * oneWeekInMs,
};

export const bluePostForSeasonEnding: Record<
  string,
  Record<Regions, string>
> = {
  'df-season-1': {
    eu: "",
    kr: "",
    tw: "",
    us: "",
  },
  "sl-season-4": {
    eu: "",
    kr: "",
    tw: "",
    us: "",
  },
  "sl-season-3": {
    eu: "https://eu.forums.blizzard.com/en/wow/t/m-cryptic-hero-title-score-updated-daily/371434",
    kr: "",
    tw: "",
    us: "https://us.forums.blizzard.com/en/wow/t/m-cryptic-hero-title-score-updated-daily/1290001/1",
  },
  "sl-season-2": {
    eu: "",
    kr: "",
    tw: "",
    us: "",
  },
};

const offSeasonWeeks :Record<string, number> = {
  'sl-season-3': 0,
  'sl-season-4': 7,
}

export const seasonEndings = Object.entries(seasonStartDates).reduce<
  Record<string, Record<Regions, number>>
>((acc, [, regionEndingTimestampMap], index, arr) => {
  const prevSeasonName = arr[index + 1]?.[0];

  if (!prevSeasonName) {
    return acc;
  }

  const amountOfOffSeasonWeeks = offSeasonWeeks[prevSeasonName] ?? 1

  acc[prevSeasonName] = {
    eu: regionEndingTimestampMap.eu - amountOfOffSeasonWeeks * oneWeekInMs,
    us: regionEndingTimestampMap.us - amountOfOffSeasonWeeks * oneWeekInMs,
    tw: regionEndingTimestampMap.tw - amountOfOffSeasonWeeks * oneWeekInMs,
    kr: regionEndingTimestampMap.kr - amountOfOffSeasonWeeks * oneWeekInMs,
  };

  return acc;
}, {});

export const latestSeason = Object.entries(seasonStartDates)
  .reverse()
  .reduce(
    (acc, [seasonName, values]) => (Date.now() >= values.us ? seasonName : acc),
    "sl-season-4"
  );

export const hasSeasonEndedForAllRegions = (season: string): boolean => {
  if (!(season in seasonEndings)) {
    return false;
  }

  const regionData = seasonEndings[season];

  return Object.values(regionData).every((timestamp) => Date.now() > timestamp);
};

export const confirmedCutoffs: Record<
  string,
  Record<Regions, Record<Factions, number>>
> = {
  "sl-season-4": {
    eu: {
      horde: 0,
      alliance: 0,
    },
    us: {
      horde: 0,
      alliance: 0,
    },
    kr: {
      horde: 0,
      alliance: 0,
    },
    tw: {
      horde: 0,
      alliance: 0,
    },
  },
  "sl-season-3": {
    eu: {
      horde: 0,
      alliance: 0,
    },
    us: {
      horde: 0,
      alliance: 0,
    },
    kr: {
      horde: 0,
      alliance: 0,
    },
    tw: {
      horde: 0,
      alliance: 0,
    },
  },
  "sl-season-2": {
    // https://eu.forums.blizzard.com/en/wow/t/m-tormented-hero-title-score-updated-daily/341108
    eu: {
      horde: 2875,
      alliance: 2788,
    },
    // https://us.forums.blizzard.com/en/wow/t/m-tormented-hero-title-score-updated-daily/1184111
    us: {
      horde: 2847,
      alliance: 2768,
    },
    kr: {
      horde: 0,
      alliance: 0,
    },
    tw: {
      horde: 0,
      alliance: 0,
    },
  },
};

const slSeason2: [number, number, number][] = [
  [9, 11, 3], // Tyrannical, Bursting, Volcanic
  [10, 122, 12], // Fortified, Inspiring, Grievous
  [9, 123, 4], // Tyrannical, Spiteful, Necrotic
  [10, 7, 14], // Fortified, Bolstering, Quaking
  [9, 8, 124], // Tyrannical, Sanguine, Storming
  [10, 6, 13], // Fortified, Raging, Explosive
  [9, 11, 3], // Tyrannical, Bursting, Volcanic
  [10, 4, 12], // Fortified, Necrotic Grievous
  [9, 122, 14], // Tyrannical, Inspiring, Quaking
  [10, 8, 4], // Fortified, Sanguine Necrotic
  [9, 7, 13], // Tyrannical, Bolstering, Explosive
  [10, 11, 124], // Fortified, Bursting, Storming
];

const slSeason3: [number, number, number][] = [
  [9, 7, 13], // Tyrannical, Bolstering, Explosive
  [10, 11, 124], // Fortified, Bursting, Storming
  [9, 6, 3], // Tyrannical, Raging, Volcanic
  [10, 122, 12], // Fortified, Inspiring, Grievous
  [9, 123, 4], // Tyrannical, Spiteful, Necrotic
  [10, 7, 14], // Fortified, Bolstering, Quaking
  [9, 8, 124], // Tyrannical, Sanguine, Storming
  [10, 6, 13], // Fortified, Raging Explosive
  [9, 11, 3], // Tyrannical, Bursting, Volcanic
  [10, 123, 4], // Fortified, Spiteful, Necrotic
  [9, 122, 14], // Tyrannical, Inspiring, Quaking
  [10, 8, 12], // Fortified, Sanguine, Grievous
];

const slSeason4: [number, number, number][] = [
  [9, 122, 14], // Tyrannical, Inspiring, Quaking
  [10, 8, 12], // Fortified, Sanguine, Grievous
  [9, 7, 13], // Tyrannical, Bolstering, Explosive
  [10, 11, 124], // Fortified, Bursting, Storming
  [9, 6, 3], // Tyrannical, Raging, Volcanic
  [10, 122, 12], // Fortified, Inspiring, Grievous
  [9, 123, 4], // Tyrannical, Spiteful, Necrotic
  [10, 7, 14], // Fortified, Bolstering, Quaking
  [9, 8, 124], // Tyrannical, Sanguine, Storming
  [10, 6, 13], // Fortified, Raging Explosive
  [9, 11, 3], // Tyrannical, Bursting, Volcanic
  [10, 123, 4], // Fortified, Spiteful, Necrotic
];

export const affixRotations: Record<string, [number, number, number][]> = {
  "sl-season-2": [...slSeason2, ...slSeason2, ...slSeason2],
  "sl-season-3": [...slSeason3, ...slSeason3],
  "sl-season-4": [...slSeason4],
};
