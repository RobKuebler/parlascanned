/** Shared pill-style toggle/segmented control used throughout the dashboard. */
export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="px-4 py-1.5 rounded-full text-[12px] transition-colors cursor-pointer"
            style={{
              background: active ? "#1E1B5E" : "#fff",
              border: active ? "1px solid #1E1B5E" : "1px solid #dddaf0",
              color: active ? "#fff" : "#7872a8",
              fontWeight: active ? 600 : 400,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
