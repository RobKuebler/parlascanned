'use client'
import { useState } from 'react'
import { Poll } from '@/lib/data'

interface Props {
  polls: Poll[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

export function PollFilter({ polls, selectedIds, onChange }: Props) {
  const [query, setQuery] = useState('')
  const filtered = polls.filter((p) =>
    p.topic.toLowerCase().includes(query.toLowerCase())
  )
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        placeholder="Abstimmungen suchen…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <select
        multiple
        size={6}
        value={selectedIds.map(String)}
        onChange={(e) => {
          const ids = Array.from(e.target.selectedOptions).map((o) => Number(o.value))
          onChange(ids)
        }}
        className="w-full rounded-lg border border-gray-200 text-sm p-1 min-h-[44px]"
      >
        {filtered.map((p) => (
          <option key={p.poll_id} value={p.poll_id}>{p.topic}</option>
        ))}
      </select>
      {selectedIds.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="text-xs text-gray-400 underline text-left"
        >
          Auswahl aufheben
        </button>
      )}
    </div>
  )
}
