"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav-items";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[#E3E0DA] z-50">
      <div className="flex justify-around items-center h-16">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 text-[10px] font-semibold tracking-wide transition-colors duration-150 ${
                active ? "text-[#4C46D9]" : "text-[#9A9790]"
              }`}
            >
              {icon(active, 20)}
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
