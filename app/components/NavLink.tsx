import { type IconType } from "react-icons";
import { FaPatreon, FaTwitter } from "react-icons/fa";
import { SiBuymeacoffee } from "react-icons/si";

import { ExternalLink } from "./ExternalLink";
import { type ReactNode } from "react";

type NavLinkProps = {
  href?: string;
  children: string;
  icon: IconType;
};

export function NavLink({
  href,
  children,
  icon: Icon,
}: NavLinkProps): ReactNode {
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

export function BuyMeACoffee(): ReactNode {
  return (
    <NavLink href="https://www.buymeacoffee.com/rOSn8DF" icon={SiBuymeacoffee}>
      Buy Me A Coffee
    </NavLink>
  );
}

export function RaiderPatreon(): ReactNode {
  return (
    <NavLink href="https://www.patreon.com/RaiderIO" icon={FaPatreon}>
      Raider.IO Patreon
    </NavLink>
  );
}

export function WCLPatreon(): ReactNode {
  return (
    <NavLink href="https://www.patreon.com/warcraftlogs" icon={FaPatreon}>
      WCL Patreon
    </NavLink>
  );
}

export function Twitter(): ReactNode {
  return (
    <NavLink href="https://twitter.com/xepher1s" icon={FaTwitter}>
      Twitter
    </NavLink>
  );
}
