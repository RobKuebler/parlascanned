"use client";
import { useMemo } from "react";
import { Poll } from "@/lib/data";
import { useTranslation } from "@/lib/language-context";
import {
  COLOR_SECONDARY,
  FILTER_ACCENT as ACCENT,
  FILTER_ACCENT_LIGHT as ACCENT_LIGHT,
  FILTER_BORDER as BORDER,
  truncateText as truncate,
} from "@/lib/constants";
import { useDropdown } from "@/hooks/useDropdown";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChip } from "@/components/ui/FilterChip";
import { RemovableChip } from "@/components/ui/RemovableChip";

interface Props {
  polls: Poll[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  /** Poll IDs where the selected politicians voted differently. Shown as a quick-filter chip. */
  divergentPollIds?: number[];
  /** Like divergentPollIds, but no_show is ignored — only actual votes compared. */
  divergentPresentPollIds?: number[];
}

/**
 * Search input + dropdown + chip multiselect for filtering the heatmap by poll topic.
 * Replaces the native <select multiple> with a custom, accessible UI.
 */
export function PollFilter({
  polls,
  selectedIds,
  onChange,
  divergentPollIds,
  divergentPresentPollIds,
}: Props) {
  const t = useTranslation();
  const {
    query,
    isOpen,
    containerRef,
    handleChange,
    handleKeyDown,
    clearQuery,
    open,
  } = useDropdown();

  const pollMap = useMemo(
    () => new Map(polls.map((p) => [p.poll_id, p])),
    [polls],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // True when the respective chip's filter is active (selectedIds matches that set exactly)
  const divergentActive = useMemo(() => {
    if (!divergentPollIds || divergentPollIds.length === 0) return false;
    if (selectedIds.length !== divergentPollIds.length) return false;
    return divergentPollIds.every((id) => selectedSet.has(id));
  }, [divergentPollIds, selectedIds, selectedSet]);

  const divergentPresentActive = useMemo(() => {
    if (!divergentPresentPollIds || divergentPresentPollIds.length === 0)
      return false;
    if (selectedIds.length !== divergentPresentPollIds.length) return false;
    return divergentPresentPollIds.every((id) => selectedSet.has(id));
  }, [divergentPresentPollIds, selectedIds, selectedSet]);

  const effectiveIds = useMemo(() => {
    if (divergentActive) return divergentPollIds!;
    if (divergentPresentActive) return divergentPresentPollIds!;
    if (selectedIds.length > 0) return selectedIds;
    return [];
  }, [
    divergentActive,
    divergentPresentActive,
    selectedIds,
    divergentPollIds,
    divergentPresentPollIds,
  ]);

  // When query is empty, show ALL unselected polls so the user can browse by scrolling.
  const results = useMemo(() => {
    const unselected = polls.filter((p) => !selectedSet.has(p.poll_id));
    if (query.length === 0) return unselected;
    const lq = query.toLowerCase();
    return unselected.filter((p) => p.topic.toLowerCase().includes(lq));
  }, [polls, query, selectedSet]);

  function selectPoll(id: number) {
    onChange([...selectedIds, id]);
    clearQuery();
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Search row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <SearchInput
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={open}
          placeholder={t.vote_map.poll_search_placeholder}
        />
      </div>

      {/* Chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {/* Filter preset chips */}
        <FilterChip
          label={t.vote_map.poll_filter_all}
          count={polls.length}
          active={false}
          onClick={() => onChange([])}
        />
        {divergentPollIds !== undefined && (
          <FilterChip
            label={t.vote_map.poll_filter_divergent}
            count={divergentPollIds.length}
            active={divergentActive}
            onClick={() => onChange(divergentPollIds)}
            disabled={divergentPollIds.length === 0}
            title={t.vote_map.poll_filter_divergent_title}
          />
        )}
        {divergentPresentPollIds !== undefined && (
          <FilterChip
            label={t.vote_map.poll_filter_divergent_present}
            count={divergentPresentPollIds.length}
            active={divergentPresentActive}
            onClick={() => onChange(divergentPresentPollIds)}
            disabled={divergentPresentPollIds.length === 0}
            title={t.vote_map.poll_filter_divergent_present_title}
          />
        )}
        {/* Separator */}
        {effectiveIds.length > 0 && (
          <div style={{ width: "100%", height: 0, margin: "2px 0" }} />
        )}
        {/* Individual poll chips */}
        {effectiveIds.map((id) => {
          const poll = pollMap.get(id);
          if (!poll) return null;
          return (
            <RemovableChip
              key={id}
              label={truncate(poll.topic, 40)}
              onRemove={() => onChange(effectiveIds.filter((x) => x !== id))}
              removeLabel={`Entferne ${poll.topic}`}
              title={poll.topic}
            />
          );
        })}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 30,
            background: "#fff",
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: 0,
            margin: 0,
            listStyle: "none",
            boxShadow: `0 8px 24px ${ACCENT}14, 0 2px 8px rgba(0,0,0,0.06)`,
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {query.length === 0 && results.length > 0 && (
            <li
              style={{
                padding: "6px 14px 5px",
                fontSize: 11,
                color: COLOR_SECONDARY,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                borderBottom: "1px solid #F3F4F8",
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              {results.length} Abstimmungen
            </li>
          )}

          {results.length === 0 ? (
            <li
              style={{
                padding: "10px 14px",
                color: COLOR_SECONDARY,
                fontSize: 13,
              }}
            >
              Keine Ergebnisse
            </li>
          ) : (
            results.map((poll, i) => (
              <li
                key={poll.poll_id}
                role="option"
                aria-selected={false}
                onClick={() => selectPoll(poll.poll_id)}
                style={{
                  padding: "9px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#333",
                  lineHeight: 1.45,
                  borderBottom:
                    i < results.length - 1 ? "1px solid #F3F4F8" : "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = ACCENT_LIGHT)
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                {poll.topic}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
