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
}

export const affixes: Record<Affix, { icon: string }> = {
  [Affix.Overflowing]: { icon: "inv_misc_volatilewater" },
  [Affix.Skittish]: {
    icon: "spell_magic_lesserinvisibilty",
  },
  [Affix.Volcanic]: { icon: "spell_shaman_lavasurge" },
  [Affix.Necrotic]: {
    icon: "spell_deathknight_necroticplague",
  },
  [Affix.Teeming]: {
    icon: "spell_nature_massteleport",
  },
  [Affix.Raging]: { icon: "ability_warrior_focusedrage" },
  [Affix.Bolstering]: {
    icon: "ability_warrior_battleshout",
  },
  [Affix.Sanguine]: { icon: "spell_shadow_bloodboil" },
  [Affix.Tyrannical]: {
    icon: "achievement_boss_archaedas",
  },
  [Affix.Fortified]: { icon: "ability_toughness" },
  [Affix.Bursting]: {
    icon: "ability_ironmaidens_whirlofblood",
  },
  [Affix.Grievous]: { icon: "ability_backstab" },
  [Affix.Explosive]: {
    icon: "spell_fire_felflamering_red",
  },
  [Affix.Quaking]: { icon: "spell_nature_earthquake" },
  [Affix.Infested]: {
    icon: "achievement_nazmir_boss_ghuun",
  },
  [Affix.Reaping]: {
    icon: "ability_racial_embraceoftheloa_bwonsomdi",
  },
  [Affix.Beguiling]: { icon: "spell_shadow_mindshear" },
  [Affix.Awakened]: {
    icon: "trade_archaeology_nerubian_obelisk",
  },
  [Affix.Prideful]: {
    icon: "spell_animarevendreth_buff",
  },
  [Affix.Inspiring]: {
    icon: "spell_holy_prayerofspirit",
  },
  [Affix.Spiteful]: {
    icon: "spell_holy_prayerofshadowprotection",
  },
  [Affix.Storming]: { icon: "spell_nature_cyclone" },
  [Affix.Tormented]: { icon: "spell_animamaw_orb" },
  [Affix.Infernal]: { icon: "inv_infernalbrimstone" },
  [Affix.Encrypted]: { icon: "spell_progenitor_orb" },
  [Affix.Shrouded]: { icon: "spell_shadow_nethercloak" },
  [Affix.Thundering]: {
    icon: "shaman_pvp_leaderclan",
  },
};

export const getAffixIconUrl = (id: Affix): string =>
  `https://wow.zamimg.com/images/wow/icons/small/${affixes[id].icon}.jpg`;
