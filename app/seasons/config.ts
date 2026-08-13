import { type Factions, type Regions } from "prisma/generated/prisma/enums";
import { z } from "zod";

import { type Expansion, type Season } from "./runtime";

const HOUR = 60 * 60 * 1000;
const WEEK = 7 * 24 * HOUR;

/** Per-region delay applied to a US *start* timestamp. */
export function offsetStartDateForRegion(
  timestamp: number,
  region: Regions,
): number {
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
    default: {
      return timestamp;
    }
  }
}

/** Per-region delay applied to a US *end* timestamp. */
export function offsetEndDateForRegion(
  timestamp: number,
  region: Regions,
): number {
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
    default: {
      return timestamp;
    }
  }
}

function toMs(value: number | string): number {
  return typeof value === "string" ? Date.parse(value) : value;
}

/** Offset (ms) where `localWallClock = utcMs + offset` for `timeZone` at `utcMs`. */
function tzOffset(timeZone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") {
      map[part.type] = Number(part.value);
    }
  }
  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour,
    map.minute,
    map.second,
  );
  return asUtc - utcMs;
}

/**
 * Convert a wall-clock time in an IANA `timeZone` to a UTC epoch (ms), DST-aware.
 * Two-pass offset correction; safe for reset hours (05:00/08:00) which sit far
 * from the DST transition instants.
 */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): number {
  const utcGuess = Date.UTC(year, month - 1, day, hour, 0, 0);
  const firstPass = utcGuess - tzOffset(timeZone, utcGuess);
  return utcGuess - tzOffset(timeZone, firstPass);
}

/**
 * Per-region reset cadence shared by season starts and ends: US anchors to its
 * Tuesday, EU to the following day, KR/TW/CN two days later. Each region resets
 * at a fixed *local* wall-clock, so the UTC gaps shift with DST per season.
 */
const RESET_CADENCE = {
  US: { dayShift: 0, timeZone: "America/Los_Angeles" },
  EU: { dayShift: 1, timeZone: "Europe/Paris" },
  asia: { dayShift: 2, timeZone: "Asia/Seoul" },
} as const;

/**
 * A per-region wall-clock hour. A bare number is read in that region's own
 * `RESET_CADENCE` time zone (so it tracks DST); `{ hour, timeZone }` pins it to
 * an explicit zone instead — used for EU, whose reset is a fixed 04:00 *UTC*
 * year-round rather than a fixed local hour.
 */
type ZoneHour = number | { hour: number; timeZone: string };

function weekly(
  usTuesday: string,
  hours: { US: ZoneHour; EU: ZoneHour; asia: ZoneHour },
  baseDayShift = 0,
): Record<Regions, number> {
  const [y, m, d] = usTuesday.split("-").map(Number);

  const at = (zone: keyof typeof RESET_CADENCE): number => {
    const { dayShift } = RESET_CADENCE[zone];
    const spec = hours[zone];
    const hour = typeof spec === "number" ? spec : spec.hour;
    const timeZone =
      typeof spec === "number" ? RESET_CADENCE[zone].timeZone : spec.timeZone;
    const rolled = new Date(Date.UTC(y, m - 1, d + dayShift + baseDayShift));
    return zonedTimeToUtc(
      rolled.getUTCFullYear(),
      rolled.getUTCMonth() + 1,
      rolled.getUTCDate(),
      hour,
      timeZone,
    );
  };

  const asia = at("asia");
  return { US: at("US"), EU: at("EU"), KR: asia, TW: asia, CN: asia };
}

/**
 * Canonical, DST-aware season-*start* derivation from the US Tuesday calendar
 * date (the same model MN S1 uses). Regions start at fixed *local* times:
 *  - US        Tuesday    08:00 America/Los_Angeles
 *  - EU        Wednesday  05:00 Europe/Paris
 *  - KR/TW/CN  Thursday   08:00 Asia/Seoul (no DST)
 *
 * Because each region's UTC offset shifts independently across the year, the
 * inter-region gaps vary by season (e.g. US winter seasons land at 16:00 UTC,
 * not 15:00). Replaces the fixed-ms `byStartOffset`, which encoded a single
 * DST phase and drifted by an hour for off-phase seasons.
 */
