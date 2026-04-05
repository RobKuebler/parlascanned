"use client";
import { PARTY_COLORS, FALLBACK_COLOR, sortParties } from "@/lib/constants";
import { SidejobRecord, stripSoftHyphen } from "@/lib/data";
import { HorizontalBarRow } from "@/components/charts/HorizontalBarRow";
import {
  GroupedPartyBars,
  GroupedBarSection,
  formatEur,
} from "@/components/charts/GroupedPartyBars";

// ── Chart 1: Sidejobs per party ───────────────────────────────────────────────

export function SidejobsByPartyChart({ jobs }: { jobs: SidejobRecord[] }) {
  const counts: Record<string, number> = {};
  for (const j of jobs) {
    const party = stripSoftHyphen(j.party);
    if (party === "fraktionslos") continue;
    counts[party] = (counts[party] ?? 0) + 1;
  }
  const parties = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const max = counts[parties[0]] ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {parties.map((party) => (
        <HorizontalBarRow
          key={party}
          label={party}
          labelWidth={80}
          value={counts[party]}
          max={max}
          color={PARTY_COLORS[party] ?? FALLBACK_COLOR}
          displayValue={String(counts[party])}
          barHeight={8}
        />
      ))}
    </div>
  );
}

/**
 * Alias for the sidejobs page which imports IncomeByPartyChart.
 * Extra props (parties, politicians) are accepted but not used since
 * the chart now shows job counts rather than income totals.
 */
export function IncomeByPartyChart({
  jobs,
}: {
  jobs: SidejobRecord[];
  parties?: string[];
  politicians?: { politician_id: number; name: string; party: string }[];
}) {
  return <SidejobsByPartyChart jobs={jobs} />;
}

// ── Chart 2: Income by category ───────────────────────────────────────────────
// Category as section header, one bar per party below.
// Bottom "Gesamt" section sums all categories per party.

