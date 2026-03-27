import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Shared dropdown state for search-and-select components.
 *
 * Manages: isOpen flag, search query, outside-click close, Escape close.
 * Used by PollFilter and PoliticianSearch.
 */
export function useDropdown() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setQuery("");
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  /** Update query and open/close dropdown based on input content. */
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(val.length > 0);
  }

  /** Close dropdown and clear query on Escape. */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setQuery("");
      setIsOpen(false);
    }
  }, []);

  /** Clear query but keep dropdown open (for multiselect after selection). */
  function clearQuery() {
    setQuery("");
  }

  /** Open the dropdown (e.g. on input focus). */
  function open() {
    setIsOpen(true);
  }

  return {
    query,
    isOpen,
    containerRef,
    handleChange,
    handleKeyDown,
    clearQuery,
    open,
  };
}
