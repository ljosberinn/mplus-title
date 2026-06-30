import { type ReactNode } from "react";
import { type IconType } from "react-icons";
import { FaPatreon, FaTwitter } from "react-icons/fa";
import { SiBuymeacoffee } from "react-icons/si";

import { ExternalLink } from "./ExternalLink";

type NavLinkVariant = "header" | "footer";

type NavLinkProps = {
  href?: string;
  children: string;
  icon: IconType;
  variant?: NavLinkVariant;
};

export function NavLink({
  href,
  children,
  icon: Icon,
  variant = "footer",
}: NavLinkProps): ReactNode {
  // header: clean text-only nav items (à la tailwindcss.com's Docs / Blog /
  // Showcase), muted with a subtle hover. footer: the original icon + label.
  if (variant === "header") {
    return (
      <li className="text-sm font-medium">
        {href ? (
          <ExternalLink
            className="text-gray-300 transition-colors duration-150 ease-in-out hover:text-white"
            href={href}
          >
            {children}
          </ExternalLink>
        ) : (
          children
        )}
      </li>
    );
  }

  const body = (
    <span className="md:flex md:items-center md:justify-end">
      <Icon className="mr-2 inline h-6 w-6" />
      {children}
    </span>
  );

  return (
    <li className="py-1 text-base leading-relaxed md:text-sm">
      {href ? (
        <ExternalLink
          className="transition-colors duration-150 ease-in-out hover:text-yellow-600"
          href={href}
        >
          {body}
        </ExternalLink>
      ) : (
        body
      )}
    </li>
  );
}

type SocialLinkProps = {
  variant?: NavLinkVariant;
};

export function BuyMeACoffee({ variant }: SocialLinkProps = {}): ReactNode {
  return (
    <NavLink
      href="https://www.buymeacoffee.com/rOSn8DF"
      icon={SiBuymeacoffee}
      variant={variant}
    >
      Buy Me A Coffee
    </NavLink>
  );
}

export function RaiderPatreon({ variant }: SocialLinkProps = {}): ReactNode {
  return (
    <NavLink
      href="https://www.patreon.com/RaiderIO"
      icon={FaPatreon}
      variant={variant}
    >
      Raider.IO Patreon
    </NavLink>
  );
}

export function WCLPatreon({ variant }: SocialLinkProps = {}): ReactNode {
  return (
    <NavLink
      href="https://www.patreon.com/warcraftlogs"
      icon={FaPatreon}
      variant={variant}
    >
      WCL Patreon
    </NavLink>
  );
}

export function Twitter({ variant }: SocialLinkProps = {}): ReactNode {
  return (
    <NavLink
      href="https://twitter.com/xepher1s"
      icon={FaTwitter}
      variant={variant}
    >
      Twitter
    </NavLink>
  );
}
