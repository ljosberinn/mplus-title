import clsx from "clsx";
import { type SVGProps } from "react";

export default function Patreon({
  className,
  ...props
}: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      viewBox="0 0 569 546"
      className={clsx("h-6 w-6", className)}
      strokeWidth={1.2}
      fill="#fff"
      {...props}
    >
      <circle cx={362.59} cy={204.59} r={204.59} />
      <path d="M0 0h100v545.8H0z" />
    </svg>
  );
}
