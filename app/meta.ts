import type { Factions, Regions } from "@prisma/client";

export const orderedGeasonsBySize: Regions[] = ["eu", "us", "tw", "kr"];

export const seasonStartDates: Record<string, Record<Regions, number>> = {
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
  eu: seasonStartDates["sl-season-3"].eu + 13 * 7 * 24 * 60 * 60 * 1000,
  us: seasonStartDates["sl-season-3"].us + 13 * 7 * 24 * 60 * 60 * 1000,
  kr: seasonStartDates["sl-season-3"].kr + 13 * 7 * 24 * 60 * 60 * 1000,
  tw: seasonStartDates["sl-season-3"].tw + 13 * 7 * 24 * 60 * 60 * 1000,
};

export const seasonEndings = Object.entries(seasonStartDates).reduce<
  Record<string, Record<Regions, number>>
>((acc, [, regionEndingTimestampMap], index, arr) => {
  const prevSeasonName = arr[index + 1]?.[0];

  if (!prevSeasonName) {
    return acc;
  }

  const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

  acc[prevSeasonName] = {
    eu: regionEndingTimestampMap.eu - oneWeekInMs,
    us: regionEndingTimestampMap.eu - oneWeekInMs,
    tw: regionEndingTimestampMap.eu - oneWeekInMs,
    kr: regionEndingTimestampMap.eu - oneWeekInMs,
  };

  return acc;
}, {});

export const [latestSeason] = Object.keys(seasonStartDates);

export const confirmedCutoffs: Record<
  string,
  Record<Regions, Record<Factions, number>>
> = {
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

export const affixRotations: Record<string, [number, number, number][]> = {
  "sl-season-3": [...slSeason3, ...slSeason3, ...slSeason3],
};
