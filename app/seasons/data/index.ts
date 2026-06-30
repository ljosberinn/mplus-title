import { type Season } from "../runtime";
import { dfSeasons } from "./df";
import { mnSeasons } from "./mn";
import { slSeasons } from "./sl";
import { twwSeasons } from "./tww";

/**
 * All tracked seasons, newest first. Grouped by expansion in dedicated files;
 * each entry is produced by `defineSeason()` from compact authored config.
 */
export const seasons: Season[] = [
  ...mnSeasons,
  ...twwSeasons,
  ...dfSeasons,
  ...slSeasons,
];
