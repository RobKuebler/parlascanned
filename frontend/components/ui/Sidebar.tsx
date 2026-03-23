"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PeriodSelector } from "./PeriodSelector";

// Icons copied from BottomNav — inlined here, no shared component
const NAV_ITEMS = [
  {
    href: "/",
    label: "Start",
    icon: (active: boolean) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    href: "/vote-map",
    label: "Karte",
    icon: (active: boolean) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
      >
        <circle cx="5.5" cy="8" r={active ? 2 : 1.6} />
        <circle cx="14" cy="5" r={active ? 2 : 1.6} />
        <circle cx="19" cy="12.5" r={active ? 2 : 1.6} />
        <circle cx="8.5" cy="16" r={active ? 2 : 1.6} />
        <circle cx="16.5" cy="18.5" r={active ? 2 : 1.6} />
      </svg>
    ),
  },
  {
    href: "/party-profile",
    label: "Parteien",
    icon: (active: boolean) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="7" width="4" height="14" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    href: "/sidejobs",
    label: "Einkünfte",
    icon: (active: boolean) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex flex-col w-[96px] shrink-0 h-screen sticky top-0 bg-[#1E1B5E]">
      {/* Logo */}
      <div className="flex justify-center pt-[14px] pb-[10px]">
        <div className="w-9 h-9 bg-[#4C46D9] rounded-[9px] flex items-center justify-center">
          <span className="text-white font-black text-sm">P</span>
        </div>
      </div>

      {/* Period selector */}
      <div className="px-[10px] mb-[14px]">
        <PeriodSelector variant="sidebar" />
      </div>

      {/* Divider */}
      <div className="mx-auto w-10 h-px bg-white/10 mb-[10px]" />

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-2 flex-1">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 transition-opacity duration-150 ${
                active ? "bg-[#4C46D9]" : "opacity-55 hover:opacity-85"
              }`}
            >
              <span className={active ? "text-white" : "text-[#A8A5E0]"}>
                {icon(active)}
              </span>
              <span
                className={`text-[6px] font-bold tracking-wide ${active ? "text-white" : "text-[#A8A5E0]"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
