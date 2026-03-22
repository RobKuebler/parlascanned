# Parlascanned — Next.js Migration Design

**Date:** 2026-03-22
**Scope:** 1:1 migration of the Streamlit app to Next.js + ECharts + Vercel
**Branch:** `feat/nextjs-migration`

---

## Goals

- Replace Streamlit with Next.js for full layout and interactivity freedom
- Host on Vercel (free tier, never sleeps, static site)
- Keep all existing Python data pipeline (fetch, train, transforms) unchanged
- Maintain all existing features 1:1

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Built by Vercel, best integration, largest ecosystem |
| Charts | Apache ECharts (`echarts-for-react`) | Brush/lasso selection on scatter, heatmap, all chart types in one library |
| Styling | TailwindCSS | Utility-first, light theme, fast iteration |
| Hosting | Vercel | Free, static, never sleeps, auto-deploys from GitHub |
| Language | TypeScript | Type safety for data interfaces |

---

## Architecture

The app is a **fully static Next.js site**. No server runs at runtime — Vercel serves pre-built HTML/JS/CSS. All data is pre-computed at build time and served as static JSON files.

```
GitHub Actions (unchanged Python pipeline)
  → fetch_data.py       → data/*.csv
  → train_model.py      → outputs/*.csv
  → NEW: export_json.py → public/data/*.json
  → git push main
  → Vercel auto-deploys → next build → static HTML/JS/CSS
```

### Why static?

The app has no runtime server logic — all data is pre-computed CSVs and embeddings. Making it fully static means zero cold starts, unlimited free hosting, and no server to maintain.

---

## Data Pipeline Changes

One new script is added to the Python pipeline: `src/export_json.py`.

**Responsibility:** Read all CSVs (including running existing transforms from `transforms.py`), and write structured JSON files to `public/data/`.

**Pre-computed outputs per period:**
- `politicians_{period}.json` — politician metadata (name, party, gender, birth year, occupation, education)
- `embeddings_{period}.json` — x, y coordinates per politician
- `votes_{period}.json` — vote matrix (politician × poll), loaded lazily on selection
- `polls_{period}.json` — poll metadata
- `sidejobs_{period}.json` — side income declarations
- `cohesion_{period}.json` — pre-computed party cohesion scores (from `transforms.py`)
- `periods.json` — list of available periods with metadata

The transforms (cohesion, category pivots) stay in Python — no logic is re-implemented in TypeScript.

**GitHub Actions update:** Add `export_json` step after `train_model` in the workflow, before the Vercel deploy is triggered by the git push.

---

## File Structure

```
parlascanned/
  src/
    export_json.py          ← NEW: CSV → JSON export script
    fetch_data.py           ← unchanged
    model.py                ← unchanged
    train_model.py          ← unchanged
    transforms.py           ← unchanged
    storage.py              ← unchanged

  frontend/                 ← NEW: Next.js app root
    app/
      layout.tsx            ← sidebar navigation + period selector
      page.tsx              ← home page (feature cards)
      vote-map/page.tsx     ← scatter plot + heatmap
      party-profile/page.tsx← demographic charts
      sidejobs/page.tsx     ← side income charts
    components/
      charts/
        VoteMapScatter.tsx  ← ECharts scatter with brush selection
        VoteHeatmap.tsx     ← ECharts heatmap (voting records)
        CohesionChart.tsx   ← ECharts bar chart (party cohesion)
        SidejobsChart.tsx   ← ECharts charts (side income)
        PartyProfileCharts.tsx ← age, gender, profession, education
      ui/
        Sidebar.tsx         ← left nav + period selector
        PoliticianCard.tsx  ← info panel on selection
    lib/
      data.ts               ← JSON loading utilities + TypeScript interfaces
      constants.ts          ← party colors (ported from pages/constants.py)
    public/
      data/                 ← generated JSON files (committed by CI)
    package.json
    next.config.ts
    tailwind.config.ts
    tsconfig.json
```

The Next.js app lives in a `frontend/` subdirectory to keep it clearly separate from the Python codebase.

---

## Page Mapping

| Streamlit | Next.js route | Key charts |
|---|---|---|
| `pages/home.py` | `/` | Static feature cards |
| `pages/vote_map.py` | `/vote-map` | ECharts scatter (brush select) + heatmap |
| `pages/party_profile.py` | `/party-profile` | Bar, pie, histogram charts |
| `pages/sidejobs.py` | `/sidejobs` | Bar + category charts |

---

## Data Flow (Runtime)

```
Page loads
  → fetch /data/embeddings_{period}.json  (always)
  → fetch /data/politicians_{period}.json (always)
  → ECharts renders scatter plot

User draws brush selection on scatter
  → selected politician IDs captured via ECharts brush event
  → fetch /data/votes_{period}.json       (lazy, only on first selection)
  → fetch /data/polls_{period}.json       (lazy, only on first selection)
  → ECharts renders heatmap for selected politicians
```

The votes matrix is the largest file and is loaded lazily — only when the user makes a selection. All other data loads upfront on page visit.

---

## Error Handling & Loading States

- Each chart shows a skeleton spinner while its JSON loads
- If a period has no JSON data, it is excluded from the period selector
- Vote map shows an empty-state prompt ("Politiker auswählen, um ihre Abstimmungen zu sehen") when no selection is active
- Network errors show an inline error message per chart (no full-page crash)

---

## Testing

- All existing Python tests remain unchanged (`uv run pytest tests/`)
- Add TypeScript unit tests for `lib/data.ts`: JSON parsing, typed interfaces, edge cases (missing fields, empty arrays)
- No tests for chart components (visual output)
- `export_json.py` covered by a new Python test verifying output shape and required keys

---

## Deployment

1. Connect Vercel to the GitHub repo (one-time setup)
2. Set build root to `frontend/`, build command `next build`
3. Vercel auto-deploys on every push to `main`
4. Preview deployments created automatically for PRs

No environment variables needed (all data is static JSON).

---

## Out of Scope

- UI redesign (1:1 migration only)
- New features
- Dark mode
- Mobile responsiveness improvements
- Authentication
