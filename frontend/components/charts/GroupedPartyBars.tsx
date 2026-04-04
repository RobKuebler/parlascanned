"use client";
import { PARTY_COLORS, FALLBACK_COLOR, sortParties } from "@/lib/constants";
import { HorizontalBarRow } from "@/components/charts/HorizontalBarRow";

/** Format a number as EUR with K/M suffix. */
export function formatEur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K €`;
  return `${Math.round(n)} €`;
}

export interface GroupedBarSection {
  /** Section header label. */
  label: string;
  /** Map of party name → numeric value. Parties not present are shown as 0. */
  partyValues: Record<string, number>;
  /** Max value for bar scaling. Defaults to the max across all parties in this section. */
  max?: number;
  /** Display formatter for the value column. Defaults to formatEur. */
  formatValue?: (v: number) => string;
  /** Bar color per party. Defaults to PARTY_COLORS[party]. */
  barColor?: (party: string) => string;
  /** Width of the value column in px. Defaults to 52. */
  valueWidth?: number;
  /**
   * "total" renders with uppercase gray header + border-top separator.
   * Use for summary rows like "Gesamt alle Kategorien".
   */
  variant?: "default" | "total";
  /** Opacity of the bar fill — use to visually de-emphasise a secondary metric. */
  fillOpacity?: number;
}

/**
 * Renders a list of sections, each with a header label and one HorizontalBarRow per party.
 * Use this as the building block for any new grouped horizontal bar chart.
 *
 * Example:
 *   const sections: GroupedBarSection[] = [
 *     { label: "Rubrik A", partyValues: { "SPD": 45000, "CDU/CSU": 32000 } },
 *     { label: "Gesamt", partyValues: totalByParty, variant: "total" },
 *   ];
 *   <GroupedPartyBars sections={sections} parties={sortedParties} />
 */
export function GroupedPartyBars({
  sections,
  parties: partiesProp,
  labelWidth = 72,
  barHeight = 7,
}: {
  sections: GroupedBarSection[];
  /** Party list in display order. Derived from sections via sortParties() if omitted. */
  parties?: string[];
  labelWidth?: number;
  barHeight?: number;
}) {
  const parties =
    partiesProp ??
    sortParties(
      Array.from(new Set(sections.flatMap((s) => Object.keys(s.partyValues)))),
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {sections.map((section) => {
        const {
          label,
          partyValues,
          formatValue = formatEur,
          barColor,
          valueWidth = 52,
          variant = "default",
          fillOpacity,
        } = section;
        const sectionMax =
          section.max ??
          Math.max(...parties.map((p) => partyValues[p] ?? 0), 1);
        const isTotal = variant === "total";

        return (
          <div
            key={label}
            style={
              isTotal
                ? {
                    borderTop: "1px solid #F0EEE9",
                    paddingTop: 14,
                    marginTop: 2,
                    marginBottom: 16,
                  }
                : { marginBottom: 16 }
            }
          >
            <p
              style={
                isTotal
                  ? {
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#9A9790",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 10,
                    }
                  : {
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#555",
                      marginBottom: 8,
                      lineHeight: 1.4,
                    }
              }
            >
              {label}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {parties.map((party) => {
                const value = partyValues[party] ?? 0;
                const color = barColor
                  ? barColor(party)
                  : (PARTY_COLORS[party] ?? FALLBACK_COLOR);
                return (
                  <HorizontalBarRow
                    key={party}
                    label={party}
                    labelWidth={labelWidth}
                    value={value}
                    max={sectionMax}
                    color={color}
                    displayValue={formatValue(value)}
                    barHeight={barHeight}
                    valueWidth={valueWidth}
                    fillOpacity={fillOpacity}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
