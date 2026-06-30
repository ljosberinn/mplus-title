import type { ReactNode } from "react";

import { Logo } from "./Logo";
import { BuyMeACoffee, RaiderPatreon, Twitter, WCLPatreon } from "./NavLink";
import { SeasonMenu } from "./SeasonMenu";

export function Header(): ReactNode {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-900/80 text-stone-100 backdrop-blur print:hidden">
      <nav className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-6">
        <ul>
          <li>
            <Logo />
          </li>
        </ul>
        <ul className="hidden items-center gap-x-6 lg:flex">
          <BuyMeACoffee variant="header" />
          <RaiderPatreon variant="header" />
          <WCLPatreon variant="header" />
          <Twitter variant="header" />
        </ul>
        <SeasonMenu />
      </nav>
    </header>
  );
}
