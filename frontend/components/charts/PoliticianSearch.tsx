'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Politician, stripSoftHyphen } from '@/lib/data'
import { PARTY_COLORS, FALLBACK_COLOR, COLOR_SECONDARY } from '@/lib/constants'

interface Props {
  politicians: Politician[]
  selected: number[]                          // politician_ids (= selectedPolIds in page.tsx)
  onSelectionChange: (ids: number[]) => void  // = handleSelection in page.tsx
}

/** Truncates a string to maxLen characters, appending '…' if truncated. */
function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s
}

/** Search input + dropdown + chip list for selecting politicians, bidirectionally synced with the scatter plot. */
export function PoliticianSearch({ politicians, selected, onSelectionChange }: Props) {
  const [query, setQuery] = useState('')
  // isOpen is tracked independently from query so the dropdown stays open after a selection
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Build a lookup map for fast access by id
  const polMap = useMemo(() => new Map(politicians.map(p => [p.politician_id, p])), [politicians])

  // Filter politicians: name match (case-insensitive), not already selected
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const lowerQuery = query.toLowerCase()
  const results = query.length > 0
    ? politicians.filter(p =>
        !selectedSet.has(p.politician_id) &&
        p.name.toLowerCase().includes(lowerQuery)
      )
    : []

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setQuery('')
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    // Close dropdown when user manually clears input; open it when they type
    if (val.length === 0) setIsOpen(false)
    else setIsOpen(true)
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('')
      setIsOpen(false)
    }
  }, [])

  function selectPolitician(id: number) {
    onSelectionChange([...selected, id])
    setQuery('')
    // isOpen intentionally not set to false — dropdown stays open for continued multiselect
  }

  function removeChip(id: number) {
    onSelectionChange(selected.filter(x => x !== id))
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Chips for selected politicians */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selected.map(id => {
            const pol = polMap.get(id)
            if (!pol) return null
            const party = stripSoftHyphen(pol.party)
            const color = PARTY_COLORS[party] ?? FALLBACK_COLOR
            return (
              <span
                key={id}
                data-testid={`chip-${id}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 12,
                  background: '#f0f0f0', fontSize: 12, color: '#333',
                }}
              >
                <span
                  style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}
                />
                {truncate(pol.name, 20)}
                <span style={{ color: '#666', fontSize: 11 }}>{party}</span>
                <button
                  aria-label={`Entferne ${pol.name}`}
                  onClick={() => removeChip(id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, fontSize: 13, color: FALLBACK_COLOR, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Search row: input + clear-all button */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Politiker suchen…"
          style={{
            flex: 1, padding: '6px 10px', borderRadius: 8,
            border: '1px solid #ddd', fontSize: 13, outline: 'none',
          }}
        />
        {selected.length > 0 && (
          <button
            onClick={() => onSelectionChange([])}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12,
              border: '1px solid #ddd', background: '#fff', cursor: 'pointer', color: '#666',
              whiteSpace: 'nowrap',
            }}
          >
            Auswahl aufheben
          </button>
        )}
      </div>

      {/* Dropdown — visible when isOpen (stays open after selection for multiselect UX) */}
      {isOpen && (
        <ul
          role="listbox"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
            background: '#fff', border: '1px solid #ddd', borderRadius: 8,
            marginTop: 4, padding: 0, listStyle: 'none',
            maxHeight: 240, overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {results.length === 0 ? (
            <li style={{ padding: '8px 12px', color: COLOR_SECONDARY, fontSize: 13 }}>
              {query.length === 0 ? 'Tippe um zu suchen…' : 'Keine Ergebnisse'}
            </li>
          ) : (
            results.map(pol => {
              const party = stripSoftHyphen(pol.party)
              const color = PARTY_COLORS[party] ?? FALLBACK_COLOR
              return (
                <li
                  key={pol.politician_id}
                  role="option"
                  aria-selected={false}
                  onClick={() => selectPolitician(pol.politician_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <span
                    style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }}
                  />
                  <span>{pol.name}</span>
                  <span style={{ color: COLOR_SECONDARY, fontSize: 11, marginLeft: 'auto' }}>{party}</span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
