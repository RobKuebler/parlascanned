'use client'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { VoteRecord, Poll, Politician } from '@/lib/data'
import { VOTE_META, VOTE_NUMERIC } from '@/lib/constants'

interface Props {
  votes: VoteRecord[]
  polls: Poll[]
  politicians: Politician[]
  selectedPolIds: number[]
  selectedPollIds: number[]
}

export function VoteHeatmap({ votes, polls, politicians, selectedPolIds, selectedPollIds }: Props) {
  const polMap = new Map(politicians.map((p) => [p.politician_id, p]))
  const pollMap = new Map(polls.map((p) => [p.poll_id, p]))

  // Build lookup: politician_id → poll_id → answer
  const voteIndex = new Map<number, Map<number, string>>()
  for (const v of votes) {
    if (!voteIndex.has(v.politician_id)) voteIndex.set(v.politician_id, new Map())
    voteIndex.get(v.politician_id)!.set(v.poll_id, v.answer)
  }

  const pollsToShow = selectedPollIds.length > 0
    ? polls.filter((p) => selectedPollIds.includes(p.poll_id))
    : polls

  const xLabels = selectedPolIds.map((id) => {
    const pol = polMap.get(id)
    return pol ? `${pol.name} (${pol.party.replace(/\u00ad/g, '')})` : String(id)
  })
  const yLabels = pollsToShow.map((p) =>
    p.topic.length > 50 ? p.topic.slice(0, 47) + '…' : p.topic
  )

  // Build heatmap data: [xIndex, yIndex, numericValue]
  const data: [number, number, number][] = []
  pollsToShow.forEach((poll, yIdx) => {
    selectedPolIds.forEach((polId, xIdx) => {
      const answer = voteIndex.get(polId)?.get(poll.poll_id) ?? 'no_show'
      data.push([xIdx, yIdx, VOTE_NUMERIC[answer] ?? 0])
    })
  })

  const chartHeight = Math.max(300, 44 * pollsToShow.length + 80)

  const option: EChartsOption = {
    animation: false,
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const answerKey = Object.entries(VOTE_NUMERIC).find(([, v]) => v === p.data[2])?.[0] ?? 'no_show'
        const meta = VOTE_META[answerKey as keyof typeof VOTE_META]
        return `<b>${xLabels[p.data[0]]}</b><br/>${yLabels[p.data[1]]}<br/>${meta.label}`
      },
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      position: 'top',
      axisLabel: { rotate: -30, fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      inverse: true,
      axisLabel: { fontSize: 11 },
      splitLine: { show: false },
    },
    visualMap: {
      type: 'piecewise',
      show: false,
      pieces: [
        { gte: 0, lt: 1,  color: '#E0E0E0' },  // no_show
        { gte: 1, lt: 2,  color: '#E3000F' },  // no
        { gte: 2, lt: 3,  color: '#F5A623' },  // abstain
        { gte: 3, lte: 3, color: '#46962B' },  // yes
      ] as any,
    },
    series: [{
      type: 'heatmap',
      data,
      itemStyle: { borderWidth: 3, borderColor: '#fff' },
    }],
    grid: { left: 200, right: 16, top: 80, bottom: 16 },
  }

  return (
    <div className="overflow-x-auto">
      <ReactECharts
        option={option}
        style={{ width: '100%', minWidth: `${Math.max(400, selectedPolIds.length * 80)}px`, height: chartHeight }}
        notMerge
      />
    </div>
  )
}
