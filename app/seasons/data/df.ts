import { Affix, getAffixIconUrl } from "../../affixes";
import { defineSeason, weeklyEnd, weeklyStart } from "../config";
import { type Season } from "../runtime";

export const dfSeasons: Season[] = [
  defineSeason({
    name: "DF S4",
    slug: "df-season-4",
    expansion: "df",
    rioKey: "season-df-4",
    crossFactionSupport: "complete",
    startDates: weeklyStart("2024-04-23"),
    endDates: weeklyEnd("2024-07-23"),
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
    dungeons: [
      { name: "The Azure Vault", slug: "the-azure-vault" },
      { name: "Algeth'ar Academy", slug: "algethar-academy" },
      { name: "The Nokhud Offensive", slug: "the-nokhud-offensive" },
      { name: "Halls of Infusion", slug: "halls-of-infusion" },
      { name: "Ruby Life Pools", slug: "ruby-life-pools" },
      { name: "Brackenhide Hollow", slug: "brackenhide-hollow" },
      { name: "Neltharus", slug: "neltharus" },
      { name: "Uldaman: Legacy of Tyr", slug: "uldaman-legacy-of-tyr" },
    ],
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-37.png",
    startingPeriod: 956,
    wcl: {
      zoneId: 37,
      weekIndexToAffixSetId: [706, 762, 765, 767, 769, 419, 771, 775, 785, 502],
    },
    supportsExtrapolationHistory: false,
    cutoffs: {
      EU: {
        score: 3677,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-draconic-hero-title-updated-23-july/523543",
      },
      US: {
        score: 3649,
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-draconic-hero-title-updated-july-23-final/1894760",
      },
    },
  }),
  defineSeason({
    name: "DF S3",
    slug: "df-season-3",
    expansion: "df",
    rioKey: "season-df-3",
    crossFactionSupport: "complete",
    startDates: weeklyStart("2023-11-14"),
    endDates: weeklyEnd("2024-04-23"),
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
    cutoffs: {
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
    },
    annotations: [
      { kind: "hotfix", label: "Rise +1 min", week: 2 },
      { kind: "hotfix", label: "WCM Thorns -35% hp", week: 7 },
      { kind: "hotfix", label: "Spec Tuning & Rise nerfs", week: 10 },
      { kind: "patch", label: "10.2.5", week: 9 },
      { kind: "patch", label: "10.2.6", week: 18 },
    ],
    dungeons: 8,
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-36.png",
    startingPeriod: 933,
    wcl: {
      zoneId: 36,
      weekIndexToAffixSetId: [775, 785, 502, 706, 762, 765, 767, 769, 419, 771],
    },
    supportsExtrapolationHistory: false,
  }),
  defineSeason({
    name: "DF S2",
    slug: "df-season-2",
    expansion: "df",
    rioKey: "season-df-2",
    crossFactionSupport: "complete",
    startDates: weeklyStart("2023-05-09"),
    endDates: weeklyEnd("2023-11-07"),
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
    cutoffs: {
      EU: {
        score: 3632,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-smoldering-hero-title-updated-november-2/474193",
      },
      US: {
        score: 3561,
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-smoldering-hero-title-updated-november-2/1697884",
      },
    },
    annotations: [
      { kind: "hotfix", label: "Scaling Adjustment", base: 1_692_716_400_000 },
      { kind: "hotfix", label: "Larger Class Tuning", base: 1_691_506_800_000 },
      { kind: "hotfix", label: "Small Class Tuning", base: 1_690_297_200_000 },
      { kind: "hotfix", label: "Various Nerfs", base: 1_688_130_000_000 },
      { kind: "patch", label: "10.1.5", base: 1_689_087_600_000 },
      { kind: "patch", label: "10.1.7", base: 1_693_926_000_000 },
    ],
    dungeons: 8,
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-34.png",
    startingPeriod: 906,
    wcl: {
      zoneId: 34,
      weekIndexToAffixSetId: [706, 762, 765, 767, 769, 419, 771, 775, 785, 502],
    },
    supportsExtrapolationHistory: false,
  }),
  defineSeason({
    name: "DF S1",
    slug: "df-season-1",
    expansion: "df",
    rioKey: "season-df-1",
    crossFactionSupport: "complete",
    startDates: weeklyStart("2022-12-13"),
    endDates: weeklyEnd("2023-05-02"),
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
    cutoffs: {
      EU: {
        score: 3345,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-thundering-hero-title-updated-27-april/444828",
      },
      US: {
        score: 3298,
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-thundering-hero-title-updated-april-27/1576546/1",
      },
    },
    annotations: [
      {
        kind: "hotfix",
        label: "Azure Vault +1.5 Minutes",
        base: 1_678_798_800_000,
      },
      { kind: "patch", label: "10.0.7", base: 1_679_410_800_000 },
      { kind: "patch", label: "10.0.5", base: 1_675_177_200_000 },
    ],
    dungeons: 8,
    seasonIcon: getAffixIconUrl(Affix.Thundering),
    startingPeriod: 885,
    wcl: {
      zoneId: 32,
      weekIndexToAffixSetId: [702, 703, 705, 707, 708, 715, 723, 727, 712, 733],
    },
    supportsExtrapolationHistory: false,
  }),
];
