# Parlascanned — Next.js Migration Design

**Date:** 2026-03-22
**Scope:** 1:1 migration of the Streamlit app to Next.js + ECharts + Vercel, with mobile responsiveness
**Branch:** `feat/nextjs-migration`

---

## Goals

- Replace Streamlit with Next.js for full layout and interactivity freedom
- Host on Vercel (free tier, never sleeps, static site)
- Keep all existing Python data pipeline (fetch, train, transforms) unchanged
- Maintain all existing features 1:1
- Fully usable on mobile devices (this was a major Streamlit limitation)

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
  → NEW: export_json.py → frontend/public/data/*.json
  → git push main (including frontend/public/data/)
  → Vercel auto-deploys → next build → static HTML/JS/CSS
```

### Why static?

The app has no runtime server logic — all data is pre-computed CSVs and embeddings. Making it fully static means zero cold starts, unlimited free hosting, and no server to maintain.

---

## Data Pipeline Changes

One new script is added to the Python pipeline: `src/export_json.py`.

**Responsibility:** Read all CSVs, run existing transforms from `transforms.py` (cohesion, income proration, category pivots), and write structured JSON files to `frontend/public/data/`.

**`frontend/public/data/` must be tracked in git** (do not add it to `.gitignore`). The CI commit step must explicitly `git add frontend/public/data/` so Vercel picks up the latest data on each deploy.

### JSON files per period

#### `politicians_{period}.json`

List of politician objects. Field names match the CSV column names exactly:

```json
[{
  "politician_id": 123,
  "name": "Jane Doe",
  "party": "SPD",
  "sex": "weiblich",
  "year_of_birth": 1975,
  "occupation": "Juristin",
  "education": "Hochschulabschluss",
  "field_title": "Dr."
}]
```

Note: `politician_id` (not `id`), `name` (not `label`), `sex` (not `gender`), `field_title` (used for academic title chart in party-profile).

#### `embeddings_{period}.json`

Only 2D embeddings are exported (the 3D case is explicitly out of scope — see note below). The `dimensions` field is included to allow future extension.

```json
{
  "dimensions": 2,
  "data": [{"id": 123, "x": 0.42, "y": -0.18}]
}
```

**Note on 3D:** `train_model.py` supports `--factors 3`, but `export_json.py` always reads the `x` and `y` columns only. If a 3D model is ever trained, the export script should log a warning and fall back to 2D. Full 3D support is deferred to a future iteration.

#### `votes_{period}.json`

Long-format table — preserves the CSV structure directly, one object per vote:

```json
[{"politician_id": 123, "poll_id": 456, "answer": "yes"}]
```

This file is the largest (700+ politicians × 500+ polls ≈ several hundred thousand rows). **Check file size before deploying** — Vercel's static asset limit is 100 MB per file. If it exceeds ~20 MB in practice, consider splitting by poll batch or compressing.

The file is loaded lazily — only when the user makes a selection on the vote map.

#### `polls_{period}.json`

Field names match `polls.csv` exactly. There is no `date` field in the source data.

```json
[{"poll_id": 456, "topic": "Haushalt 2024"}]
```

Loaded alongside `votes_{period}.json` on first selection. Used to populate the poll multiselect filter on the vote map page.

#### `sidejobs_{period}.json`

Income proration is computed by `export_json.py` using `periods.csv` for the period's `start_date` and `end_date`. Raw income values are **not** exposed — only the prorated amounts. The pipe-separated `topics` field is pre-exploded into an array.

The file is a single object (not a flat array) to accommodate top-level metadata:

```json
{
  "jobs": [{
    "politician_id": 123,
    "job_title": "Rechtsanwalt",
    "party": "SPD",
    "income_level": 2,
    "prorated_income": 45000.0,
    "topics": ["Recht", "Wirtschaft"],
    "has_amount": true
  }],
  "coverage": {"total": 520, "with_amount": 310}
}
```

`coverage` powers the "X of Y Nebentätigkeiten ohne Betrag" info box.

#### `cohesion_{period}.json`

Output of `compute_cohesion()` from `transforms.py` — average distance of each politician from their party's centroid in embedding space. `export_json.py` passes the embeddings CSV (which already contains `x`, `y`, `party` columns) directly to `compute_cohesion()`.

`label` is `party` with the soft-hyphen character stripped (required for correct display of "GRÜNE" in the frontend — the soft-hyphen is present in the raw party name from the API).

```json
[{"party": "GRÜNE", "label": "GRÜNE", "streuung": 0.23}]
```

#### `periods.json`

Field name `period_id` matches `periods.csv` exactly.

```json
[{"period_id": 161, "label": "20. Bundestag (2025–2029)", "has_data": true}]
```

`has_data` is `true` only if all required JSON files exist for that period. The period selector only shows periods where `has_data` is `true`.

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
      layout.tsx            ← sidebar navigation + period selector + footer
      page.tsx              ← home page (feature cards)
      vote-map/page.tsx     ← scatter plot + heatmap
      party-profile/page.tsx← demographic charts
      sidejobs/page.tsx     ← side income charts
    components/
      charts/
        VoteMapScatter.tsx      ← ECharts scatter with brush selection
        VoteHeatmap.tsx         ← ECharts heatmap (voting records)
        PollFilter.tsx          ← multiselect for poll filtering
        CohesionChart.tsx       ← ECharts bar chart (party cohesion)
        SidejobsCharts.tsx      ← 4 ECharts charts (see sidejobs section)
        AgeDistribution.tsx     ← ECharts raincloud (violin + jitter)
        GenderChart.tsx         ← ECharts grouped bar
        DeviationHeatmap.tsx    ← ECharts heatmap with deviation coloring
      ui/
        Sidebar.tsx             ← left nav + period selector
        PoliticianCard.tsx      ← info panel on selection
        Footer.tsx              ← attribution links (robkuebler.github.io, GitHub, abgeordnetenwatch.de)
    lib/
      data.ts               ← JSON loading utilities + TypeScript interfaces
      constants.ts          ← party colors (ported from pages/constants.py)
    public/
      data/                 ← generated JSON files (committed by CI, tracked in git)
    package.json
    next.config.ts
    tailwind.config.ts
    tsconfig.json
```

---

## Page Mapping

| Streamlit | Next.js route | Charts |
|---|---|---|
| `pages/home.py` | `/` | Static feature cards |
| `pages/vote_map.py` | `/vote-map` | Scatter (brush select), heatmap, cohesion bar chart |
| `pages/party_profile.py` | `/party-profile` | Age raincloud, gender grouped bar, 3× deviation heatmap (Berufe, Ausbildung/Studienrichtung, Abschlussniveau) |
| `pages/sidejobs.py` | `/sidejobs` | Themenfelder bar, Einkommen nach Kategorie bar, Einkommen nach Partei bar, Top-Verdiener bar, coverage info box |

---

## Data Flow (Runtime)

```
Vote map page loads
  → fetch /data/embeddings_{period}.json  (always, upfront)
  → fetch /data/politicians_{period}.json (always, upfront)
  → ECharts renders scatter plot

User draws brush selection on scatter
  → selected politician IDs captured via ECharts brush event
  → fetch /data/votes_{period}.json       (lazy, on first selection)
  → fetch /data/polls_{period}.json       (lazy, on first selection)
  → ECharts renders heatmap for selected politicians × all polls
  → poll multiselect populated from polls_{period}.json

User applies poll multiselect filter
  → filter votes data client-side by selected poll IDs
  → heatmap re-renders with filtered polls
```

---

## Chart Implementation Notes

### Vote map scatter — ECharts brush selection
ECharts `brush` component with `brushType: 'rect'` and `brushMode: 'single'`. On `brushselected` event, extract `dataIndex` array and map to politician IDs. Pass selected IDs to `VoteHeatmap` via React state.

### Deviation heatmap (party-profile)
ECharts heatmap colored by deviation from Bundestag average (percentage points). Cell value = `party_share - bundestag_share`. Color scale: diverging (negative/below-average = red, zero = white, positive/above-average = blue), matching the current Streamlit app ("Blau = überproportional, rot = unterproportional"). Text overlay shows `+X pp` / `-X pp`. This pre-computation happens in `export_json.py`.

### Age distribution — raincloud (party-profile)
ECharts custom series combining a half-violin (density estimate) and jittered scatter (individual politicians). This is the most complex chart to implement in ECharts and may require a custom render item function.

### Sidejobs topics — pre-exploded
`topics` field in `sidejobs_{period}.json` is already an array (pre-exploded from the pipe-separated CSV column by `export_json.py`). The frontend aggregates counts client-side for the bar chart.

---

## Error Handling & Loading States

- Each chart shows a skeleton spinner while its JSON loads
- If a period has no data (`has_data: false` in `periods.json`), it is excluded from the period selector
- Vote map shows an empty-state prompt ("Politiker auswählen, um ihre Abstimmungen zu sehen") when no selection is active
- Network errors show an inline error message per chart (no full-page crash)

---

## CI/CD

### GitHub Actions update

The `export_json` step is added inside `train_model.yml`, after the model training step and before the commit:

```yaml
- name: Export JSON for frontend
  run: uv run python src/export_json.py

- name: Commit updated data
  run: |
    git add outputs/ frontend/public/data/
    git diff --staged --quiet || git commit -m "model: aktualisiere Embeddings und JSON $(date -u +%Y-%m-%d)"
    git push
```

Vercel then auto-deploys via its GitHub integration when the push lands on `main`.

### Vercel setup (one-time)

1. Connect Vercel to the GitHub repo
2. Set **Root Directory** to `frontend/`
3. Build command: `next build`
4. No environment variables needed

---

## Testing

- All existing Python tests remain unchanged (`uv run pytest tests/`)
- New Python test for `export_json.py`: verify output files exist and have the correct top-level keys and non-empty data arrays for a known period
- TypeScript unit tests for `lib/data.ts`: JSON parsing, typed interfaces, edge cases (missing fields, empty arrays)
- No tests for chart components (visual output)

---

## Deployment Notes

- **Asset size:** Check `votes_{period}.json` file size before first deploy. Vercel static asset limit is 100 MB per file. If the file exceeds ~20 MB, consider splitting or filtering to only the polls shown in the UI.
- **`frontend/public/data/` in git:** This directory must be tracked (not gitignored). A standard Next.js `.gitignore` template does not exclude `public/data/`, but verify this during setup.

---

## Mobile Responsiveness

TailwindCSS breakpoints handle layout changes. ECharts charts are responsive by default (they fill their container width). The main challenges are navigation and the scatter plot brush selection.

### Navigation — Sidebar → Bottom tab bar

On desktop: left sidebar with nav links + period selector (as designed).
On mobile (`< md` breakpoint): sidebar hidden, replaced by a **bottom tab bar** with icons for each page. The period selector moves to a top dropdown or sheet triggered by a button.

### Charts on mobile

All ECharts charts set `width: '100%'` and `height: 'auto'` (or a fixed px height). On mobile, chart heights are reduced to avoid excessive scrolling:

| Chart | Desktop height | Mobile height |
|---|---|---|
| Scatter (vote map) | 600px | 350px |
| Heatmap | auto (row × politicians) | same, horizontal scroll if needed |
| Bar/category charts | 400px | 300px |

### Scatter brush selection on mobile

ECharts brush works with touch events natively — no extra code needed. However, the brush toolbar (lasso/box/clear buttons) must be large enough for touch targets (min 44×44px). Use ECharts `toolbox` with explicit icon sizes.

### Heatmap on mobile

The voting heatmap (politicians × polls) can be wide. On mobile it scrolls horizontally inside a `overflow-x: auto` container — same pattern as data tables on mobile.

### General rules

- Minimum touch target size: 44×44px for all interactive elements
- No horizontal overflow on any page (except the heatmap container which scrolls intentionally)
- Font sizes do not shrink below readable size (Tailwind `text-sm` minimum)
- Period selector and page title always visible without scrolling on mobile

---

## Out of Scope

- UI redesign (1:1 migration only)
- New features
- Dark mode
- Authentication
- 3D scatter plot (deferred — export always uses 2D)
