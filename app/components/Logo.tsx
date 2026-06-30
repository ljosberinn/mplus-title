import { type ReactNode } from "react";
import { NavLink } from "react-router";

export function Logo(): ReactNode {
  return (
    <NavLink to="/" className="flex flex-row items-center space-x-2">
      <img
        src="/logo.webp"
        alt="Logo"
        height="32"
        width="32"
        className="h-8 w-8"
      />

      <span className="inline text-base font-semibold tracking-tight">
        Title Cutoff Tracking
      </span>
    </NavLink>
  );
}
