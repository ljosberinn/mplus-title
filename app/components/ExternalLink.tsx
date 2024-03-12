import clsx from "clsx";
import { type HTMLAttributes, type ReactNode } from "react";

export type ExternalLinkProps = Pick<
  HTMLAttributes<"a">,
  "className" | "title"
> & {
  href: string;
  children: ReactNode;
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
      rel="noopener noreferrer"
      className={clsx("hover:underline", className)}
      title={title}
    >
      {children}
    </a>
  );
}
