'use client'
import { useEffect, useRef, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { EmbeddingPoint, Politician } from '@/lib/data'
import { PARTY_COLORS, FALLBACK_COLOR, DARK_FILL_PARTY, MARKER_OUTLINE } from '@/lib/constants'

interface Props {
  embeddings: EmbeddingPoint[]
  politicians: Politician[]
  selectedIds: number[]
  onSelectionChange: (ids: number[]) => void
  height?: number
}

export function VoteMapScatter({
  embeddings, politicians, selectedIds, onSelectionChange, height = 600
}: Props) {
  const chartRef = useRef<ReactECharts>(null)
  const polMap = useMemo(
    () => new Map(politicians.map((p) => [p.politician_id, p])),
    [politicians]
  )

  // Group data by party for separate series (needed for per-party colors).
  const seriesByParty = useMemo(() => {
    const map = new Map<string, EmbeddingPoint[]>()
    for (const pt of embeddings) {
      const pol = polMap.get(pt.politician_id)
      const party = pol?.party.replace(/\u00ad/g, '') ?? 'fraktionslos'
      if (!map.has(party)) map.set(party, [])
      map.get(party)!.push(pt)
    }
    return map
  }, [embeddings, polMap])

  const option: EChartsOption = useMemo(() => ({
    animation: false,
    brush: {
      toolbox: ['rect', 'polygon', 'clear'],
      brushLink: 'all',
    },
    toolbox: {
      feature: {
        brush: {
          type: ['rect', 'polygon', 'clear'],
          // Large icon size for touch targets (min 44px)
          iconStyle: { borderWidth: 2 },
        },
      },
      right: 16,
      top: 8,
      itemSize: 20,
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const pol = polMap.get(params.data[2])
        if (!pol) return ''
        return `<b>${pol.name}</b><br/><span style="color:#999">${pol.party.replace(/\u00ad/g, '')}</span>`
      },
    },
    xAxis: { show: false },
    yAxis: { show: false },
    series: Array.from(seriesByParty.entries()).map(([party, points]) => ({
      type: 'scatter',
      name: party,
      data: points.map((pt) => [pt.x, pt.y, pt.politician_id]),
      symbolSize: 8,
      itemStyle: {
        color: PARTY_COLORS[party] ?? FALLBACK_COLOR,
        opacity: 0.82,
        borderColor: party === DARK_FILL_PARTY ? 'rgba(255,255,255,0.5)' : MARKER_OUTLINE,
        borderWidth: 1,
      },
    })),
    grid: { left: 0, right: 0, top: 40, bottom: 0 },
  }), [seriesByParty, polMap])

  // Handle brush selection events
  useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance()
    if (!chart) return
    const handler = (params: any) => {
      // dataIndex is per-series, not a global index — look up via chart option
      const seriesData = (chart.getOption() as any).series as any[]
      const ids: number[] = []
      for (const batch of params.batch ?? []) {
        for (const sel of batch.selected ?? []) {
          const series = seriesData[sel.seriesIndex]
          if (!series) continue
          for (const idx of sel.dataIndex ?? []) {
            const point = series.data[idx]
            if (point) ids.push(point[2])  // data format: [x, y, politician_id]
          }
        }
      }
      onSelectionChange([...new Set(ids)])
    }
    chart.on('brushselected', handler)
    return () => { chart.off('brushselected', handler) }
  }, [onSelectionChange])

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ width: '100%', height }}
      notMerge
    />
  )
}
