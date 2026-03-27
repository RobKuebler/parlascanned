"use client";
import { PeriodSelector } from "./PeriodSelector";
import { Logo } from "./Logo";

/** Fixed top header for mobile — shows logo + period selector. Hidden on md+. */
export function MobileHeader() {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-[68px] bg-[#1E1B5E]">
      {/* Logo */}
      <div className="w-8 h-8 bg-[#4C46D9] rounded-[9px] flex items-center justify-center shrink-0">
        <Logo size={20} />
      </div>

      {/* Period selector — label left, dropdown right */}
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/40 shrink-0">
          Bundestag
        </p>
        <div className="w-[130px]">
          <PeriodSelector variant="sidebar" showLabel={false} />
        </div>
      </div>
    </header>
  );
}
