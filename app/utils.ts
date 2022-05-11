import { Regions } from "@prisma/client";

export const isValidRegion = (maybeRegion: string): maybeRegion is Regions =>
  maybeRegion in Regions;