export function IncomeByCategoryChart({
  jobs,
  parties,
}: {
  jobs: SidejobRecord[];
  parties: string[];
}) {
  // Aggregate income per category per party
  const catMap = new Map<string, Map<string, number>>();
  for (const j of jobs) {
    const party = stripSoftHyphen(j.party);
    if (!parties.includes(party)) continue;
    if (!catMap.has(j.category_label)) catMap.set(j.category_label, new Map());
    const m = catMap.get(j.category_label)!;
    m.set(party, (m.get(party) ?? 0) + j.prorated_income);
  }

  // Sort categories by total income descending
  const sortedCats = Array.from(catMap.entries())
    .map(([cat, pm]) => ({
      cat,
      total: Array.from(pm.values()).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .map((x) => x.cat);

  // Totals per party across all categories (for Gesamt section)
  const totalByParty: Record<string, number> = {};
  for (const [, pm] of catMap)
    for (const [party, income] of pm)
      totalByParty[party] = (totalByParty[party] ?? 0) + income;

  const sections: GroupedBarSection[] = [
    ...sortedCats.map((cat) => ({
      label: cat,
      partyValues: Object.fromEntries(catMap.get(cat)!),
    })),
    {
      label: "Gesamt alle Kategorien",
      partyValues: totalByParty,
      variant: "total" as const,
    },
  ];

  return (
    <GroupedPartyBars
      sections={sections}
      parties={sortParties(parties)}
      allowGroupToggle
    />
  );
}

// ── Chart 3: Top topics ───────────────────────────────────────────────────────
// Topic as section header, one bar per party below.

export function TopTopicsChart({
  jobs,
  parties,
}: {
  jobs: SidejobRecord[];
  parties: string[];
}) {
  // Aggregate income per topic per party
  const topicMap = new Map<string, Map<string, number>>();
  for (const j of jobs) {
    const party = stripSoftHyphen(j.party);
    if (!parties.includes(party)) continue;
    for (const topic of j.topics) {
      if (!topicMap.has(topic)) topicMap.set(topic, new Map());
      const m = topicMap.get(topic)!;
      m.set(party, (m.get(party) ?? 0) + j.prorated_income);
    }
  }

  // Top 15 topics by total income
  const topTopics = Array.from(topicMap.entries())
    .map(([topic, pm]) => ({
      topic,
      total: Array.from(pm.values()).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)
    .map((x) => x.topic);

  const sections: GroupedBarSection[] = topTopics.map((topic) => ({
    label: topic,
    partyValues: Object.fromEntries(topicMap.get(topic)!),
  }));

  return (
    <GroupedPartyBars
      sections={sections}
      parties={sortParties(parties)}
      allowGroupToggle
    />
  );
}

// ── Chart 4: Top earners ──────────────────────────────────────────────────────

export function TopEarnersChart({
  jobs,
  politicians,
  parties,
}: {
  jobs: SidejobRecord[];
  politicians: { politician_id: number; name: string; party: string }[];
  parties: string[];
}) {
  const polMap = new Map(politicians.map((p) => [p.politician_id, p]));
  const byPol = new Map<number, number>();
  for (const j of jobs) {
    const party = stripSoftHyphen(polMap.get(j.politician_id)?.party ?? "");
    if (!parties.includes(party)) continue;
    byPol.set(
      j.politician_id,
      (byPol.get(j.politician_id) ?? 0) + j.prorated_income,
    );
  }

  const top = Array.from(byPol.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id, income]) => ({ pol: polMap.get(id), income }))
    .filter(
      (
        t,
      ): t is {
        pol: NonNullable<ReturnType<typeof polMap.get>>;
        income: number;
      } => t.pol != null,
    );

  const max = top[0]?.income ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {top.map(({ pol, income }, i) => (
        <HorizontalBarRow
          key={pol.politician_id}
          label={pol.name}
          labelWidth={155}
          value={income}
          max={max}
          color={PARTY_COLORS[stripSoftHyphen(pol.party)] ?? FALLBACK_COLOR}
          displayValue={formatEur(income)}
          valueWidth={52}
          rank={i + 1}
        />
      ))}
    </div>
  );
}

// ── Chart 5: Sidejob coverage per party ──────────────────────────────────────
// Rubric as section header, one bar per party below.

const COVERAGE_LABELS = {
  income: "Nebenverdienst ≥ 1.000 €/Monat",
  no_amount: "Nebentätigkeit ohne Einkommensangabe",
  none: "Kein Nebenjob",
} as const;

type CoverageKey = keyof typeof COVERAGE_LABELS;

export function SidejobCoverageByPartyChart({
  jobs,
  politicians,
}: {
  jobs: SidejobRecord[];
  politicians: { politician_id: number; name: string; party: string }[];
}) {
  const withIncome = new Set<number>();
  const withAnySidejob = new Set<number>();
  for (const j of jobs) {
    withAnySidejob.add(j.politician_id);
    if (j.income_level !== null) withIncome.add(j.politician_id);
  }

  type Counts = Record<CoverageKey, number> & { total: number };
  const byParty = new Map<string, Counts>();
  for (const pol of politicians) {
    const party = stripSoftHyphen(pol.party);
    if (party === "fraktionslos") continue;
    if (!byParty.has(party))
      byParty.set(party, { income: 0, no_amount: 0, none: 0, total: 0 });
    const c = byParty.get(party)!;
    c.total++;
    if (withIncome.has(pol.politician_id)) c.income++;
    else if (withAnySidejob.has(pol.politician_id)) c.no_amount++;
    else c.none++;
  }

  const parties = sortParties(Array.from(byParty.keys()));
  const keys: CoverageKey[] = ["income", "no_amount", "none"];

  const sections: GroupedBarSection[] = keys.map((key) => ({
    label: COVERAGE_LABELS[key],
    partyValues: Object.fromEntries(
      parties.map((party) => {
        const counts = byParty.get(party)!;
        const pct =
          counts.total > 0 ? Math.round((counts[key] / counts.total) * 100) : 0;
        return [party, pct];
      }),
    ),
    max: 100,
    formatValue: (v) => `${v}%`,
    barColor: (party) =>
      key === "none"
        ? "#D0CEC8"
        : key === "no_amount"
          ? (PARTY_COLORS[party] ?? FALLBACK_COLOR) + "99"
          : (PARTY_COLORS[party] ?? FALLBACK_COLOR),
    valueWidth: 36,
  }));

  return (
    <GroupedPartyBars sections={sections} parties={parties} allowGroupToggle />
  );
}
