import { useRef, useEffect } from "react";

/**
 * Keeps a ref in sync with the latest value of a prop or state.
 *
 * Useful in D3 event handlers that are registered once but need to read
 * the latest React state without re-registering on every render.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