export function weeklyStart(usTuesday: string): Record<Regions, number> {
  return weekly(usTuesday, { US: 8, EU: 5, asia: 8 });
}

/**
 * Canonical, DST-aware season-*end* derivation. `usTuesday` is the US Tuesday of
 * the *ending reset* week; `at` picks which instant of that week ends it:
 *
 *  - `"pre-reset"` (default) — 22:00 local the evening *before* the regional
 *    reset that terminates the season, i.e. the same 22:00-local wall-clock in
 *    every region but one calendar day earlier than the reset (hence
 *    `baseDayShift: -1`). This is how every pre-MN season was authored.
 *  - `"reset"` — the regional weekly reset itself: US Tue 07:00
 *    America/Los_Angeles, EU Wed 04:00 *UTC* (fixed year-round, not a fixed
 *    local hour), KR/TW/CN Thu 07:00 Asia/Seoul. Asia mirrors the US local hour,
 *    matching the existing cadence where every region shares one local
 *    wall-clock and EU is the stated exception.
 */
export function weeklyEnd(
  usTuesday: string,
  at: "pre-reset" | "reset" = "pre-reset",
): Record<Regions, number> {
  return at === "reset"
    ? weekly(usTuesday, { US: 7, EU: { hour: 4, timeZone: "UTC" }, asia: 7 })
    : weekly(usTuesday, { US: 22, EU: 22, asia: 22 }, -1);
}

function mapRegions<T>(fn: (region: Regions) => T): Record<Regions, T> {
  return {
    US: fn("US"),
    EU: fn("EU"),
    KR: fn("KR"),
    TW: fn("TW"),
    CN: fn("CN"),
  };
}

/** Expand a US base *start* into the per-region runtime record. */
export function byStartOffset(base: number | string): Record<Regions, number> {
  return mapRegions((region) => offsetStartDateForRegion(toMs(base), region));
}

/** Expand a US base *end* into the per-region runtime record. */
export function byEndOffset(base: number | string): Record<Regions, number> {
  return mapRegions((region) => offsetEndDateForRegion(toMs(base), region));
}

/** Same value in every region (used for globally-applied hotfixes). */
export function flat(value: number | string): Record<Regions, number> {
  const ms = toMs(value);
  return mapRegions(() => ms);
}

/** Every region has no known start/end date. */
export const NO_DATES: Record<Regions, null> = mapRegions(() => null);

type RegionalDates = Record<Regions, number | null>;

type AuthoredCutoff =
  | { score: number; score100: number; source: string | null }
  | ({ source: string | null } & Record<Factions, number>);

/**
 * A patch/hotfix marker. Exactly one of `week`, `base` or `at` must be set:
 *  - `week`   -> each region's own start + `week` weeks
 *  - `base`   -> a US base timestamp expanded via the start-offset
 *  - `at`     -> an explicit timestamp (flat number = same in every region)
 */
type AuthoredEvent = {
  kind: "hotfix" | "patch";
  label: string;
  week?: number;
  base?: number | string;
  at?: number | Record<Regions, number>;
};

export type SeasonInput = {
  name: string;
  slug: string;
  expansion: Expansion;
  rioKey: string;
  crossFactionSupport: Season["crossFactionSupport"];
  startDates: RegionalDates;
  endDates: RegionalDates;
  affixes: Season["affixes"];
  /** Partial: regions left out default to a zeroed placeholder. */
  cutoffs?: Partial<Record<Regions, AuthoredCutoff>>;
  annotations?: AuthoredEvent[];
  dungeons: Season["dungeons"];
  seasonIcon: string;
  startingPeriod: number | null;
  wcl?: Season["wcl"];
  supportsExtrapolationHistory?: boolean;
};

