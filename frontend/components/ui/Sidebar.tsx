"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PeriodSelector } from "./PeriodSelector";
import { Logo } from "./Logo";
import { BundestagSeats } from "./BundestagSeats";
import { NAV_ITEMS } from "@/lib/nav-items";

export function Sidebar() {
  const rawPathname = usePathname();
  // Next.js may return trailing slashes (e.g. "/party-profile/") — strip them for comparison
  const pathname =
    rawPathname !== "/" ? rawPathname.replace(/\/$/, "") : rawPathname;
  return (
    <aside className="hidden md:flex flex-col w-[180px] shrink-0 h-screen sticky top-0 bg-[#1E1B5E]">
      {/* Logo */}
      <div className="flex justify-center pt-[14px] pb-[10px]">
        <div className="w-9 h-9 bg-[#4C46D9] rounded-[9px] flex items-center justify-center">
          <Logo size={22} />
        </div>
      </div>

      {/* Period selector */}
      <div className="px-[10px] mb-[14px]">
        <PeriodSelector variant="sidebar" />
      </div>

      {/* Divider */}
      <div className="mx-auto w-10 h-px bg-white/10 mb-[10px]" />

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2 flex-1">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 outline-none focus:outline-none transition-all duration-150 ${
                active
                  ? "bg-[#4C46D9]"
                  : "opacity-55 hover:opacity-90 hover:bg-white/5"
              }`}
            >
              <span
                className={`shrink-0 ${active ? "text-white" : "text-[#A8A5E0]"}`}
              >
                {icon(active, 20)}
              </span>
              <span
                className={`text-[13px] font-bold truncate ${active ? "text-white" : "text-[#A8A5E0]"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Seat distribution widget */}
      <div className="mx-auto w-10 h-px bg-white/10 mb-[10px]" />
      <div className="px-[10px] pb-[14px]">
        <BundestagSeats />
      </div>
    </aside>
  );
}
