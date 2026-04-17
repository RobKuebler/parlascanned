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

// One accent color per section group — not per page.
// Legislative: brand purple-blue (procedural authority)
// Parties & Analysis: teal (analytical/comparative)
// Transparency: amber (investigative scrutiny)
const C_LEGISLATIVE = "#4C46D9";
const C_ANALYSIS = "#0f766e";
const C_TRANSPARENCY = "#b45309";

// Order mirrors NAV_ITEMS: Legislative process → Parties & Analysis → Transparency
export const PAGE_META: PageMeta[] = [
  // --- Legislative process ---
  { href: "/vote-map", color: C_LEGISLATIVE, key: "vote_map" },
  { href: "/motions", color: C_LEGISLATIVE, key: "motions" },
  { href: "/speeches", color: C_LEGISLATIVE, key: "speeches" },
  { href: "/comments", color: C_ANALYSIS, key: "comments" },
  // --- Parties & Analysis ---
  { href: "/party-profile", color: C_ANALYSIS, key: "party_profile" },
  { href: "/trends", color: C_ANALYSIS, key: "trends" },
  // --- Transparency ---
  { href: "/sidejobs", color: C_TRANSPARENCY, key: "sidejobs" },
  {
    href: "/potential-conflicts",
    color: C_TRANSPARENCY,
    key: "potential_conflicts",
  },
];
