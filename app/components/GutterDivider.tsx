import { type ReactNode } from "react";

// hatched divider (mirrors the page's side gutters) between the region/configure
// row and the extrapolation form. `-mx-6` bleeds it past main's padding so its
// `border-y` lines reach the side gutters.
const gutterDivider =
  "-mx-6 h-8 border-y border-y-(--pattern-fg) bg-[image:repeating-linear-gradient(315deg,_var(--pattern-fg)_0,_var(--pattern-fg)_1px,_transparent_0,_transparent_50%)] bg-[size:10px_10px] bg-fixed [--pattern-fg:var(--color-white)]/10";

export function GutterDivider(): ReactNode {
  return <div aria-hidden className={gutterDivider} />;
}
