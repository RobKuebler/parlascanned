/**
 * Single source of truth for page metadata.
 * Used by PageHeader on each page AND to auto-generate dashboard feature cards.
 * Always edit here — never inline the same data in a page file.
 */

import type { PageKey } from "@/lib/i18n/types";

export interface PageMeta {
  href: string;
  /** Accent color — drives PageHeader border and dashboard icon background. */
  color: string;
  key: PageKey;
  /** If true, the dashboard card spans both columns on md+. */
  wide?: boolean;
}

// Order mirrors NAV_ITEMS: Legislative process → Parties & Analysis → Transparency
export const PAGE_META: PageMeta[] = [
  // --- Legislative process ---
  {
    href: "/vote-map",
    color: "#4C46D9",
    key: "vote_map",
  },
  {
    href: "/motions",
    color: "#1d4ed8",
    key: "motions",
  },
  {
    href: "/speeches",
    color: "#0d7456",
    key: "speeches",
  },
  {
    href: "/comments",
    color: "#7c3aed",
    key: "comments",
  },
  // --- Parties & Analysis ---
  {
    href: "/party-profile",
    color: "#0284c7",
    key: "party_profile",
  },
  {
    href: "/trends",
    color: "#0f766e",
    key: "trends",
  },
  // --- Transparency ---
  {
    href: "/sidejobs",
    color: "#b45309",
    key: "sidejobs",
  },
  {
    href: "/potential-conflicts",
    color: "#be123c",
    key: "potential_conflicts",
  },
];
