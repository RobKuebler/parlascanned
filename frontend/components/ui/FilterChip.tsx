import { FILTER_ACCENT } from "@/lib/constants";

interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

/** Toggle chip for filter presets (e.g. "Alle", "Unterschiedlich"). */
export function FilterChip({
  label,
  count,
  active,
  onClick,
  disabled,
  title,
}: FilterChipProps) {
  return (
    <span
      onClick={!disabled && !active ? onClick : undefined}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 11px",
        borderRadius: 6,
        background: active ? FILTER_ACCENT : "transparent",
        border: `1.5px solid ${active ? FILTER_ACCENT : "#C8CAD4"}`,
        fontSize: 12,
        fontWeight: 500,
        color: active ? "#fff" : "#555",
        cursor: !disabled && !active ? "pointer" : "default",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
      <span
        style={{
          color: active ? "#ffffffbb" : "#999",
          fontSize: 11,
          fontWeight: 400,
        }}
      >
        ({count})
      </span>
    </span>
  );
}
