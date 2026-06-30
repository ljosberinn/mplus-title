import { Affix, getAffixIconUrl } from "../../affixes";
import { defineSeason, weeklyEnd, weeklyStart } from "../config";
import { type Season } from "../runtime";

export const slSeasons: Season[] = [
  defineSeason({
    name: "SL S4",
    slug: "sl-season-4",
    expansion: "sl",
    rioKey: "season-sl-4",
    crossFactionSupport: "complete",
    startDates: weeklyStart("2022-08-02"),
    endDates: weeklyEnd("2022-10-25"),
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
    cutoffs: {
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
    },
    dungeons: 8,
    seasonIcon: getAffixIconUrl(Affix.Shrouded),
    startingPeriod: 866,
    wcl: {
      zoneId: 30,
      weekIndexToAffixSetId: [
        673, 666, 686, 671, 670, 694, 667, 684, 668, 665, 683, 672,
      ],
    },
    supportsExtrapolationHistory: false,
  }),
  defineSeason({
    name: "SL S3",
    slug: "sl-season-3",
    expansion: "sl",
    rioKey: "season-sl-3",
    crossFactionSupport: "partial",
    // TW joined late, on SL S4's launch cadence (preserved real-world quirk).
    startDates: {
      ...weeklyStart("2022-03-01"),
      TW: weeklyStart("2022-08-02").TW,
    },
    endDates: weeklyEnd("2022-08-02"),
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
    cutoffs: {
      EU: {
        score: 3725,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-cryptic-hero-title-score-updated-daily/371434",
      },
    },
    dungeons: 10,
    seasonIcon: getAffixIconUrl(Affix.Encrypted),
    startingPeriod: 844,
    wcl: {
      zoneId: 25,
      partition: 3,
      weekIndexToAffixSetId: [
        630, 631, 632, 636, 641, 648, 622, 656, 619, 655, 628, 657,
      ],
    },
    supportsExtrapolationHistory: false,
  }),
  defineSeason({
    name: "SL S2",
    slug: "sl-season-2",
    expansion: "sl",
    rioKey: "season-sl-2",
    crossFactionSupport: "none",
    startDates: weeklyStart("2021-07-06"),
    endDates: weeklyEnd("2022-02-22"),
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
    cutoffs: {
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
    },
    dungeons: 8,
    seasonIcon: getAffixIconUrl(Affix.Tormented),
    startingPeriod: null,
    supportsExtrapolationHistory: false,
  }),
];
