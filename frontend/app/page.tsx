"use client";
import { Piazzolla } from "next/font/google";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "@/components/ui/Footer";
import { usePeriod } from "@/lib/period-context";
import {
  fetchPeriodFiles,
  stripSoftHyphen,
  type Politician,
  type SidejobsFile,
  type Poll,
} from "@/lib/data";
import { PAGE_META, type PageMeta } from "@/lib/page-meta";
import { useTranslation, useLanguage } from "@/lib/language-context";
import type { PageKey } from "@/lib/i18n/types";

const piazzolla = Piazzolla({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["italic", "normal"],
  display: "swap",
});

type SectionGroup = { label: string; keys: PageKey[] };

// Editorial section groupings — mirrors nav structure
const SECTION_GROUPS: Record<"de" | "en", SectionGroup[]> = {
  de: [
    { label: "Gesetzgebung", keys: ["vote_map", "motions", "speeches"] },
    {
      label: "Parteien & Analyse",
      keys: ["party_profile", "trends", "comments"],
    },
    { label: "Transparenz", keys: ["sidejobs", "potential_conflicts"] },
  ],
  en: [
    { label: "Legislative Process", keys: ["vote_map", "motions", "speeches"] },
    {
      label: "Parties & Analysis",
      keys: ["party_profile", "trends", "comments"],
    },
    { label: "Transparency", keys: ["sidejobs", "potential_conflicts"] },
  ],
};

type Stats = {
  politicians: number;
  parties: number;
  polls: number;
  sidejobs: number;
} | null;

