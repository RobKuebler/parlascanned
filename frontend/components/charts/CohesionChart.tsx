'use client'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { CohesionRecord } from '@/lib/data'
import { PARTY_COLORS, FALLBACK_COLOR } from '@/lib/constants'

interface Props {
  cohesion: CohesionRecord[]
  height?: number
}

export function CohesionChart({ cohesion, height = 300 }: Props) {
  const option: EChartsOption = {
    animation: false,
    tooltip: {
      trigger: 'item',
      formatter: (p: any) =>
        `<b>${p.name}</b><br/>Ø Abstand: ${p.value.toFixed(3)}`,
    },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: cohesion.map((c) => c.label),
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: cohesion.map((c) => ({
        value: c.streuung,
        name: c.label,
        itemStyle: { color: PARTY_COLORS[c.party] ?? FALLBACK_COLOR },
      })),
      barMaxWidth: 32,
      label: { show: false },
    }],
    grid: { left: 80, right: 16, top: 8, bottom: 8 },
  }

  return (
    <ReactECharts
      option={option}
      style={{ width: '100%', height }}
      notMerge
    />
  )
}
