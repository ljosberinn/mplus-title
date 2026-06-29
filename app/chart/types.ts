/**
 * Renderer-agnostic intermediate chart shapes.
 *
 * The pure builders in `builders.ts` derive these from a season's config +
 * loaded `Dataset[]`, and the uPlot adapters (`uplotData.ts`,
 * `dungeonRecordsData.ts`) consume them. They used to be Highcharts' own option
 * types; uPlot is now the only renderer, so this is the minimal subset both
 * sides actually read — no Highcharts dependency.
 */

/** A scatter point that may carry the time the prediction was made. */
export type ScatterPoint = { x: number; y: number; estimatedAt?: number };

/** `[ts, value]` (line/scatter) or `[ts, low, high]` (confidence band). */
export type ChartSeriesData = number[][] | ScatterPoint[];

export type SeriesType = "line" | "scatter" | "arearange";

/** One drawable series (a cutoff line, the extrapolation, its band, …). */
export type ChartSeries = {
  type: SeriesType;
  /** stable id used to slave a confidence band to its line and to pick out the
   * primary cutoff lines. */
  id?: string;
  name: string;
  color: string;
  data: ChartSeriesData;
  /** dashed projection line (extrapolation). */
  dashed?: boolean;
  /** default legend visibility. */
  visible?: boolean;
};

/** One dungeon-records line (highest key level over time, `[ts, keyLevel]`). */
export type RecordSeries = {
  name: string;
  iconUrl: string | null;
  data: number[][];
};

/** Label attached to a plot line (vertical/horizontal annotation). */
export type PlotLabel = {
  text: string;
  /** label colour, independent of the line colour. */
  color?: string;
  /** vertical offset hint preserved from the old Highcharts `label.y`. */
  y?: number;
};

/** A vertical (x-axis) or horizontal (y-axis) annotation line. */
export type PlotLine = {
  /** e.g. "week-number"; lets consumers pick out specific lines. */
  id?: string;
  value: number;
  color?: string;
  label?: PlotLabel;
};

/** A shaded x-axis region: the alternating week backgrounds and the
 * (transparent) weekly-difference label bands. */
export type PlotBand = {
  id: "background-color" | "weekly-difference";
  from: number;
  to: number;
  color: string;
  /** weekly-difference bands carry the coloured diff label markup. */
  label?: { text: string };
};
