/** Format a large Euro amount for compact dashboard stats. */
export function formatEuroStat(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("de", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} Mio.`;
  }
  return value.toLocaleString("de");
}
