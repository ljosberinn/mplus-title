import clsx from "clsx";
import type { ReactNode, HTMLAttributes } from "react";

export type ExternalLinkProps = Pick<
  HTMLAttributes<"a">,
  "className" | "title"
> & {
  href: string;
  children: ReactNode;
  "data-linkbox-overlay"?: boolean;
};

export function ExternalLink({
  href,
  children,
  className,
  title,
}: ExternalLinkProps): JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel={`noopener${href.includes("warcraftlogs") ? "" : " noreferrer"}`}
      className={clsx("hover:underline", className)}
      title={title}
    >
      {children}
    </a>
  );
}
