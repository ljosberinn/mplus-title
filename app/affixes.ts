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

export const affixes: Record<Affix, { icon: string; name: string }> = {
  [Affix.Overflowing]: { name: "Overflowing", icon: "inv_misc_volatilewater" },
  [Affix.Skittish]: {
    name: "Skittish",
    icon: "spell_magic_lesserinvisibilty",
  },
  [Affix.Volcanic]: { name: "Volcanic", icon: "spell_shaman_lavasurge" },
  [Affix.Necrotic]: {
    name: "Necrotic",
    icon: "spell_deathknight_necroticplague",
  },
  [Affix.Teeming]: {
    name: "Teeming",
    icon: "spell_nature_massteleport",
  },
  [Affix.Raging]: { name: "Raging", icon: "ability_warrior_focusedrage" },
  [Affix.Bolstering]: {
    name: "Bolstering",
    icon: "ability_warrior_battleshout",
  },
  [Affix.Sanguine]: { name: "Sanguine", icon: "spell_shadow_bloodboil" },
  [Affix.Tyrannical]: {
    name: "Tyrannical",
    icon: "achievement_boss_archaedas",
  },
  [Affix.Fortified]: { name: "Fortified", icon: "ability_toughness" },
  [Affix.Bursting]: {
    name: "Bursting",
    icon: "ability_ironmaidens_whirlofblood",
  },
  [Affix.Grievous]: { name: "Grievous", icon: "ability_backstab" },
  [Affix.Explosive]: {
    name: "Explosive",
    icon: "spell_fire_felflamering_red",
  },
  [Affix.Quaking]: { name: "Quaking", icon: "spell_nature_earthquake" },
  [Affix.Infested]: {
    name: "Infested",
    icon: "achievement_nazmir_boss_ghuun",
  },
  [Affix.Reaping]: {
    name: "Reaping",
    icon: "ability_racial_embraceoftheloa_bwonsomdi",
  },
  [Affix.Beguiling]: { name: "Beguiling", icon: "spell_shadow_mindshear" },
  [Affix.Awakened]: {
    name: "Awakened",
    icon: "trade_archaeology_nerubian_obelisk",
  },
  [Affix.Prideful]: {
    name: "Prideful",
    icon: "spell_animarevendreth_buff",
  },
  [Affix.Inspiring]: {
    name: "Inspiring",
    icon: "spell_holy_prayerofspirit",
  },
  [Affix.Spiteful]: {
    name: "Spiteful",
    icon: "spell_holy_prayerofshadowprotection",
  },
  [Affix.Storming]: { name: "Storming", icon: "spell_nature_cyclone" },
  [Affix.Tormented]: { name: "Tormented", icon: "spell_animamaw_orb" },
  [Affix.Infernal]: { name: "Infernal", icon: "inv_infernalbrimstone" },
  [Affix.Encrypted]: { name: "Encrypted", icon: "spell_progenitor_orb" },
  [Affix.Shrouded]: { name: "Shrouded", icon: "spell_shadow_nethercloak" },
  [Affix.Thundering]: {
    name: "Thundering",
    icon: "shaman_pvp_leaderclan",
  },
  [Affix.Entangling]: {
    name: 'Entangling', icon: 'inv_misc_root_01'
  },
  [Affix.Afflicted]: {
    name: 'Afflicted', icon: 'spell_misc_emotionsad'
  },
  [Affix.Incorporeal]: {
    name: 'Incorporeal', icon: 'achievement_boss_anomalus'
  }
};

export const getAffixIconUrl = (id: Affix): string =>
  `https://wow.zamimg.com/images/wow/icons/small/${affixes[id].icon}.jpg`;
export const getAffixName = (id: Affix): string => affixes[id].name;
