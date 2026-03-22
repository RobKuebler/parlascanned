'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Poll } from '@/lib/data'
import { COLOR_SECONDARY } from '@/lib/constants'

interface Props {
  polls: Poll[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

/** Truncates a string to maxLen characters, appending '…' if truncated. */
function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s
}

const ACCENT = '#4B6BFB'
const ACCENT_LIGHT = '#F0F4FF'
const ACCENT_BORDER = '#D0DCFF'
const BORDER = '#E2E5EE'
const BG_INPUT = '#FAFBFF'

/**
 * Search input + dropdown + chip multiselect for filtering the heatmap by poll topic.
 * Replaces the native <select multiple> with a custom, accessible UI.
 * isOpen is tracked separately from query so the dropdown stays open after a selection.
 */
export function PollFilter({ polls, selectedIds, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const pollMap = useMemo(
    () => new Map(polls.map(p => [p.poll_id, p])),
    [polls],
  )
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const results = useMemo(() => {
    if (query.length === 0) return []
    const lq = query.toLowerCase()
    return polls.filter(
      p => !selectedSet.has(p.poll_id) && p.topic.toLowerCase().includes(lq),
    )
  }, [polls, query, selectedSet])

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
    if (val.length === 0) setIsOpen(false)
    else setIsOpen(true)
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('')
      setIsOpen(false)
    }
  }, [])

  function selectPoll(id: number) {
    onChange([...selectedIds, id])
    setQuery('')
    // isOpen intentionally not closed — stays open for continued multiselect
  }

  function removePoll(id: number) {
    onChange(selectedIds.filter(x => x !== id))
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>

      {/* Selected poll chips */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {selectedIds.map(id => {
            const poll = pollMap.get(id)
            if (!poll) return null
            return (
              <span
                key={id}
                title={poll.topic}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 8px 3px 10px',
                  background: ACCENT_LIGHT,
                  border: `1px solid ${ACCENT_BORDER}`,
                  borderLeft: `3px solid ${ACCENT}`,
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#2D3A8C',
                  maxWidth: 320,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {truncate(poll.topic, 44)}
                </span>
                <button
                  aria-label={`Entferne ${poll.topic}`}
                  onClick={() => removePoll(id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 0 2px', fontSize: 15, color: '#8899DD',
                    lineHeight: 1, flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Search row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          {/* Search icon */}
          <svg
            width="14" height="14"
            viewBox="0 0 24 24" fill="none"
            stroke="#bbb" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)', pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Abstimmungen suchen…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '7px 10px 7px 30px',
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              fontSize: 13, outline: 'none',
              background: BG_INPUT,
              color: '#333',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => {
              e.target.style.borderColor = ACCENT
              e.target.style.boxShadow = `0 0 0 3px ${ACCENT}22`
            }}
            onBlur={e => {
              e.target.style.borderColor = BORDER
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>

        {selectedIds.length > 0 && (
          <button
            onClick={() => onChange([])}
            style={{
              padding: '7px 12px', borderRadius: 8, fontSize: 12,
              border: `1px solid ${BORDER}`,
              background: '#fff', cursor: 'pointer', color: COLOR_SECONDARY,
              whiteSpace: 'nowrap',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = ACCENT
              e.currentTarget.style.color = ACCENT
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = BORDER
              e.currentTarget.style.color = COLOR_SECONDARY
            }}
          >
            Auswahl aufheben
          </button>
        )}
      </div>

      {/* Count summary — shown when dropdown is closed and something is selected */}
      {selectedIds.length > 0 && !isOpen && (
        <div style={{ marginTop: 5, fontSize: 11, color: COLOR_SECONDARY, letterSpacing: '0.01em' }}>
          {selectedIds.length === 1
            ? '1 Abstimmung gefiltert'
            : `${selectedIds.length} Abstimmungen gefiltert`}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <ul
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30,
            background: '#fff',
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: 0,
            margin: 0,
            listStyle: 'none',
            boxShadow: `0 8px 24px ${ACCENT}14, 0 2px 8px rgba(0,0,0,0.06)`,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {results.length === 0 ? (
            <li style={{ padding: '10px 14px', color: COLOR_SECONDARY, fontSize: 13 }}>
              {query.length === 0 ? 'Tippe um zu suchen…' : 'Keine Ergebnisse'}
            </li>
          ) : (
            results.map((poll, i) => (
              <li
                key={poll.poll_id}
                role="option"
                aria-selected={false}
                onClick={() => selectPoll(poll.poll_id)}
                style={{
                  padding: '9px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#333',
                  lineHeight: 1.45,
                  borderBottom: i < results.length - 1 ? '1px solid #F3F4F8' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = ACCENT_LIGHT)}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {poll.topic}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