export default function Home() {
  const t = useTranslation();
  const { language } = useLanguage();
  const { activePeriodId, periods } = usePeriod();
  const activePeriod = periods.find((p) => p.wahlperiode === activePeriodId);
  const [stats, setStats] = useState<Stats>(null);

  useEffect(() => {
    if (!activePeriodId) return;
    setStats(null);
    fetchPeriodFiles<{
      politicians: Politician[];
      sidejobs: SidejobsFile;
      polls: Poll[];
    }>(activePeriodId, {
      politicians: "politicians.json",
      sidejobs: "sidejobs.json",
      polls: "polls.json",
    })
      .then(({ politicians, sidejobs, polls }) => {
        setStats({
          politicians: politicians.length,
          parties: new Set(
            politicians
              .map((p) => stripSoftHyphen(p.party))
              .filter((p) => p !== "fraktionslos"),
          ).size,
          polls: polls.length,
          sidejobs: sidejobs.coverage.total,
        });
      })
      .catch(console.error);
  }, [activePeriodId]);

  const metaByKey = Object.fromEntries(
    PAGE_META.map((m) => [m.key, m]),
  ) as Record<PageKey, PageMeta>;
  const langKey: "de" | "en" = language === "en" ? "en" : "de";
  const sectionGroups = SECTION_GROUPS[langKey];

  // Compute sections with global sequential numbering (01–08)
  const numberedSections = (() => {
    let n = 0;
    return sectionGroups.map((group) => ({
      label: group.label,
      items: group.keys.map((key) => ({ ...metaByKey[key], itemIndex: n++ })),
    }));
  })();

  const statItems = [
    { value: stats?.politicians, label: t.home.stats.politicians },
    { value: stats?.parties, label: t.home.stats.parties },
    { value: stats?.polls, label: t.home.stats.polls },
    { value: stats?.sidejobs, label: t.home.stats.sidejobs },
  ];

  return (
    <>
      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        {/* Structural top rule */}
        <div className="mb-5" style={{ height: 3, background: "#1E1B5E" }} />

        {/* Eyebrow row */}
        <div className="flex items-center justify-between mb-2">
          <p
            className="text-[10px] font-extrabold tracking-[0.22em] uppercase"
            style={{ color: "#7872a8" }}
          >
            {t.home.eyebrow}
          </p>
          {activePeriod && (
            <p
              className="text-[10px] font-extrabold tracking-[0.14em] uppercase"
              style={{ color: "#7872a8" }}
            >
              {activePeriod.wahlperiode}. {t.home.period_label}
            </p>
          )}
        </div>

        {/* Wordmark — editorial serif */}
        <h1
          className={`${piazzolla.className} font-bold italic leading-none tracking-tight mb-4`}
          style={{ color: "#1E1B5E", fontSize: "clamp(44px, 6vw, 68px)" }}
        >
          Parlascanned
        </h1>

        {/* Subtitle */}
        <p
          className="text-[14px] leading-relaxed"
          style={{ color: "#5a556b", maxWidth: "60ch" }}
        >
          {t.home.subtitle}
        </p>

        {/* Divider */}
        <div className="mt-6" style={{ height: 1, background: "#dddaf0" }} />
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10 pb-8"
        style={{ borderBottom: "1px solid #dddaf0" }}
      >
        {statItems.map(({ value, label }) => (
          <div key={label} className="pt-1">
            <div
              className="font-black tabular-nums leading-none mb-1.5"
              style={{ color: "#1E1B5E", fontSize: "clamp(24px, 3vw, 34px)" }}
            >
              {value != null ? (
                value.toLocaleString(language)
              ) : (
                <span
                  className="skeleton-shimmer"
                  style={{
                    display: "inline-block",
                    width: 56,
                    height: 28,
                    borderRadius: 4,
                  }}
                />
              )}
            </div>
            <div
              className="text-[10px] font-extrabold tracking-[0.14em] uppercase"
              style={{ color: "#7872a8" }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Feature sections ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-10 stagger">
        {numberedSections.map(({ label, items }) => (
          <section key={label}>
            {/* Section header — editorial ruling line */}
            <div className="flex items-center gap-3 mb-5">
              <span
                className="text-[9px] font-extrabold tracking-[0.25em] uppercase shrink-0"
                style={{ color: "#7872a8" }}
              >
                {label}
              </span>
              <div style={{ flex: 1, height: 1, background: "#dddaf0" }} />
            </div>

            {/* Card grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map(({ href, color, key, itemIndex }) => {
                const pageTrans = t.pages[key];
                const displayNum = String(itemIndex + 1).padStart(2, "0");
                return (
                  <Link
                    key={href}
                    href={href}
                    className="group relative bg-white rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    style={{
                      border: "1px solid #dddaf0",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                    }}
                  >
                    {/* Decorative issue number — large, light opacity */}
                    <span
                      aria-hidden="true"
                      className="absolute pointer-events-none select-none font-black"
                      style={{
                        top: -10,
                        right: 8,
                        fontSize: 108,
                        lineHeight: 1,
                        color,
                        opacity: 0.06,
                      }}
                    >
                      {displayNum}
                    </span>

                    <div className="relative z-10 flex flex-col h-full p-5 md:p-6">
                      {/* Category tag */}
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: color }}
                        />
                        <span
                          className="text-[10px] font-extrabold tracking-[0.18em] uppercase"
                          style={{ color }}
                        >
                          {pageTrans.label}
                        </span>
                      </div>

                      {/* Title in editorial serif */}
                      <h2
                        className={`${piazzolla.className} font-bold italic leading-tight mb-3 flex-1`}
                        style={{ fontSize: 20, color: "#1E1B5E" }}
                      >
                        {pageTrans.title}
                      </h2>

                      {/* Description */}
                      <p
                        className="text-[13px] leading-relaxed"
                        style={{ color: "#5a556b" }}
                      >
                        {pageTrans.description}
                      </p>

                      {/* CTA */}
                      <div
                        className="mt-4 flex items-center gap-1.5"
                        style={{ color }}
                      >
                        <span className="text-[10px] font-extrabold tracking-[0.15em] uppercase">
                          {t.home.cta}
                        </span>
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="group-hover:translate-x-0.5 transition-transform duration-150"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Footer />
    </>
  );
}
