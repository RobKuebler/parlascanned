@AGENTS.md

## Charts

Für alle horizontalen Bar-Charts mit Rubrik-Header + Parteien darunter:
**`GroupedPartyBars`** aus `@/components/charts/GroupedPartyBars.tsx` verwenden.

    import { GroupedPartyBars, formatEur, type GroupedBarSection } from "@/components/charts/GroupedPartyBars";

    const sections: GroupedBarSection[] = [
      { label: "Rubrik A", partyValues: { "SPD": 45000, "CDU/CSU": 32000 } },
      { label: "Rubrik B", partyValues: { ... } },
      // Gesamt-Zeile mit border-top + uppercase-Header:
      { label: "Gesamt", partyValues: totalByParty, variant: "total" },
    ];

    <GroupedPartyBars sections={sections} parties={sortedParties} />

**Props pro Section** (alle optional außer `label` und `partyValues`):
- `max` — default: auto (Maximum aller Werte in der Section)
- `formatValue` — default: `formatEur`
- `barColor: (party) => string` — default: `PARTY_COLORS[party]`
- `valueWidth` — default: 52
- `variant: "total"` — uppercase grauer Header + border-top (für Gesamt-Zeilen)

**Props der Komponente** (alle optional außer `sections`):
- `parties` — default: auto aus sections via `sortParties()`
- `labelWidth` — default: 72
- `barHeight` — default: 7

Bestehende Beispiele: `IncomeByCategoryChart`, `TopTopicsChart`, `SidejobCoverageByPartyChart`.
