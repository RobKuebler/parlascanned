"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav-items";

export function BottomNav() {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1E1B5E]">
      <div className="flex justify-around items-center h-16">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-opacity duration-150"
              style={{ opacity: active ? 1 : 0.45 }}
            >
              <span
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 ${
                  active ? "bg-[#4C46D9]" : ""
                }`}
              >
                <span style={{ color: "white" }}>{icon(active, 20)}</span>
              </span>
              <span
                className="text-[10px] font-bold tracking-wide"
                style={{ color: "white" }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
