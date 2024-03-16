export enum Affix {
  Overflowing = 1,
  Skittish = 2,
  Volcanic = 3,
  Necrotic = 4,
  Teeming = 5,
  Raging = 6,
  Bolstering = 7,
  Sanguine = 8,
  Tyrannical = 9,
  Fortified = 10,
  Bursting = 11,
  Grievous = 12,
  Explosive = 13,
  Quaking = 14,
  Infested = 16,
  Reaping = 117,
  Beguiling = 119,
  Awakened = 120,
  Prideful = 121,
  Inspiring = 122,
  Spiteful = 123,
  Storming = 124,
  Tormented = 128,
  Infernal = 129,
  Encrypted = 130,
  Shrouded = 131,
  Thundering = 132,
  Entangling = 134,
  Afflicted = 135,
  Incorporeal = 136,
}

export const affixes: Record<
  Affix,
  { icon: string; locales: Record<string, string> }
> = {
  [Affix.Overflowing]: {
    locales: { en: "Overflowing", de: "Überschüssig" },
    icon: "inv_misc_volatilewater",
  },
  [Affix.Skittish]: {
    locales: { en: "Skittish", de: "Launisch" },
    icon: "spell_magic_lesserinvisibilty",
  },
  [Affix.Volcanic]: {
    locales: { en: "Volcanic", de: "Vulkanisch" },
    icon: "spell_shaman_lavasurge",
  },
  [Affix.Necrotic]: {
    locales: { en: "Necrotic", de: "Nekrotisch" },
    icon: "spell_deathknight_necroticplague",
  },
  [Affix.Teeming]: {
    locales: { en: "Teeming", de: "Wimmelnd" },
    icon: "spell_nature_massteleport",
  },
  [Affix.Raging]: {
    locales: { en: "Raging", de: "Wütend" },
    icon: "ability_warrior_focusedrage",
  },
  [Affix.Bolstering]: {
    locales: { en: "Bolstering", de: "Anstachelnd" },
    icon: "ability_warrior_battleshout",
  },
  [Affix.Sanguine]: {
    locales: { en: "Sanguine", de: "Blutig" },
    icon: "spell_shadow_bloodboil",
  },
  [Affix.Tyrannical]: {
    locales: { en: "Tyrannical", de: "Tyrannisch" },
    icon: "achievement_boss_archaedas",
  },
  [Affix.Fortified]: {
    locales: { en: "Fortified", de: "Verstärkt" },
    icon: "ability_toughness",
  },
  [Affix.Bursting]: {
    locales: { en: "Bursting", de: "Platzend" },
    icon: "ability_ironmaidens_whirlofblood",
  },
  [Affix.Grievous]: {
    locales: { en: "Grievous", de: "Schrecklich" },
    icon: "ability_backstab",
  },
  [Affix.Explosive]: {
    locales: { en: "Explosive", de: "Explosive" },
    icon: "spell_fire_felflamering_red",
  },
  [Affix.Quaking]: {
    locales: { en: "Quaking", de: "Bebend" },
    icon: "spell_nature_earthquake",
  },
  [Affix.Infested]: {
    locales: { en: "Infested", de: "Befallen" },
    icon: "achievement_nazmir_boss_ghuun",
  },
  [Affix.Reaping]: {
    locales: { en: "Reaping", de: "Schröpfend" },
    icon: "ability_racial_embraceoftheloa_bwonsomdi",
  },
  [Affix.Beguiling]: {
    locales: { en: "Beguiling", de: "Betörend" },
    icon: "spell_shadow_mindshear",
  },
  [Affix.Awakened]: {
    locales: { en: "Awakened", de: "Erweckt" },
    icon: "trade_archaeology_nerubian_obelisk",
  },
  [Affix.Prideful]: {
    locales: { en: "Prideful", de: "Stolz" },
    icon: "spell_animarevendreth_buff",
  },
  [Affix.Inspiring]: {
    locales: { en: "Inspiring", de: "Inspirierend" },
    icon: "spell_holy_prayerofspirit",
  },
  [Affix.Spiteful]: {
    locales: { en: "Spiteful", de: "Boshaft" },
    icon: "spell_holy_prayerofshadowprotection",
  },
  [Affix.Storming]: {
    locales: { en: "Storming", de: "Stürmisch" },
    icon: "spell_nature_cyclone",
  },
  [Affix.Tormented]: {
    locales: { en: "Tormented", de: "Gequält" },
    icon: "spell_animamaw_orb",
  },
  [Affix.Infernal]: {
    locales: { en: "Infernal", de: "Höllisch" },
    icon: "inv_infernalbrimstone",
  },
  [Affix.Encrypted]: {
    locales: { en: "Encrypted", de: "Verschlüsselt" },
    icon: "spell_progenitor_orb",
  },
  [Affix.Shrouded]: {
    locales: { en: "Shrouded", de: "Verhüllt" },
    icon: "spell_shadow_nethercloak",
  },
  [Affix.Thundering]: {
    locales: { en: "Thundering", de: "Donnernd" },
    icon: "shaman_pvp_leaderclan",
  },
  [Affix.Entangling]: {
    locales: { en: "Entangling", de: "Umschlingend" },
    icon: "inv_misc_root_01",
  },
  [Affix.Afflicted]: {
    locales: { en: "Afflicted", de: "Befallen" },
    icon: "spell_misc_emotionsad",
  },
  [Affix.Incorporeal]: {
    locales: { en: "Incorporeal", de: "Unkörperlich" },
    icon: "achievement_boss_anomalus",
  },
};

export const getAffixIconUrl = (id: Affix | -1): string => {
  if (id === -1) {
    return `https://wow.zamimg.com/images/wow/icons/small/inv_misc_questionmark.jpg`;
  }

  return `https://wow.zamimg.com/images/wow/icons/small/${affixes[id].icon}.jpg`;
};
export const getAffixName = (id: Affix, locale?: string): string => {
  if (locale && locale in affixes[id].locales) {
    return affixes[id].locales[locale];
  }

  return affixes[id].locales.en;
};
