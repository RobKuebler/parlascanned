import {
  CARD_CLASS,
  CARD_PADDING,
  CARD_SHADOW,
  FALLBACK_COLOR,
  PARTY_COLORS,
} from "@/lib/constants";

interface Props {
  items: { party: string; count: number }[];
  label: string;
  sublabel: string;
}

/** Horizontal bar chart showing count per party — used for motions and keyword search results. */
export function MotionCountBars({ items, label, sublabel }: Props) {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const max = Math.max(...sorted.map((i) => i.count), 1);

  return (
    <section
      className={`${CARD_CLASS} ${CARD_PADDING}`}
      style={{ boxShadow: CARD_SHADOW }}
    >
      <h2
        className="font-extrabold text-[15px] mb-1"
        style={{ color: "#1E1B5E" }}
      >
        {label}
      </h2>
      <p className="text-[12px] mb-4" style={{ color: "#9A9790" }}>
        {sublabel}
      </p>
      <div className="flex flex-col gap-2">
        {sorted.map(({ party, count }) => {
          const pct = (count / max) * 100;
          const color = PARTY_COLORS[party] ?? FALLBACK_COLOR;
          return (
            <div key={party} className="flex items-center gap-3">
              <span
                className="text-[13px] w-20 shrink-0 truncate"
                style={{ color: "#171613" }}
              >
                {party}
              </span>
              <div
                className="flex-1 rounded-full"
                style={{ height: 8, background: "#F0EEE9" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: color,
                    minWidth: pct > 0 ? 3 : 0,
                  }}
                />
              </div>
              <span
                className="text-[11px] tabular-nums w-12 text-right shrink-0"
                style={{ color: "#9A9790" }}
              >
                {count.toLocaleString("de")}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