const regionalRecordSchema = z.object({
  US: z.number().nullable(),
  EU: z.number().nullable(),
  KR: z.number().nullable(),
  TW: z.number().nullable(),
  CN: z.number().nullable(),
});

const eventSchema = z
  .object({
    kind: z.enum(["hotfix", "patch"]),
    label: z.string().min(1),
    week: z.number().optional(),
    base: z.union([z.number(), z.string()]).optional(),
    at: z.union([z.number(), z.record(z.string(), z.number())]).optional(),
  })
  .refine(
    (ev) =>
      [ev.week, ev.base, ev.at].filter((v) => v !== undefined).length === 1,
    { message: "an annotation needs exactly one of `week`, `base` or `at`" },
  );

const seasonInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  expansion: z.enum(["mn", "tww", "df", "sl"]),
  rioKey: z.string().min(1),
  crossFactionSupport: z.enum(["complete", "none", "partial"]),
  startDates: regionalRecordSchema,
  endDates: regionalRecordSchema,
  affixes: z.array(z.array(z.number())),
  cutoffs: z.record(z.string(), z.any()).optional(),
  annotations: z.array(eventSchema).optional(),
  dungeons: z.union([z.number(), z.array(z.object({}).loose())]),
  seasonIcon: z.string().min(1),
  startingPeriod: z.number().nullable(),
  wcl: z.object({}).loose().optional(),
  supportsExtrapolationHistory: z.boolean().optional(),
});

function expandEvent(event: AuthoredEvent, startDates: RegionalDates) {
  if (event.week !== undefined) {
    const { week } = event;
    return mapRegions((region) => (startDates[region] ?? 0) + week * WEEK);
  }

  if (event.base !== undefined) {
    return byStartOffset(event.base);
  }

  if (event.at !== undefined) {
    return typeof event.at === "number" ? flat(event.at) : event.at;
  }

  throw new Error(`annotation "${event.label}" has no timing`);
}

function defaultCutoff(crossFactionSupport: Season["crossFactionSupport"]) {
  return crossFactionSupport === "none"
    ? { source: null, horde: 0, alliance: 0 }
    : { score: 0, score100: 0, source: null };
}

/**
 * Expands compact authored season config into the runtime `Season` shape used
 * across the app. zod-validates the input; the result is byte-equivalent to the
 * previously hand-authored objects (guarded by the season snapshot test).
 */
export function defineSeason(input: SeasonInput): Season {
  seasonInputSchema.parse(input);

  const dungeonHotfixes: Season["dungeonHotfixes"] = {};
  const patches: Season["patches"] = {};

  for (const event of input.annotations ?? []) {
    const expanded = expandEvent(event, input.startDates);
    if (event.kind === "hotfix") {
      dungeonHotfixes[event.label] = expanded;
    } else {
      patches[event.label] = expanded;
    }
  }

  const fallback = defaultCutoff(input.crossFactionSupport);
  const confirmedCutoffs = mapRegions(
    (region) => input.cutoffs?.[region] ?? fallback,
  ) as Season["confirmedCutoffs"];

  const season: Season = {
    name: input.name,
    slug: input.slug,
    expansion: input.expansion,
    rioKey: input.rioKey,
    crossFactionSupport: input.crossFactionSupport,
    startDates: input.startDates,
    endDates: input.endDates,
    affixes: input.affixes,
    confirmedCutoffs,
    dungeonHotfixes,
    patches,
    dungeons: input.dungeons,
    seasonIcon: input.seasonIcon,
    startingPeriod: input.startingPeriod,
    supportsExtrapolationHistory: input.supportsExtrapolationHistory ?? false,
  };

  if (input.wcl) {
    season.wcl = {
      ...input.wcl,
      weekIndexToAffixSetId: input.wcl.weekIndexToAffixSetId ?? [],
    };
  }

  return season;
}
