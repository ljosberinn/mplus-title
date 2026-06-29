import { Affix } from "../../affixes";
import { defineSeason, weeklyEnd, weeklyStart } from "../config";
import { type Season } from "../runtime";

const at = (iso: string): number => Date.parse(iso);

export const twwSeasons: Season[] = [
  defineSeason({
    name: "TWW S3",
    slug: "tww-season-3",
    expansion: "tww",
    rioKey: "season-tww-3",
    crossFactionSupport: "complete",
    startDates: weeklyStart("2025-08-12"),
    endDates: weeklyEnd("2026-01-20"),
    affixes: [],
    cutoffs: {
      EU: {
        score: 3945,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-unbound-hero-title-updated-14-january/601495",
      },
      US: {
        score: 3912,
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-unbound-hero-title-updated-january-14/2227583",
      },
    },
    annotations: [
      {
        kind: "hotfix",
        label: "Ara-Kara / Halls Nerfs",
        at: {
          US: at("2025-09-09T15:00:00Z"),
          EU: at("2025-09-10T04:00:00Z"),
          CN: at("2025-09-09T23:00:00Z"),
          TW: at("2025-09-09T23:00:00Z"),
          KR: at("2025-09-09T23:00:00Z"),
        },
      },
    ],
    dungeons: [
      { name: "Operation: Floodgate", slug: "operation-floodgate" },
      { name: "Ara-Kara, City of Echoes", slug: "arakara-city-of-echoes" },
      { name: "The Dawnbreaker", slug: "the-dawnbreaker" },
      { name: "Priory of the Sacred Flame", slug: "priory-of-the-sacred-flame" },
      { name: "Tazavesh: Streets of Wonder", slug: "tazavesh-streets-of-wonder" },
      { name: "Tazavesh: So'leah's Gambit", slug: "tazavesh-soleahs-gambit" },
      { name: "Eco-Dome Al'dani", slug: "ecodome-aldani" },
      { name: "Halls of Atonement", slug: "halls-of-atonement" },
    ],
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-45.png",
    startingPeriod: 1024,
    wcl: { zoneId: 45, weekIndexToAffixSetId: [] },
    supportsExtrapolationHistory: true,
  }),
  defineSeason({
    name: "TWW S2",
    slug: "tww-season-2",
    expansion: "tww",
    rioKey: "season-tww-2",
    crossFactionSupport: "complete",
    startDates: weeklyStart("2025-03-04"),
    endDates: weeklyEnd("2025-08-05"),
    affixes: [],
    cutoffs: {
      EU: {
        score: 3821,
        source:
          "https://eu.forums.blizzard.com/en/wow/t/m-enterprising-hero-title-updated-29-july/582042",
      },
      US: {
        score: 3805,
        source:
          "https://us.forums.blizzard.com/en/wow/t/m-enterprising-hero-title-updated-july-29/2139296/1",
      },
    },
    annotations: [
      { kind: "hotfix", label: "Dungeon Tuning", at: 1_741_377_600_000 },
      { kind: "hotfix", label: "More Dungeon Tuning", at: 1_742_360_400_000 },
      {
        kind: "patch",
        label: "11.1.5",
        at: {
          US: at("2025-04-22T15:00:00Z"),
          EU: at("2025-04-23T04:00:00Z"),
          TW: at("2025-04-23T23:00:00Z"),
          KR: at("2025-04-23T23:00:00Z"),
          CN: at("2025-04-23T23:00:00Z"),
        },
      },
      {
        kind: "patch",
        label: "11.1.7",
        at: {
          US: at("2025-06-17T15:00:00Z"),
          EU: at("2025-06-18T04:00:00Z"),
          TW: at("2025-06-18T23:00:00Z"),
          KR: at("2025-06-18T23:00:00Z"),
          CN: at("2025-06-18T23:00:00Z"),
        },
      },
    ],
    dungeons: [
      { name: "Cinderbrew Meadery", slug: "cinderbrew-meadery" },
      { name: "Darkflame Cleft", slug: "darkflame-cleft" },
      { name: "Operation: Floodgate", slug: "operation-floodgate" },
      {
        name: "Operation: Mechagon - Workshop",
        slug: "operation-mechagon-workshop",
      },
      { name: "Priory of the Sacred Flame", slug: "priory-of-the-sacred-flame" },
      { name: "The MOTHERLODE!!", slug: "the-motherlode" },
      { name: "The Rookery", slug: "the-rookery" },
      { name: "Theater of Pain", slug: "theater-of-pain" },
    ],
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-43.png",
    startingPeriod: 0,
    wcl: { zoneId: 43, weekIndexToAffixSetId: [] },
    supportsExtrapolationHistory: false,
  }),
  defineSeason({
    name: "TWW S1",
    slug: "tww-season-1",
    expansion: "tww",
    rioKey: "season-tww-1",
    crossFactionSupport: "complete",
    startDates: weeklyStart("2024-09-17"),
    endDates: weeklyEnd("2025-02-25"),
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
    cutoffs: {
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
    },
    annotations: [
      { kind: "hotfix", label: "Dungeon Tuning", base: 1_727_794_800_000 },
      { kind: "hotfix", label: "Xal'atath's Guile Nerf", at: 1_728_594_316_832 },
      { kind: "hotfix", label: "NW/SV Nerf", base: 1_729_004_400_000 },
      { kind: "hotfix", label: "Tuning", base: 1_730_210_400_000 },
      { kind: "hotfix", label: "More Tuning", base: 1_734_447_600_000 },
      { kind: "patch", label: "11.0.5", base: 1_729_605_600_000 },
      { kind: "patch", label: "11.0.7", base: 1_734_447_600_000 },
    ],
    dungeons: [
      { name: "Ara-Kara, City of Echoes", slug: "arakara-city-of-echoes" },
      { name: "City of Threads", slug: "city-of-threads" },
      { name: "Grim Batol", slug: "grim-batol" },
      { name: "Mists of Tirna Scithe", slug: "mists-of-tirna-scithe" },
      { name: "Siege of Boralus", slug: "siege-of-boralus" },
      { name: "The Dawnbreaker", slug: "the-dawnbreaker" },
      { name: "The Necrotic Wake", slug: "the-necrotic-wake" },
      { name: "The Stonevault", slug: "the-stonevault" },
    ],
    seasonIcon: "https://assets.rpglogs.com/img/warcraft/zones/zone-39.png",
    startingPeriod: 977,
    wcl: { zoneId: 39, weekIndexToAffixSetId: [] },
    supportsExtrapolationHistory: false,
  }),
];
