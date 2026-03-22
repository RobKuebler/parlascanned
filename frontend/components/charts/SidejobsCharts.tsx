'use client'
import ReactECharts from 'echarts-for-react'
import { SidejobRecord } from '@/lib/data'
import { PARTY_COLORS, FALLBACK_COLOR } from '@/lib/constants'

// ── Chart 1: Income by party (sum + mean) ────────────────────────────────────
export function IncomeByPartyChart({ jobs, parties }: { jobs: SidejobRecord[]; parties: string[] }) {
  const byParty = new Map<string, number[]>()
  for (const j of jobs) {
    if (!byParty.has(j.party)) byParty.set(j.party, [])
    byParty.get(j.party)!.push(j.prorated_income)
  }
  const totals = parties.map((p) => byParty.get(p)?.reduce((a, b) => a + b, 0) ?? 0)
  const means = parties.map((p) => {
    const vals = byParty.get(p) ?? []
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })

  const makeOption = (data: number[], title: string) => ({
    animation: false,
    tooltip: { trigger: 'item', formatter: (p: { name: string; value: number }) => `<b>${p.name}</b><br/>${p.value.toLocaleString('de')} €` },
    xAxis: { type: 'category', data: parties, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${(v / 1000).toFixed(0)}k` } },
    series: [{
      type: 'bar', data: data.map((v, i) => ({ value: Math.round(v), name: parties[i], itemStyle: { color: PARTY_COLORS[parties[i]] ?? FALLBACK_COLOR } })),
      barMaxWidth: 48,
    }],
    grid: { left: 60, right: 16, top: 16, bottom: 40 },
    title,
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Summe</p>
        <ReactECharts option={makeOption(totals, 'Summe')} style={{ width: '100%', height: 280 }} notMerge />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Ø pro Abgeordnetem</p>
        <ReactECharts option={makeOption(means, 'Mittelwert')} style={{ width: '100%', height: 280 }} notMerge />
      </div>
    </div>
  )
}

// ── Chart 2: Income by category ───────────────────────────────────────────────
export function IncomeByCategoryChart({ jobs, parties }: { jobs: SidejobRecord[]; parties: string[] }) {
  const catSet = new Set(jobs.map((j) => j.category_label))
  const cats = Array.from(catSet).sort()
  const option = {
    animation: false,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${(v / 1000).toFixed(0)}k` } },
    yAxis: { type: 'category', data: cats.slice().reverse() },
    series: parties.map((party) => ({
      name: party, type: 'bar', stack: 'total',
      data: cats.map((cat) => {
        const sum = jobs.filter((j) => j.party === party && j.category_label === cat).reduce((s, j) => s + j.prorated_income, 0)
        return Math.round(sum)
      }).reverse(),
      itemStyle: { color: PARTY_COLORS[party] ?? FALLBACK_COLOR },
    })),
    grid: { left: 240, right: 16, top: 8, bottom: 48 },
  }
  return (
    <div className="overflow-x-auto">
      <ReactECharts option={option} style={{ width: '100%', minWidth: 500, height: Math.max(300, cats.length * 36 + 80) }} notMerge />
    </div>
  )
}

// ── Chart 3: Top topics ───────────────────────────────────────────────────────
export function TopTopicsChart({ jobs, parties }: { jobs: SidejobRecord[]; parties: string[] }) {
  // Explode and aggregate topics
  const topicMap = new Map<string, Map<string, number>>()
  for (const j of jobs) {
    for (const topic of j.topics) {
      if (!topicMap.has(topic)) topicMap.set(topic, new Map())
      const m = topicMap.get(topic)!
      m.set(j.party, (m.get(j.party) ?? 0) + j.prorated_income)
    }
  }
  const topTopics = Array.from(topicMap.entries())
    .map(([topic, partyMap]) => ({ topic, total: Array.from(partyMap.values()).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total).slice(0, 15).map((t) => t.topic)

  const option = {
    animation: false,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${(v / 1000).toFixed(0)}k` } },
    yAxis: { type: 'category', data: topTopics.slice().reverse() },
    series: parties.map((party) => ({
      name: party, type: 'bar', stack: 'total',
      data: topTopics.map((t) => Math.round(topicMap.get(t)?.get(party) ?? 0)).reverse(),
      itemStyle: { color: PARTY_COLORS[party] ?? FALLBACK_COLOR },
    })),
    grid: { left: 180, right: 16, top: 8, bottom: 48 },
  }
  return (
    <div className="overflow-x-auto">
      <ReactECharts option={option} style={{ width: '100%', minWidth: 500, height: Math.max(300, topTopics.length * 32 + 80) }} notMerge />
    </div>
  )
}

// ── Chart 4: Top earners ──────────────────────────────────────────────────────
export function TopEarnersChart({ jobs, politicians, parties }: { jobs: SidejobRecord[]; politicians: { politician_id: number; name: string; party: string }[]; parties: string[] }) {
  const polMap = new Map(politicians.map((p) => [p.politician_id, p]))
  const byPol = new Map<number, number>()
  for (const j of jobs) byPol.set(j.politician_id, (byPol.get(j.politician_id) ?? 0) + j.prorated_income)

  const top = Array.from(byPol.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([id, income]) => ({ pol: polMap.get(id), income }))
    .filter((t) => t.pol)

  // parties param is available for potential future use (e.g. filtering)
  void parties

  const option = {
    animation: false,
    tooltip: { trigger: 'item', formatter: (p: { name: string; value: number }) => `<b>${p.name}</b><br/>${p.value.toLocaleString('de')} €` },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${(v / 1000).toFixed(0)}k` } },
    yAxis: { type: 'category', data: top.map((t) => t.pol!.name).reverse() },
    series: [{
      type: 'bar',
      data: top.map((t) => ({
        value: Math.round(t.income), name: t.pol!.name,
        itemStyle: { color: PARTY_COLORS[t.pol!.party.replace(/\u00ad/g, '')] ?? FALLBACK_COLOR },
      })).reverse(),
      barMaxWidth: 32,
    }],
    grid: { left: 140, right: 24, top: 8, bottom: 40 },
  }
  return <ReactECharts option={option} style={{ width: '100%', height: Math.max(300, top.length * 28 + 60) }} notMerge />
}
