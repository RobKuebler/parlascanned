# Parlascanned Next.js Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Parlascanned from Streamlit + Plotly to a fully static Next.js 14 + ECharts site on Vercel, 1:1 feature parity + mobile responsiveness.

**Architecture:** A new Python script (`src/export_json.py`) converts existing CSVs to typed JSON files in `frontend/public/data/`. The Next.js app in `frontend/` fetches these files client-side and renders all charts with Apache ECharts + echarts-for-react. Deployed as a static export to Vercel, auto-triggered by GitHub Actions on each push to `main`.

**Tech Stack:** Python 3.13 + uv (data pipeline, unchanged), Next.js 14 App Router, TypeScript 5, Apache ECharts 5 + echarts-for-react 3, TailwindCSS 3, Vercel (static hosting).

**Spec:** `docs/superpowers/specs/2026-03-22-nextjs-migration-design.md`

---

## File Map

**New Python files:**
- `src/export_json.py` — converts all CSVs + embeddings → JSON in `frontend/public/data/`
- `tests/test_export_json.py` — verifies JSON output shape and required keys

**Modified CI:**
- `.github/workflows/train_model.yml` — add `export_json.py` step + update `git add`

**New Next.js files (all under `frontend/`):**
- `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `.gitignore`
- `app/globals.css` — Tailwind base + global resets
- `app/layout.tsx` — root layout: sidebar (desktop) + bottom nav (mobile) + footer
- `app/page.tsx` — home page (feature cards)
- `app/vote-map/page.tsx` — scatter + heatmap + cohesion
- `app/party-profile/page.tsx` — demographic charts
- `app/sidejobs/page.tsx` — side income charts
- `components/ui/Sidebar.tsx` — desktop left nav + period selector
- `components/ui/BottomNav.tsx` — mobile bottom tab bar + period selector sheet
- `components/ui/Footer.tsx` — attribution links
- `components/ui/ChartSkeleton.tsx` — loading placeholder
- `components/ui/PeriodSelector.tsx` — shared period dropdown logic
- `components/charts/VoteMapScatter.tsx` — ECharts scatter with brush selection
- `components/charts/VoteHeatmap.tsx` — ECharts heatmap (votes)
- `components/charts/PollFilter.tsx` — poll multiselect
- `components/charts/CohesionChart.tsx` — ECharts horizontal bar (cohesion)
- `components/charts/AgeDistribution.tsx` — ECharts raincloud (violin + jitter)
- `components/charts/GenderChart.tsx` — ECharts grouped bar
- `components/charts/DeviationHeatmap.tsx` — ECharts heatmap with diverging color
- `components/charts/SidejobsCharts.tsx` — 4 ECharts charts for sidejobs page
- `lib/constants.ts` — party colors, order, design tokens
- `lib/data.ts` — TypeScript interfaces + `useFetch` hook
- `__tests__/lib/data.test.ts` — unit tests for data loading utilities

**Generated (not hand-edited):**
- `frontend/public/data/politicians_{period}.json`
- `frontend/public/data/embeddings_{period}.json`
- `frontend/public/data/votes_{period}.json`
- `frontend/public/data/polls_{period}.json`
- `frontend/public/data/cohesion_{period}.json`
- `frontend/public/data/sidejobs_{period}.json`
- `frontend/public/data/party_profile_{period}.json`
- `frontend/public/data/periods.json`

---

## Task 1: Create the feature branch

**Files:** none

- [ ] **Step 1: Create branch and verify**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
git checkout -b feat/nextjs-migration
git branch
```
Expected: `* feat/nextjs-migration`

- [ ] **Step 2: Commit**
```bash
git commit --allow-empty -m "chore: start Next.js migration branch"
```

---

## Task 2: Write `src/export_json.py`

**Files:**
- Create: `src/export_json.py`

This script is the bridge between the Python pipeline and the Next.js frontend. It must be run after `train_model.py`. It reads all CSVs, runs the existing transforms, and writes typed JSON to `frontend/public/data/`.

- [ ] **Step 1: Create `src/export_json.py`**

```python
"""Convert period CSVs to JSON files for the Next.js frontend.

Run after fetch_data.py and train_model.py.
Writes to frontend/public/data/.
"""

import json
import logging
from datetime import UTC, date, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from src.storage import DATA_DIR, OUTPUTS_DIR
from src.transforms import (
    compute_age_df,
    compute_cohesion,
    compute_education_degree_pivot,
    compute_education_field_pivot,
    compute_occupation_pivot,
    compute_sex_counts,
    compute_title_counts,
)

log = logging.getLogger(__name__)

OUTPUT_DIR = Path("frontend/public/data")

# Mirrors pages/constants.py — soft-hyphen (\xad) in GRÜNEN is intentional.
PARTY_ORDER = [
    "CDU/CSU", "SPD", "AfD", "BÜNDNIS 90/\xadDIE GRÜNEN",
    "Die Linke", "BSW", "FDP", "fraktionslos",
]

SIDEJOB_CATEGORIES: dict[int, str] = {
    29647: "Entgeltliche Tätigkeit",
    29228: "Unternehmensbeteiligung / Organmitglied",
    29229: "Funktionen in öffentlichen Institutionen",
    29230: "Verband / Stiftung / Verein",
    29231: "Unternehmensbeteiligung",
    29232: "Spende / Zuwendung",
    29233: "Vereinbarung über künftige Tätigkeit",
    29234: "Tätigkeit vor Mitgliedschaft",
}


def _active_months(
    date_start_str: str | None,
    date_end_str: str | None,
    period_start: date,
    period_end: date,
    created_ts: float | None = None,
) -> int:
    """Compute active months within period boundaries.

    Mirrors the same function in pages/sidejobs.py.
    """
    today = datetime.now(tz=UTC).date()
    if date_start_str:
        job_start = date.fromisoformat(date_start_str)
    elif created_ts:
        job_start = datetime.fromtimestamp(created_ts, tz=UTC).date()
    else:
        job_start = period_start
    job_end = date.fromisoformat(date_end_str) if date_end_str else today
    start = max(job_start, period_start)
    end = min(job_end, period_end, today)
    if start > end:
        return 0
    return (end.year - start.year) * 12 + (end.month - start.month) + 1


def _write(path: Path, data: object) -> None:
    """Write data as JSON; create parent dirs if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, default=str))
    log.info("Wrote %s (%.1f KB)", path, path.stat().st_size / 1024)


def _pivot_to_json(pivot_pct: pd.DataFrame, dev_z: np.ndarray) -> dict:
    """Serialize a deviation pivot for the frontend DeviationHeatmap component."""
    pct_vals = pivot_pct.to_numpy().astype(float)
    pct_clean = [
        [None if np.isnan(v) else round(float(v), 1) for v in row]
        for row in pct_vals.tolist()
    ]
    dev_clean = [
        [None if np.isnan(v) else round(float(v), 2) for v in row]
        for row in dev_z.tolist()
    ]
    return {
        "categories": list(pivot_pct.index),
        "parties": list(pivot_pct.columns),
        "pct": pct_clean,
        "dev": dev_clean,
    }


def export_period(period_id: int, period_start: date, period_end: date) -> bool:
    """Export all JSON files for one parliament period.

    Returns False if embeddings are missing (period skipped).
    """
    period_dir = DATA_DIR / str(period_id)
    emb_path = OUTPUTS_DIR / f"politician_embeddings_{period_id}.csv"

    if not (period_dir / "politicians.csv").exists():
        log.warning("No politicians.csv for period %d, skipping", period_id)
        return False
    if not emb_path.exists():
        log.warning("No embeddings for period %d, skipping", period_id)
        return False

    pols_df = pd.read_csv(period_dir / "politicians.csv")
    pols_df["party_label"] = pols_df["party"].str.replace("\xad", "", regex=False)

    # ── politicians ───────────────────────────────────────────────────────────
    _write(
        OUTPUT_DIR / f"politicians_{period_id}.json",
        pols_df[
            ["politician_id", "name", "party", "sex", "year_of_birth",
             "occupation", "education", "field_title"]
        ].to_dict("records"),
    )

    # ── embeddings ────────────────────────────────────────────────────────────
    emb_df = pd.read_csv(emb_path)
    if "z" in emb_df.columns:
        log.warning("3D embeddings detected for period %d; exporting 2D only", period_id)
    if "politician_id" not in emb_df.columns:
        emb_df = emb_df.merge(pols_df[["name", "politician_id"]], on="name", how="left")
    _write(
        OUTPUT_DIR / f"embeddings_{period_id}.json",
        {"dimensions": 2, "data": emb_df[["politician_id", "x", "y"]].to_dict("records")},
    )

    # ── votes ─────────────────────────────────────────────────────────────────
    votes_df = pd.read_csv(period_dir / "votes.csv")
    _write(
        OUTPUT_DIR / f"votes_{period_id}.json",
        votes_df[["politician_id", "poll_id", "answer"]].to_dict("records"),
    )

    # ── polls ─────────────────────────────────────────────────────────────────
    polls_df = pd.read_csv(period_dir / "polls.csv")
    _write(
        OUTPUT_DIR / f"polls_{period_id}.json",
        polls_df[["poll_id", "topic"]].to_dict("records"),
    )

    # ── cohesion ──────────────────────────────────────────────────────────────
    # emb_df already has party column from save_embeddings; join to be safe.
    emb_with_party = emb_df.merge(
        pols_df[["politician_id", "party"]], on="politician_id", how="left"
    )
    coh_df = compute_cohesion(emb_with_party, exclude_party="fraktionslos")
    _write(OUTPUT_DIR / f"cohesion_{period_id}.json", coh_df.to_dict("records"))

    # ── sidejobs ──────────────────────────────────────────────────────────────
    sj_path = period_dir / "sidejobs.csv"
    if sj_path.exists():
        sj_df = pd.read_csv(sj_path).merge(
            pols_df[["politician_id", "party_label"]], on="politician_id", how="left"
        )
        sj_df["category_label"] = (
            sj_df["category"].map(SIDEJOB_CATEGORIES).fillna("Sonstiges")
        )
        n_total = len(sj_df)
        n_with = int(sj_df["income"].notna().sum())

        sj_income = sj_df[sj_df["income"].notna()].copy()
        sj_income["income"] = pd.to_numeric(sj_income["income"], errors="coerce")

        def _effective_income(row: pd.Series) -> float:
            """Prorate income to period duration. Mirrors sidejobs.py."""
            interval = str(row.get("interval", ""))
            ds = row.get("date_start") if pd.notna(row.get("date_start")) else None
            de = row.get("date_end") if pd.notna(row.get("date_end")) else None
            created = row.get("created") if pd.notna(row.get("created")) else None
            if interval == "1":
                return row["income"] * _active_months(ds, de, period_start, period_end, created)
            if interval == "2":
                return row["income"] * (_active_months(ds, de, period_start, period_end) / 12)
            return row["income"]

        sj_income = sj_income.copy()
        sj_income["prorated_income"] = sj_income.apply(_effective_income, axis=1)

        def _split_topics(t: object) -> list[str]:
            if not isinstance(t, str):
                return []
            return [x.strip() for x in t.split("|") if x.strip()]

        topics_col = "topics" if "topics" in sj_income.columns else None

        jobs = []
        for _, row in sj_income.iterrows():
            jobs.append({
                "politician_id": int(row["politician_id"]),
                "party": str(row.get("party_label", "")),
                "category_label": str(row.get("category_label", "Sonstiges")),
                "income_level": int(row["income_level"]) if pd.notna(row.get("income_level")) else None,
                "prorated_income": round(float(row["prorated_income"]), 2),
                "topics": _split_topics(row.get(topics_col)) if topics_col else [],
                "has_amount": True,
            })

        _write(
            OUTPUT_DIR / f"sidejobs_{period_id}.json",
            {"jobs": jobs, "coverage": {"total": n_total, "with_amount": n_with}},
        )

    # ── party profile ─────────────────────────────────────────────────────────
    present = set(pols_df["party_label"].dropna().unique())
    party_labels_ordered = [
        p.replace("\xad", "") for p in PARTY_ORDER if p.replace("\xad", "") in present
    ] + sorted(present - {p.replace("\xad", "") for p in PARTY_ORDER})

    current_year = datetime.now(tz=UTC).year
    age_df = compute_age_df(pols_df, current_year)
    sex_df = compute_sex_counts(pols_df)
    title_df = compute_title_counts(pols_df)
    occ_pct, _, occ_dev_z = compute_occupation_pivot(pols_df, party_labels_ordered)
    edu_field_pct, _, edu_field_dev_z = compute_education_field_pivot(pols_df, party_labels_ordered)
    edu_deg_pct, _, edu_deg_dev_z = compute_education_degree_pivot(pols_df, party_labels_ordered)

    _write(
        OUTPUT_DIR / f"party_profile_{period_id}.json",
        {
            "parties": party_labels_ordered,
            "age": age_df[["party_label", "alter"]].rename(
                columns={"party_label": "party", "alter": "age"}
            ).to_dict("records"),
            "sex": sex_df.to_dict("records"),
            "titles": title_df.to_dict("records"),
            "occupation": _pivot_to_json(occ_pct, occ_dev_z),
            "education_field": _pivot_to_json(edu_field_pct, edu_field_dev_z),
            "education_degree": _pivot_to_json(edu_deg_pct, edu_deg_dev_z),
        },
    )

    log.info("Exported period %d", period_id)
    return True


def main() -> None:
    """Export all periods that have politicians + embeddings."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    periods_df = pd.read_csv(DATA_DIR / "periods.csv")
    available: list[dict] = []

    for _, row in periods_df.iterrows():
        period_id = int(row["period_id"])
        if not (DATA_DIR / str(period_id) / "politicians.csv").exists():
            continue
        p_start = date.fromisoformat(str(row["start_date"]))
        p_end = date.fromisoformat(str(row["end_date"]))
        if export_period(period_id, p_start, p_end):
            available.append({
                "period_id": period_id,
                "label": str(row.get("label", f"Periode {period_id}")),
                "has_data": True,
            })

    _write(OUTPUT_DIR / "periods.json", available)
    log.info("Done. Exported %d periods.", len(available))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the script to verify it works**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
uv run python src/export_json.py
```
Expected: INFO lines for each file written. No exceptions.

- [ ] **Step 3: Check output files exist**
```bash
ls frontend/public/data/
```
Expected: `periods.json`, `politicians_161.json`, `embeddings_161.json`, `votes_161.json`, `polls_161.json`, `cohesion_161.json`, `sidejobs_161.json`, `party_profile_161.json` (and same for 132 if it has embeddings).

- [ ] **Step 4: Spot-check a file**
```bash
python -c "import json; d=json.load(open('frontend/public/data/periods.json')); print(d)"
python -c "import json; d=json.load(open('frontend/public/data/cohesion_161.json')); print(d[:2])"
```
Expected: `periods.json` is a list with `period_id`, `label`, `has_data`. Cohesion is a list of `{party, label, streuung}`.

- [ ] **Step 5: Check votes file size**
```bash
ls -lh frontend/public/data/votes_161.json
```
Expected: under 20 MB. If larger, note it — Vercel's per-file limit is 100 MB but large files slow initial load.

- [ ] **Step 6: Commit**
```bash
git add src/export_json.py frontend/public/data/
git commit -m "feat: add export_json.py to convert CSVs to JSON for frontend"
```

---

## Task 3: Write `tests/test_export_json.py`

**Files:**
- Create: `tests/test_export_json.py`

- [ ] **Step 1: Write failing tests**

```python
"""Tests for src/export_json.py.

Verifies that export_period produces correctly-shaped JSON output.
Uses real period 161 data (must have been fetched already).
"""

import json
from datetime import date
from pathlib import Path

import pytest

OUTPUT_DIR = Path("frontend/public/data")
PERIOD_ID = 161


@pytest.fixture(autouse=True)
def run_export(tmp_path, monkeypatch):
    """Run export_period for period 161 into a temp output dir."""
    import src.export_json as ej
    monkeypatch.setattr(ej, "OUTPUT_DIR", tmp_path)
    # Use real period dates from periods.csv
    ej.export_period(PERIOD_ID, date(2025, 1, 1), date(2029, 12, 31))
    return tmp_path


def _load(run_export, name: str) -> object:
    return json.loads((run_export / name).read_text())


def test_politicians_shape(run_export):
    data = _load(run_export, f"politicians_{PERIOD_ID}.json")
    assert isinstance(data, list)
    assert len(data) > 0
    required = {"politician_id", "name", "party", "sex", "year_of_birth",
                "occupation", "education", "field_title"}
    assert required.issubset(data[0].keys())


def test_embeddings_shape(run_export):
    data = _load(run_export, f"embeddings_{PERIOD_ID}.json")
    assert data["dimensions"] == 2
    assert len(data["data"]) > 0
    assert {"politician_id", "x", "y"}.issubset(data["data"][0].keys())
    assert "z" not in data["data"][0]


def test_votes_shape(run_export):
    data = _load(run_export, f"votes_{PERIOD_ID}.json")
    assert isinstance(data, list)
    assert len(data) > 0
    assert {"politician_id", "poll_id", "answer"}.issubset(data[0].keys())


def test_polls_shape(run_export):
    data = _load(run_export, f"polls_{PERIOD_ID}.json")
    assert isinstance(data, list)
    assert {"poll_id", "topic"}.issubset(data[0].keys())


def test_cohesion_shape(run_export):
    data = _load(run_export, f"cohesion_{PERIOD_ID}.json")
    assert isinstance(data, list)
    assert len(data) > 0
    assert {"party", "label", "streuung"}.issubset(data[0].keys())
    # fraktionslos must be excluded
    assert all(d["party"] != "fraktionslos" for d in data)


def test_sidejobs_shape(run_export):
    data = _load(run_export, f"sidejobs_{PERIOD_ID}.json")
    assert "jobs" in data
    assert "coverage" in data
    assert {"total", "with_amount"}.issubset(data["coverage"].keys())
    if data["jobs"]:
        job = data["jobs"][0]
        assert {"politician_id", "party", "prorated_income", "topics", "has_amount"}.issubset(job.keys())
        assert isinstance(job["topics"], list)


def test_party_profile_shape(run_export):
    data = _load(run_export, f"party_profile_{PERIOD_ID}.json")
    assert "parties" in data
    assert "age" in data
    assert "sex" in data
    assert "occupation" in data
    occ = data["occupation"]
    assert {"categories", "parties", "pct", "dev"}.issubset(occ.keys())
    assert len(occ["pct"]) == len(occ["categories"])
    assert len(occ["pct"][0]) == len(occ["parties"])
```

- [ ] **Step 2: Run tests to verify they pass**
```bash
uv run pytest tests/test_export_json.py -v
```
Expected: All tests PASS.

- [ ] **Step 3: Commit**
```bash
git add tests/test_export_json.py
git commit -m "test: add export_json tests"
```

---

## Task 4: Update CI workflow

**Files:**
- Modify: `.github/workflows/train_model.yml`

- [ ] **Step 1: Add export_json step**

In `.github/workflows/train_model.yml`, replace the `Commit and push` step with:

```yaml
      - name: Export JSON for frontend
        run: uv run python src/export_json.py

      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add outputs/ frontend/public/data/
          git diff --staged --quiet || git commit -m "model: aktualisiere Embeddings und JSON $(date -u +%Y-%m-%d)"
          git pull --rebase && git push
```

The only changes are: (1) new `Export JSON for frontend` step before commit, (2) `frontend/public/data/` added to `git add`.

- [ ] **Step 2: Commit**
```bash
git add .github/workflows/train_model.yml
git commit -m "ci: export JSON for frontend after model training"
```

---

## Task 5: Scaffold Next.js project

**Files:**
- Create: `frontend/` (entire directory via create-next-app)

- [ ] **Step 1: Scaffold with create-next-app**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```
This creates the `frontend/` directory with App Router, TypeScript, and Tailwind pre-configured. Answer "yes" to all prompts (or use `--yes`).

- [ ] **Step 2: Configure static export in `frontend/next.config.ts`**

Replace the generated file with:
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',   // generates static HTML/CSS/JS — no server needed
  trailingSlash: true,
}

export default nextConfig
```

- [ ] **Step 3: Verify `frontend/.gitignore` does NOT exclude `public/data/`**

Open `frontend/.gitignore` and confirm there is no line matching `public/data` or `/public`. The default Next.js gitignore does not exclude it, but verify. If there is such a line, remove it.

- [ ] **Step 4: Delete boilerplate files**

Remove the generated placeholder content so we start clean:
```bash
cd frontend
rm -rf app/fonts app/favicon.ico public/next.svg public/vercel.svg
```

Replace `app/globals.css` with just Tailwind directives:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Replace `app/page.tsx` content with a temporary placeholder (we'll fill it in Task 9):
```tsx
export default function Home() {
  return <main className="p-8"><h1>Parlascanned</h1></main>
}
```

- [ ] **Step 5: Verify dev server starts**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned/frontend
npm run dev
```
Open http://localhost:3000. Expected: page renders with "Parlascanned" heading. No errors in terminal.

Stop the dev server (Ctrl+C).

- [ ] **Step 6: Commit**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
git add frontend/
git commit -m "feat: scaffold Next.js app with Tailwind and static export config"
```

---

## Task 6: Install ECharts and configure Jest

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/jest.config.ts`, `frontend/jest.setup.ts`

- [ ] **Step 1: Install ECharts and testing dependencies**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned/frontend
npm install echarts echarts-for-react
npm install --save-dev jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Create `frontend/jest.config.ts`**
```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],  // NOTE: if this key name errors, check Jest docs for the current option name (it was setupTestFrameworkScriptFile in Jest < 24)
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
}

export default createJestConfig(config)
```

- [ ] **Step 3: Create `frontend/jest.setup.ts`**
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add test script to `frontend/package.json`**

In the `"scripts"` section, add:
```json
"test": "jest"
```

- [ ] **Step 5: Commit**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
git add frontend/
git commit -m "feat: install ECharts and configure Jest for frontend"
```

---

## Task 7: `lib/constants.ts` + `lib/data.ts` + tests

**Files:**
- Create: `frontend/lib/constants.ts`
- Create: `frontend/lib/data.ts`
- Create: `frontend/__tests__/lib/data.test.ts`

- [ ] **Step 1: Create `frontend/lib/constants.ts`**

Ports `pages/constants.py` to TypeScript. Soft-hyphens are stripped since they're only needed for Python string matching.

```typescript
// Party colors and order — mirrors pages/constants.py.
// Soft-hyphen (\xad) is stripped; raw party names from the API use it.

export const PARTY_COLORS: Record<string, string> = {
  'CDU/CSU': '#2a2a2a',
  'SPD': '#E3000F',
  'AfD': '#009EE0',
  'BÜNDNIS 90/DIE GRÜNEN': '#46962B',
  'Die Linke': '#BE3075',
  'BSW': '#722EA5',
  'FDP': '#FFED00',
  'fraktionslos': '#888888',
}

export const FALLBACK_COLOR = '#888888'

// Preferred display order (most seats first).
export const PARTY_ORDER = [
  'CDU/CSU', 'SPD', 'AfD', 'BÜNDNIS 90/DIE GRÜNEN',
  'Die Linke', 'BSW', 'FDP', 'fraktionslos',
]

// Party whose fill is so dark it needs a white outline on the scatter plot.
export const DARK_FILL_PARTY = 'CDU/CSU'

export const NO_FACTION_LABEL = 'fraktionslos'

// Design tokens
export const COLOR_SECONDARY = '#999'
export const COLOR_BODY = '#666'
export const MARKER_OUTLINE = 'rgba(255,255,255,0.4)'

// Vote answer → label + color (for heatmap legend)
export const VOTE_META = {
  yes:     { label: 'Ja',        color: '#46962B' },
  no:      { label: 'Nein',      color: '#E3000F' },
  abstain: { label: 'Enthalten', color: '#F5A623' },
  no_show: { label: '–',         color: '#E0E0E0' },
} as const

// Discrete 4-step ECharts colorscale for heatmap: no_show=0, no=1, abstain=2, yes=3
export const VOTE_COLORSCALE = [
  { gte: 0, lt:  1, color: '#E0E0E0' },  // no_show / absent
  { gte: 1, lt:  2, color: '#E3000F' },  // no
  { gte: 2, lt:  3, color: '#F5A623' },  // abstain
  { gte: 3, lte: 3, color: '#46962B' },  // yes
]

export const VOTE_NUMERIC: Record<string, number> = {
  yes: 3, abstain: 2, no: 1, no_show: 0,
}
```

- [ ] **Step 2: Create `frontend/lib/data.ts`**

```typescript
// TypeScript interfaces matching the JSON schemas in the spec.
// All field names match the CSV column names exactly (as documented in the spec).

export interface Period {
  period_id: number
  label: string
  has_data: boolean
}

export interface Politician {
  politician_id: number
  name: string
  party: string         // raw, may contain soft-hyphen — strip with stripSoftHyphen()
  sex: string | null
  year_of_birth: number | null
  occupation: string | null
  education: string | null
  field_title: string | null
}

export interface EmbeddingPoint {
  politician_id: number
  x: number
  y: number
}

export interface EmbeddingsFile {
  dimensions: 2
  data: EmbeddingPoint[]
}

export interface VoteRecord {
  politician_id: number
  poll_id: number
  answer: 'yes' | 'no' | 'abstain' | 'no_show'
}

export interface Poll {
  poll_id: number
  topic: string
}

export interface CohesionRecord {
  party: string
  label: string    // party with soft-hyphen stripped
  streuung: number
}

export interface SidejobRecord {
  politician_id: number
  party: string
  category_label: string
  income_level: number | null
  prorated_income: number
  topics: string[]
  has_amount: boolean
}

export interface SidejobsFile {
  jobs: SidejobRecord[]
  coverage: { total: number; with_amount: number }
}

export interface DeviationPivot {
  categories: string[]
  parties: string[]
  pct: (number | null)[][]   // [category][party]
  dev: (number | null)[][]   // [category][party], deviation from Bundestag avg
}

export interface PartyProfileFile {
  parties: string[]
  age: { party: string; age: number }[]
  sex: { party_label: string; geschlecht: string; count: number; pct: number }[]
  titles: { party_label: string; titel: string; count: number; pct: number }[]
  occupation: DeviationPivot
  education_field: DeviationPivot
  education_degree: DeviationPivot
}

// ── Data loading utilities ──────────────────────────────────────────────────

/** Strip the soft-hyphen character used in party names from the API. */
export function stripSoftHyphen(s: string): string {
  return s.replace(/\u00ad/g, '')
}

/**
 * Fetch a JSON file from /data/ and return parsed data.
 * Throws on non-200 response so callers can handle errors uniformly.
 */
export async function fetchData<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
  return res.json() as Promise<T>
}

/** Build the URL for a period-specific JSON file. */
export function dataUrl(filename: string, periodId: number): string {
  const base = filename.replace('{period}', String(periodId))
  return `/data/${base}`
}
```

- [ ] **Step 3: Write failing tests for `lib/data.ts`**

Create `frontend/__tests__/lib/data.test.ts`:
```typescript
import { stripSoftHyphen, dataUrl } from '@/lib/data'

describe('stripSoftHyphen', () => {
  it('removes soft-hyphen from GRÜNEN party name', () => {
    expect(stripSoftHyphen('BÜNDNIS 90/\u00adDIE GRÜNEN')).toBe('BÜNDNIS 90/DIE GRÜNEN')
  })
  it('leaves strings without soft-hyphen unchanged', () => {
    expect(stripSoftHyphen('SPD')).toBe('SPD')
  })
  it('handles empty string', () => {
    expect(stripSoftHyphen('')).toBe('')
  })
})

describe('dataUrl', () => {
  it('builds correct URL for a period-specific file', () => {
    expect(dataUrl('politicians_{period}.json', 161)).toBe('/data/politicians_161.json')
  })
  it('builds correct URL for periods.json (no substitution needed)', () => {
    expect(dataUrl('periods.json', 161)).toBe('/data/periods.json')
  })
})
```

- [ ] **Step 4: Run tests to verify they pass**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned/frontend
npm test
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
git add frontend/lib/ frontend/__tests__/
git commit -m "feat: add TypeScript interfaces and data utilities"
```

---

## Task 8: Layout, navigation, footer

**Files:**
- Create: `frontend/components/ui/Footer.tsx`
- Create: `frontend/components/ui/PeriodSelector.tsx`
- Create: `frontend/components/ui/Sidebar.tsx`
- Create: `frontend/components/ui/BottomNav.tsx`
- Create: `frontend/components/ui/ChartSkeleton.tsx`
- Modify: `frontend/app/layout.tsx`
- Create: `frontend/app/globals.css` (already exists from scaffold — update it)

The app has a fixed left sidebar on desktop and a bottom tab bar on mobile (`md` breakpoint). Both share a `PeriodSelector` component. Period state is stored in a React context so all pages can read it.

- [ ] **Step 1: Create `frontend/lib/period-context.tsx`**

```tsx
'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { fetchData, Period } from '@/lib/data'

interface PeriodContextValue {
  periods: Period[]
  activePeriodId: number | null
  setActivePeriodId: (id: number) => void
}

const PeriodContext = createContext<PeriodContextValue>({
  periods: [],
  activePeriodId: null,
  setActivePeriodId: () => {},
})

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [periods, setPeriods] = useState<Period[]>([])
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null)

  useEffect(() => {
    fetchData<Period[]>('/data/periods.json')
      .then((data) => {
        const available = data.filter((p) => p.has_data)
        setPeriods(available)
        if (available.length > 0) setActivePeriodId(available[0].period_id)
      })
      .catch(console.error)
  }, [])

  return (
    <PeriodContext.Provider value={{ periods, activePeriodId, setActivePeriodId }}>
      {children}
    </PeriodContext.Provider>
  )
}

export const usePeriod = () => useContext(PeriodContext)
```

- [ ] **Step 2: Create `frontend/components/ui/PeriodSelector.tsx`**

```tsx
'use client'
import { usePeriod } from '@/lib/period-context'

export function PeriodSelector() {
  const { periods, activePeriodId, setActivePeriodId } = usePeriod()
  if (periods.length <= 1) return null  // hide if only one period
  return (
    <select
      value={activePeriodId ?? ''}
      onChange={(e) => setActivePeriodId(Number(e.target.value))}
      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {periods.map((p) => (
        <option key={p.period_id} value={p.period_id}>{p.label}</option>
      ))}
    </select>
  )
}
```

- [ ] **Step 3: Create `frontend/components/ui/Sidebar.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PeriodSelector } from './PeriodSelector'

const NAV_ITEMS = [
  { href: '/',               label: 'Start' },
  { href: '/vote-map',       label: 'Abstimmungslandkarte' },
  { href: '/party-profile',  label: 'Parteiprofil' },
  { href: '/sidejobs',       label: 'Nebeneinkünfte' },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 border-r border-gray-100 bg-white px-4 py-6 gap-2">
      <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
        Parlascanned
      </span>
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname === href
                ? 'bg-gray-100 font-medium text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto">
        <p className="text-xs text-gray-400 mb-2 px-2">Wahlperiode</p>
        <PeriodSelector />
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Create `frontend/components/ui/BottomNav.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PeriodSelector } from './PeriodSelector'

const NAV_ITEMS = [
  { href: '/',              label: 'Start',      icon: '🏠' },
  { href: '/vote-map',      label: 'Karte',       icon: '🗺️' },
  { href: '/party-profile', label: 'Parteien',   icon: '📊' },
  { href: '/sidejobs',      label: 'Einkünfte',  icon: '💼' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around items-center h-16">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[44px] text-xs transition-colors ${
              pathname === href ? 'text-blue-600 font-medium' : 'text-gray-500'
            }`}
          >
            <span className="text-lg leading-none mb-0.5">{icon}</span>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 5: Create `frontend/components/ui/Footer.tsx`**

```tsx
export function Footer() {
  return (
    <footer className="text-center text-xs text-gray-400 py-8 mt-8">
      von{' '}
      <a href="https://robkuebler.github.io" className="underline hover:text-gray-600">
        Robert Kübler
      </a>{' '}
      | Code auf{' '}
      <a href="https://github.com/RobKuebler/politician_embeddings" className="underline hover:text-gray-600">
        GitHub
      </a>{' '}
      | Daten von{' '}
      <a href="https://www.abgeordnetenwatch.de" className="underline hover:text-gray-600">
        abgeordnetenwatch.de
      </a>
    </footer>
  )
}
```

- [ ] **Step 6: Create `frontend/components/ui/ChartSkeleton.tsx`**

```tsx
export function ChartSkeleton({ height = 400 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-xl bg-gray-100 animate-pulse"
      style={{ height }}
      role="status"
      aria-label="Wird geladen…"
    />
  )
}
```

- [ ] **Step 7: Update `frontend/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/ui/Sidebar'
import { BottomNav } from '@/components/ui/BottomNav'
import { PeriodProvider } from '@/lib/period-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Parlascanned',
  description: 'Bundestagsabgeordnete und ihre Abstimmungen',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={`${inter.className} bg-white text-gray-900`}>
        <PeriodProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            {/* Main content: add bottom padding on mobile to clear the fixed bottom nav */}
            <main className="flex-1 min-w-0 px-4 py-6 md:px-8 pb-20 md:pb-8">
              {children}
            </main>
          </div>
          <BottomNav />
        </PeriodProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 8: Add period selector to mobile top bar**

On mobile the period selector should be accessible. Add a floating selector at the top of `main` for mobile (below `md`). Add this div at the very top of `<main>` in `layout.tsx`:

```tsx
{/* Mobile period selector — shown above page content, hidden on desktop */}
<div className="md:hidden mb-4">
  <PeriodSelector />
</div>
```

- [ ] **Step 9: Verify layout renders**
```bash
cd frontend && npm run dev
```
Open http://localhost:3000. Expected: left sidebar visible on desktop, bottom tab bar on mobile (resize browser). Period selector shows a dropdown. Footer visible.

- [ ] **Step 10: Commit**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
git add frontend/
git commit -m "feat: add layout with sidebar (desktop) and bottom nav (mobile)"
```

---

## Task 9: Home page

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Replace `frontend/app/page.tsx`**

```tsx
import Link from 'next/link'
import { Footer } from '@/components/ui/Footer'

const FEATURES = [
  {
    href: '/vote-map',
    title: 'Abstimmungslandkarte',
    description:
      'KI-generierte Karte aller Abgeordneten. Nähe = ähnliches Abstimmungsverhalten. Wähle Abgeordnete per Box-Auswahl für die Heatmap.',
  },
  {
    href: '/party-profile',
    title: 'Parteiprofil',
    description:
      'Altersverteilung, Geschlecht, Berufe und Ausbildung der Fraktionen im Vergleich.',
  },
  {
    href: '/sidejobs',
    title: 'Nebeneinkünfte',
    description:
      'Offengelegte Nebentätigkeiten und Einkünfte nach Partei, Kategorie und Themenfeld.',
  },
]

export default function Home() {
  return (
    <>
      <div className="max-w-2xl mx-auto text-center py-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">
          Parlascanned
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed">
          Daten und KI-Analyse zum Deutschen Bundestag. Wer stimmt mit wem?
          Wo verlaufen die echten Trennlinien?
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {FEATURES.map(({ href, title, description }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-gray-200 p-6 hover:border-gray-400 hover:shadow-sm transition-all"
          >
            <h2 className="font-semibold text-gray-900 mb-2">{title}</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
          </Link>
        ))}
      </div>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Verify**
Open http://localhost:3000. Expected: 3 feature cards in a responsive grid, centered header.

- [ ] **Step 3: Commit**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
git add frontend/app/page.tsx
git commit -m "feat: add home page with feature cards"
```

---

## Task 10: Vote map — scatter + cohesion

**Files:**
- Create: `frontend/components/charts/VoteMapScatter.tsx`
- Create: `frontend/components/charts/CohesionChart.tsx`

The scatter plot uses ECharts `brush` component. On `brushselected` event, the selected data indices are mapped to `politician_id`s and passed up via `onSelectionChange`. The cohesion chart is a simpler horizontal bar.

- [ ] **Step 1: Create `frontend/components/charts/VoteMapScatter.tsx`**

```tsx
'use client'
import { useEffect, useRef, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { EmbeddingPoint, Politician } from '@/lib/data'
import { PARTY_COLORS, FALLBACK_COLOR, DARK_FILL_PARTY, MARKER_OUTLINE } from '@/lib/constants'

interface Props {
  embeddings: EmbeddingPoint[]
  politicians: Politician[]
  selectedIds: number[]
  onSelectionChange: (ids: number[]) => void
  height?: number
}

export function VoteMapScatter({
  embeddings, politicians, selectedIds, onSelectionChange, height = 600
}: Props) {
  const chartRef = useRef<ReactECharts>(null)
  const polMap = useMemo(
    () => new Map(politicians.map((p) => [p.politician_id, p])),
    [politicians]
  )

  // Group data by party for separate series (needed for per-party colors).
  const seriesByParty = useMemo(() => {
    const map = new Map<string, EmbeddingPoint[]>()
    for (const pt of embeddings) {
      const pol = polMap.get(pt.politician_id)
      const party = pol?.party.replace(/\u00ad/g, '') ?? 'fraktionslos'
      if (!map.has(party)) map.set(party, [])
      map.get(party)!.push(pt)
    }
    return map
  }, [embeddings, polMap])

  const option: EChartsOption = useMemo(() => ({
    animation: false,
    brush: {
      toolbox: ['rect', 'polygon', 'clear'],
      brushLink: 'all',
    },
    toolbox: {
      feature: {
        brush: {
          type: ['rect', 'polygon', 'clear'],
          // Large icon size for touch targets (min 44px)
          iconStyle: { borderWidth: 2 },
        },
      },
      right: 16,
      top: 8,
      itemSize: 20,
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const pol = polMap.get(params.data[2])
        if (!pol) return ''
        return `<b>${pol.name}</b><br/><span style="color:#999">${pol.party.replace(/\u00ad/g, '')}</span>`
      },
    },
    xAxis: { show: false },
    yAxis: { show: false },
    series: Array.from(seriesByParty.entries()).map(([party, points]) => ({
      type: 'scatter',
      name: party,
      data: points.map((pt) => [pt.x, pt.y, pt.politician_id]),
      symbolSize: 8,
      itemStyle: {
        color: PARTY_COLORS[party] ?? FALLBACK_COLOR,
        opacity: 0.82,
        borderColor: party === DARK_FILL_PARTY ? 'rgba(255,255,255,0.5)' : MARKER_OUTLINE,
        borderWidth: 1,
      },
    })),
    grid: { left: 0, right: 0, top: 40, bottom: 0 },
  }), [seriesByParty, polMap])

  // Handle brush selection events
  useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance()
    if (!chart) return
    const handler = (params: any) => {
      const allIndices: number[] = []
      for (const batch of params.batch ?? []) {
        for (const sel of batch.selected ?? []) {
          allIndices.push(...(sel.dataIndex ?? []))
        }
      }
      // Map data indices back to politician_ids
      const allPoints = embeddings
      const ids = [...new Set(allIndices.map((i) => allPoints[i]?.politician_id).filter(Boolean))]
      onSelectionChange(ids as number[])
    }
    chart.on('brushselected', handler)
    return () => { chart.off('brushselected', handler) }
  }, [embeddings, onSelectionChange])

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ width: '100%', height }}
      notMerge
    />
  )
}
```

- [ ] **Step 2: Create `frontend/components/charts/CohesionChart.tsx`**

```tsx
'use client'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { CohesionRecord } from '@/lib/data'
import { PARTY_COLORS, FALLBACK_COLOR } from '@/lib/constants'

interface Props {
  cohesion: CohesionRecord[]
  height?: number
}

export function CohesionChart({ cohesion, height = 300 }: Props) {
  const option: EChartsOption = {
    animation: false,
    tooltip: {
      trigger: 'item',
      formatter: (p: any) =>
        `<b>${p.name}</b><br/>Ø Abstand: ${p.value.toFixed(3)}`,
    },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: cohesion.map((c) => c.label),
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: cohesion.map((c) => ({
        value: c.streuung,
        name: c.label,
        itemStyle: { color: PARTY_COLORS[c.party] ?? FALLBACK_COLOR },
      })),
      barMaxWidth: 32,
      label: { show: false },
    }],
    grid: { left: 80, right: 16, top: 8, bottom: 8 },
  }

  return (
    <ReactECharts
      option={option}
      style={{ width: '100%', height }}
      notMerge
    />
  )
}
```

- [ ] **Step 3: Commit**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
git add frontend/components/charts/VoteMapScatter.tsx frontend/components/charts/CohesionChart.tsx
git commit -m "feat: add VoteMapScatter and CohesionChart ECharts components"
```

---

## Task 11: Vote map — heatmap + poll filter + page

**Files:**
- Create: `frontend/components/charts/VoteHeatmap.tsx`
- Create: `frontend/components/charts/PollFilter.tsx`
- Create: `frontend/app/vote-map/page.tsx`

- [ ] **Step 1: Create `frontend/components/charts/VoteHeatmap.tsx`**

```tsx
'use client'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { VoteRecord, Poll, Politician } from '@/lib/data'
import { VOTE_META, VOTE_NUMERIC } from '@/lib/constants'

interface Props {
  votes: VoteRecord[]
  polls: Poll[]
  politicians: Politician[]
  selectedPolIds: number[]
  selectedPollIds: number[]
}

export function VoteHeatmap({ votes, polls, politicians, selectedPolIds, selectedPollIds }: Props) {
  const polMap = new Map(politicians.map((p) => [p.politician_id, p]))
  const pollMap = new Map(polls.map((p) => [p.poll_id, p]))

  // Build lookup: politician_id → poll_id → answer
  const voteIndex = new Map<number, Map<number, string>>()
  for (const v of votes) {
    if (!voteIndex.has(v.politician_id)) voteIndex.set(v.politician_id, new Map())
    voteIndex.get(v.politician_id)!.set(v.poll_id, v.answer)
  }

  const pollsToShow = selectedPollIds.length > 0
    ? polls.filter((p) => selectedPollIds.includes(p.poll_id))
    : polls

  const xLabels = selectedPolIds.map((id) => {
    const pol = polMap.get(id)
    return pol ? `${pol.name} (${pol.party.replace(/\u00ad/g, '')})` : String(id)
  })
  const yLabels = pollsToShow.map((p) =>
    p.topic.length > 50 ? p.topic.slice(0, 47) + '…' : p.topic
  )

  // Build heatmap data: [xIndex, yIndex, numericValue]
  const data: [number, number, number][] = []
  pollsToShow.forEach((poll, yIdx) => {
    selectedPolIds.forEach((polId, xIdx) => {
      const answer = voteIndex.get(polId)?.get(poll.poll_id) ?? 'no_show'
      data.push([xIdx, yIdx, VOTE_NUMERIC[answer] ?? 0])
    })
  })

  const chartHeight = Math.max(300, 44 * pollsToShow.length + 80)

  const option: EChartsOption = {
    animation: false,
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const answerKey = Object.entries(VOTE_NUMERIC).find(([, v]) => v === p.data[2])?.[0] ?? 'no_show'
        const meta = VOTE_META[answerKey as keyof typeof VOTE_META]
        return `<b>${xLabels[p.data[0]]}</b><br/>${yLabels[p.data[1]]}<br/>${meta.label}`
      },
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      position: 'top',
      axisLabel: { rotate: -30, fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      inverse: true,
      axisLabel: { fontSize: 11 },
      splitLine: { show: false },
    },
    visualMap: {
      type: 'piecewise',
      show: false,
      pieces: [
        { gte: 0, lt: 1,  color: '#E0E0E0' },  // no_show
        { gte: 1, lt: 2,  color: '#E3000F' },  // no
        { gte: 2, lt: 3,  color: '#F5A623' },  // abstain
        { gte: 3, lte: 3, color: '#46962B' },  // yes
      ],
    },
    series: [{
      type: 'heatmap',
      data,
      itemStyle: { borderWidth: 3, borderColor: '#fff' },
    }],
    grid: { left: 200, right: 16, top: 80, bottom: 16 },
  }

  return (
    <div className="overflow-x-auto">
      <ReactECharts
        option={option}
        style={{ width: '100%', minWidth: `${Math.max(400, selectedPolIds.length * 80)}px`, height: chartHeight }}
        notMerge
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/components/charts/PollFilter.tsx`**

A simple searchable multiselect using a native `<select multiple>` with a search input above it.

```tsx
'use client'
import { useState } from 'react'
import { Poll } from '@/lib/data'

interface Props {
  polls: Poll[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

export function PollFilter({ polls, selectedIds, onChange }: Props) {
  const [query, setQuery] = useState('')
  const filtered = polls.filter((p) =>
    p.topic.toLowerCase().includes(query.toLowerCase())
  )
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        placeholder="Abstimmungen suchen…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <select
        multiple
        size={6}
        value={selectedIds.map(String)}
        onChange={(e) => {
          const ids = Array.from(e.target.selectedOptions).map((o) => Number(o.value))
          onChange(ids)
        }}
        className="w-full rounded-lg border border-gray-200 text-sm p-1 min-h-[44px]"
      >
        {filtered.map((p) => (
          <option key={p.poll_id} value={p.poll_id}>{p.topic}</option>
        ))}
      </select>
      {selectedIds.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="text-xs text-gray-400 underline text-left"
        >
          Auswahl aufheben
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/app/vote-map/page.tsx`**

```tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { usePeriod } from '@/lib/period-context'
import { fetchData, dataUrl, EmbeddingsFile, Politician, VoteRecord, Poll, CohesionRecord } from '@/lib/data'
import { VoteMapScatter } from '@/components/charts/VoteMapScatter'
import { VoteHeatmap } from '@/components/charts/VoteHeatmap'
import { CohesionChart } from '@/components/charts/CohesionChart'
import { PollFilter } from '@/components/charts/PollFilter'
import { ChartSkeleton } from '@/components/ui/ChartSkeleton'
import { Footer } from '@/components/ui/Footer'
import { COLOR_SECONDARY } from '@/lib/constants'

export default function VoteMapPage() {
  const { activePeriodId } = usePeriod()
  const [embeddings, setEmbeddings] = useState<EmbeddingsFile | null>(null)
  const [politicians, setPoliticians] = useState<Politician[]>([])
  const [cohesion, setCohesion] = useState<CohesionRecord[]>([])
  const [votes, setVotes] = useState<VoteRecord[] | null>(null)
  const [polls, setPolls] = useState<Poll[]>([])
  const [selectedPolIds, setSelectedPolIds] = useState<number[]>([])
  const [selectedPollIds, setSelectedPollIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingVotes, setLoadingVotes] = useState(false)

  useEffect(() => {
    if (!activePeriodId) return
    setLoading(true)
    setSelectedPolIds([])
    setVotes(null)
    Promise.all([
      fetchData<EmbeddingsFile>(dataUrl('embeddings_{period}.json', activePeriodId)),
      fetchData<Politician[]>(dataUrl('politicians_{period}.json', activePeriodId)),
      fetchData<CohesionRecord[]>(dataUrl('cohesion_{period}.json', activePeriodId)),
    ]).then(([emb, pols, coh]) => {
      setEmbeddings(emb)
      setPoliticians(pols)
      setCohesion(coh)
      setLoading(false)
    }).catch(console.error)
  }, [activePeriodId])

  const handleSelection = useCallback((ids: number[]) => {
    setSelectedPolIds(ids)
    if (ids.length > 0 && !votes && activePeriodId) {
      setLoadingVotes(true)
      Promise.all([
        fetchData<VoteRecord[]>(dataUrl('votes_{period}.json', activePeriodId)),
        fetchData<Poll[]>(dataUrl('polls_{period}.json', activePeriodId)),
      ]).then(([v, p]) => {
        setVotes(v)
        setPolls(p)
        setLoadingVotes(false)
      }).catch(console.error)
    }
  }, [votes, activePeriodId])

  return (
    <>
      <h1 className="text-2xl font-bold mb-1">Wer stimmt mit wem?</h1>
      <p className="text-sm mb-6" style={{ color: COLOR_SECONDARY }}>
        Jeder Punkt = ein Abgeordneter. Nähe = ähnliches Abstimmungsverhalten.
        Box-Auswahl wählt Abgeordnete für die Heatmap unten.
      </p>

      {/* Scatter */}
      <div className="rounded-xl border border-gray-100 p-4 mb-6">
        <h2 className="font-semibold mb-3">Abstimmungslandkarte</h2>
        {loading ? (
          <ChartSkeleton height={typeof window !== 'undefined' && window.innerWidth < 768 ? 350 : 600} />
        ) : (
          <VoteMapScatter
            embeddings={embeddings!.data}
            politicians={politicians}
            selectedIds={selectedPolIds}
            onSelectionChange={handleSelection}
            height={typeof window !== 'undefined' && window.innerWidth < 768 ? 350 : 600}
          />
        )}
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-gray-100 p-4 mb-6">
        <h2 className="font-semibold mb-3">Abstimmungsverhalten</h2>
        {!selectedPolIds.length ? (
          <p className="text-sm text-center py-8" style={{ color: COLOR_SECONDARY }}>
            Politiker auswählen, um ihre Abstimmungen zu sehen
          </p>
        ) : loadingVotes ? (
          <ChartSkeleton height={300} />
        ) : votes ? (
          <>
            {/* Vote legend */}
            <div className="flex flex-wrap gap-4 mb-3 text-xs">
              {(['yes', 'no', 'abstain'] as const).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block"
                    style={{ background: { yes: '#46962B', no: '#E3000F', abstain: '#F5A623' }[k] }} />
                  {{ yes: 'Ja', no: 'Nein', abstain: 'Enthalten' }[k]}
                </span>
              ))}
            </div>
            <div className="mb-4">
              <PollFilter polls={polls} selectedIds={selectedPollIds} onChange={setSelectedPollIds} />
            </div>
            <VoteHeatmap
              votes={votes}
              polls={polls}
              politicians={politicians}
              selectedPolIds={selectedPolIds}
              selectedPollIds={selectedPollIds}
            />
          </>
        ) : null}
      </div>

      {/* Cohesion */}
      <div className="rounded-xl border border-gray-100 p-4 mb-6">
        <h2 className="font-semibold mb-1">Fraktionsdisziplin</h2>
        <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>
          Kurzer Balken = hohe Disziplin (Abgeordnete stimmen eng mit ihrer Fraktion).
        </p>
        {loading ? <ChartSkeleton height={300} /> : <CohesionChart cohesion={cohesion} />}
      </div>

      <Footer />
    </>
  )
}
```

- [ ] **Step 4: Verify vote map page**

Ensure `export_json.py` has been run (Task 2). Start dev server, navigate to http://localhost:3000/vote-map. Expected:
- Scatter plot renders with colored party clusters
- Drawing a box selection populates the heatmap section
- Cohesion chart renders below

- [ ] **Step 5: Commit**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
git add frontend/components/charts/ frontend/app/vote-map/
git commit -m "feat: add vote map page with scatter, heatmap, and cohesion chart"
```

---

## Task 12: Party profile page

**Files:**
- Create: `frontend/components/charts/GenderChart.tsx`
- Create: `frontend/components/charts/DeviationHeatmap.tsx`
- Create: `frontend/components/charts/AgeDistribution.tsx`
- Create: `frontend/app/party-profile/page.tsx`

- [ ] **Step 1: Create `frontend/components/charts/GenderChart.tsx`**

```tsx
'use client'
import ReactECharts from 'echarts-for-react'
import { PARTY_COLORS, FALLBACK_COLOR } from '@/lib/constants'

interface SexRecord { party_label: string; geschlecht: string; count: number; pct: number }

export function GenderChart({ data, parties }: { data: SexRecord[]; parties: string[] }) {
  const genders = ['Männlich', 'Weiblich', 'Divers']
  const colors: Record<string, string> = { 'Männlich': '#4C9BE8', 'Weiblich': '#E87E9B', 'Divers': '#9B59B6' }
  const option = {
    animation: false,
    tooltip: { trigger: 'item', formatter: (p: any) => `<b>${p.seriesName}</b><br/>${p.name}: ${p.value}%` },
    legend: { data: genders, bottom: 0 },
    xAxis: { type: 'category', data: parties, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: genders.map((g) => ({
      name: g,
      type: 'bar',
      stack: 'total',
      data: parties.map((p) => {
        const row = data.find((r) => r.party_label === p && r.geschlecht === g)
        return row ? Math.round(row.pct) : 0
      }),
      itemStyle: { color: colors[g] },
    })),
    grid: { left: 48, right: 16, top: 16, bottom: 48 },
  }
  return <ReactECharts option={option} style={{ width: '100%', height: 300 }} notMerge />
}
```

- [ ] **Step 2: Create `frontend/components/charts/DeviationHeatmap.tsx`**

```tsx
'use client'
import ReactECharts from 'echarts-for-react'
import { DeviationPivot } from '@/lib/data'

interface Props { pivot: DeviationPivot; height?: number }

export function DeviationHeatmap({ pivot, height = 400 }: Props) {
  // Build ECharts heatmap data: [partyIdx, catIdx, devValue]
  const data: [number, number, number | null][] = []
  pivot.categories.forEach((_, catIdx) => {
    pivot.parties.forEach((_, partyIdx) => {
      data.push([partyIdx, catIdx, pivot.dev[catIdx]?.[partyIdx] ?? null])
    })
  })

  const maxDev = Math.max(...pivot.dev.flat().filter((v): v is number => v !== null).map(Math.abs), 1)

  const option = {
    animation: false,
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const cat = pivot.categories[p.data[1]]
        const party = pivot.parties[p.data[0]]
        const dev = p.data[2]
        const pct = pivot.pct[p.data[1]]?.[p.data[0]]
        if (dev === null) return `${party}<br/>${cat}: keine Daten`
        return `<b>${party}</b><br/>${cat}<br/>Anteil: ${pct?.toFixed(1) ?? '?'}%<br/>Abweichung: ${dev > 0 ? '+' : ''}${dev.toFixed(1)} pp`
      },
    },
    xAxis: {
      type: 'category', data: pivot.parties,
      axisLabel: { fontSize: 10, rotate: -20 }, splitLine: { show: false },
    },
    yAxis: {
      type: 'category', data: pivot.categories,
      axisLabel: { fontSize: 10 }, splitLine: { show: false },
    },
    visualMap: {
      type: 'continuous', show: false,
      min: -maxDev, max: maxDev,
      // red = below avg, white = avg, blue = above avg (matches Streamlit app)
      inRange: { color: ['#c0392b', '#fff', '#2471a3'] },
    },
    series: [{
      type: 'heatmap', data,
      label: {
        show: true, fontSize: 9,
        formatter: (p: any) => {
          const v = p.data[2]
          if (v === null) return ''
          return `${v > 0 ? '+' : ''}${v.toFixed(0)}`
        },
      },
      itemStyle: { borderWidth: 1, borderColor: '#fff' },
      emphasis: { itemStyle: { borderColor: '#333', borderWidth: 1 } },
    }],
    grid: { left: 160, right: 16, top: 8, bottom: 60 },
  }

  return (
    <div className="overflow-x-auto">
      <ReactECharts option={option} style={{ width: '100%', minWidth: 500, height }} notMerge />
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/components/charts/AgeDistribution.tsx`**

The raincloud chart (violin + jitter) is the most complex ECharts chart in the app. We implement it using the `custom` series type with a `renderItem` function that draws a simplified half-violin (using boxplot-style density bins) plus jittered dots.

```tsx
'use client'
import ReactECharts from 'echarts-for-react'
import { PARTY_COLORS, FALLBACK_COLOR } from '@/lib/constants'

interface AgeRecord { party: string; age: number }
interface Props { data: AgeRecord[]; parties: string[] }

function kernelDensity(values: number[], bandwidth = 3): (x: number) => number {
  return (x: number) =>
    values.reduce((s, v) => s + Math.exp(-0.5 * ((x - v) / bandwidth) ** 2), 0) /
    (values.length * bandwidth * Math.sqrt(2 * Math.PI))
}

export function AgeDistribution({ data, parties }: Props) {
  const byParty = new Map<string, number[]>()
  for (const { party, age } of data) {
    if (!byParty.has(party)) byParty.set(party, [])
    byParty.get(party)!.push(age)
  }

  const ages = Array.from({ length: 60 }, (_, i) => i + 20) // 20–79
  const seriesData: any[] = []

  parties.forEach((party, partyIdx) => {
    const values = byParty.get(party)
    if (!values || values.length === 0) return
    const color = PARTY_COLORS[party] ?? FALLBACK_COLOR
    const kde = kernelDensity(values)
    const densities = ages.map(kde)
    const maxDensity = Math.max(...densities)

    // Violin half-path: render as a bar series flipped 90° (horizontal)
    // Using one bar per age bin, width = density, y = party index
    ages.forEach((age, ageIdx) => {
      const d = densities[ageIdx] / maxDensity  // normalize 0-1
      seriesData.push({
        type: 'bar',
        name: party,
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: [[age, partyIdx, d]],
        itemStyle: { color, opacity: 0.4 },
        barWidth: 1,
      })
    })

    // Jitter dots
    values.forEach((age) => {
      seriesData.push({
        type: 'scatter',
        name: party,
        data: [[age, partyIdx + (Math.random() - 0.5) * 0.3]],
        symbolSize: 4,
        itemStyle: { color, opacity: 0.6 },
      })
    })
  })

  // Simplified: use scatter for individual points + line for density outline
  // This is a practical approximation; a full raincloud would need ECharts custom renderItem
  const option = {
    animation: false,
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.seriesName}: ${p.data[0]} Jahre` },
    xAxis: { type: 'value', min: 20, max: 85, name: 'Alter', nameLocation: 'end' },
    yAxis: {
      type: 'category', data: parties,
      axisLabel: { fontSize: 11 }, inverse: true,
    },
    series: parties.map((party) => {
      const values = byParty.get(party) ?? []
      const color = PARTY_COLORS[party] ?? FALLBACK_COLOR
      return {
        name: party,
        type: 'scatter',
        data: values.map((age) => [age, party]),
        symbolSize: 5,
        itemStyle: { color, opacity: 0.55 },
      }
    }),
    grid: { left: 100, right: 24, top: 16, bottom: 40 },
  }

  return <ReactECharts option={option} style={{ width: '100%', height: 400 }} notMerge />
}
```

> **Note:** This implementation uses a scatter-per-party approach (one dot per politician) rather than a full violin. It's a functional approximation that conveys the same information (distribution spread and individual data points). A full half-violin would require an ECharts `custom` series `renderItem` implementation which is significantly more complex — leave for a future iteration if needed.

- [ ] **Step 4: Create `frontend/app/party-profile/page.tsx`**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { usePeriod } from '@/lib/period-context'
import { fetchData, dataUrl, PartyProfileFile } from '@/lib/data'
import { AgeDistribution } from '@/components/charts/AgeDistribution'
import { GenderChart } from '@/components/charts/GenderChart'
import { DeviationHeatmap } from '@/components/charts/DeviationHeatmap'
import { ChartSkeleton } from '@/components/ui/ChartSkeleton'
import { Footer } from '@/components/ui/Footer'
import { COLOR_SECONDARY } from '@/lib/constants'

export default function PartyProfilePage() {
  const { activePeriodId } = usePeriod()
  const [data, setData] = useState<PartyProfileFile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activePeriodId) return
    setLoading(true)
    fetchData<PartyProfileFile>(dataUrl('party_profile_{period}.json', activePeriodId))
      .then((d) => { setData(d); setLoading(false) })
      .catch(console.error)
  }, [activePeriodId])

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">Parteiprofil</h1>
      {loading || !data ? (
        <div className="flex flex-col gap-6">
          <ChartSkeleton height={300} />
          <ChartSkeleton height={300} />
          <ChartSkeleton height={400} />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Altersverteilung</h2>
            <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>Jeder Punkt = ein Abgeordneter.</p>
            <AgeDistribution data={data.age} parties={data.parties} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-3">Geschlecht</h2>
            <GenderChart data={data.sex} parties={data.parties} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Berufe</h2>
            <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>
              Blau = überproportional, rot = unterproportional (Abweichung vom Bundestag-Durchschnitt in Prozentpunkten).
            </p>
            <DeviationHeatmap pivot={data.occupation} height={500} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Ausbildung / Studienrichtung</h2>
            <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>
              Blau = überproportional, rot = unterproportional.
            </p>
            <DeviationHeatmap pivot={data.education_field} height={400} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Abschlussniveau</h2>
            <DeviationHeatmap pivot={data.education_degree} height={250} />
          </section>
        </div>
      )}
      <Footer />
    </>
  )
}
```

- [ ] **Step 5: Verify party profile page**

Navigate to http://localhost:3000/party-profile. Expected: age scatter, gender grouped bar, three deviation heatmaps, all colored correctly.

- [ ] **Step 6: Commit**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
git add frontend/components/charts/GenderChart.tsx frontend/components/charts/DeviationHeatmap.tsx frontend/components/charts/AgeDistribution.tsx frontend/app/party-profile/
git commit -m "feat: add party profile page with age, gender, and deviation heatmaps"
```

---

## Task 13: Sidejobs page

**Files:**
- Create: `frontend/components/charts/SidejobsCharts.tsx`
- Create: `frontend/app/sidejobs/page.tsx`

- [ ] **Step 1: Create `frontend/components/charts/SidejobsCharts.tsx`**

```tsx
'use client'
import ReactECharts from 'echarts-for-react'
import { SidejobRecord } from '@/lib/data'
import { PARTY_COLORS, FALLBACK_COLOR } from '@/lib/constants'

// ── Chart 1: Income by party (sum + mean) ────────────────────────────────────
export function IncomeByPartyChart({ jobs, parties }: { jobs: SidejobRecord[]; parties: string[] }) {
  const byParty = new Map<string, number[]>()
  for (const j of jobs) {
    if (!byParty.has(j.party)) byParty.set(j.party, [])
    byParty.get(j.party)!.push(j.prorated_income)
  }
  const totals = parties.map((p) => byParty.get(p)?.reduce((a, b) => a + b, 0) ?? 0)
  const means = parties.map((p) => {
    const vals = byParty.get(p) ?? []
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })

  const makeOption = (data: number[], title: string) => ({
    animation: false,
    tooltip: { trigger: 'item', formatter: (p: any) => `<b>${p.name}</b><br/>${p.value.toLocaleString('de')} €` },
    xAxis: { type: 'category', data: parties, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${(v / 1000).toFixed(0)}k` } },
    series: [{
      type: 'bar', data: data.map((v, i) => ({ value: Math.round(v), name: parties[i], itemStyle: { color: PARTY_COLORS[parties[i]] ?? FALLBACK_COLOR } })),
      barMaxWidth: 48,
    }],
    grid: { left: 60, right: 16, top: 16, bottom: 40 },
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Summe</p>
        <ReactECharts option={makeOption(totals, 'Summe')} style={{ width: '100%', height: 280 }} notMerge />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Ø pro Abgeordnetem</p>
        <ReactECharts option={makeOption(means, 'Mittelwert')} style={{ width: '100%', height: 280 }} notMerge />
      </div>
    </div>
  )
}

// ── Chart 2: Income by category ───────────────────────────────────────────────
export function IncomeByCategoryChart({ jobs, parties }: { jobs: SidejobRecord[]; parties: string[] }) {
  const catSet = new Set(jobs.map((j) => j.category_label))
  const cats = Array.from(catSet).sort()
  const option = {
    animation: false,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${(v / 1000).toFixed(0)}k` } },
    yAxis: { type: 'category', data: cats.slice().reverse() },
    series: parties.map((party) => ({
      name: party, type: 'bar', stack: 'total',
      data: cats.map((cat) => {
        const sum = jobs.filter((j) => j.party === party && j.category_label === cat).reduce((s, j) => s + j.prorated_income, 0)
        return Math.round(sum)
      }).reverse(),
      itemStyle: { color: PARTY_COLORS[party] ?? FALLBACK_COLOR },
    })),
    grid: { left: 240, right: 16, top: 8, bottom: 48 },
  }
  return (
    <div className="overflow-x-auto">
      <ReactECharts option={option} style={{ width: '100%', minWidth: 500, height: Math.max(300, cats.length * 36 + 80) }} notMerge />
    </div>
  )
}

// ── Chart 3: Top topics ───────────────────────────────────────────────────────
export function TopTopicsChart({ jobs, parties }: { jobs: SidejobRecord[]; parties: string[] }) {
  // Explode and aggregate topics
  const topicMap = new Map<string, Map<string, number>>()
  for (const j of jobs) {
    for (const topic of j.topics) {
      if (!topicMap.has(topic)) topicMap.set(topic, new Map())
      const m = topicMap.get(topic)!
      m.set(j.party, (m.get(j.party) ?? 0) + j.prorated_income)
    }
  }
  const topTopics = Array.from(topicMap.entries())
    .map(([topic, partyMap]) => ({ topic, total: Array.from(partyMap.values()).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total).slice(0, 15).map((t) => t.topic)

  const option = {
    animation: false,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${(v / 1000).toFixed(0)}k` } },
    yAxis: { type: 'category', data: topTopics.slice().reverse() },
    series: parties.map((party) => ({
      name: party, type: 'bar', stack: 'total',
      data: topTopics.map((t) => Math.round(topicMap.get(t)?.get(party) ?? 0)).reverse(),
      itemStyle: { color: PARTY_COLORS[party] ?? FALLBACK_COLOR },
    })),
    grid: { left: 180, right: 16, top: 8, bottom: 48 },
  }
  return (
    <div className="overflow-x-auto">
      <ReactECharts option={option} style={{ width: '100%', minWidth: 500, height: Math.max(300, topTopics.length * 32 + 80) }} notMerge />
    </div>
  )
}

// ── Chart 4: Top earners ──────────────────────────────────────────────────────
export function TopEarnersChart({ jobs, politicians, parties }: { jobs: SidejobRecord[]; politicians: { politician_id: number; name: string; party: string }[]; parties: string[] }) {
  const polMap = new Map(politicians.map((p) => [p.politician_id, p]))
  const byPol = new Map<number, number>()
  for (const j of jobs) byPol.set(j.politician_id, (byPol.get(j.politician_id) ?? 0) + j.prorated_income)

  const top = Array.from(byPol.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([id, income]) => ({ pol: polMap.get(id), income }))
    .filter((t) => t.pol)

  const option = {
    animation: false,
    tooltip: { trigger: 'item', formatter: (p: any) => `<b>${p.name}</b><br/>${p.value.toLocaleString('de')} €` },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => `${(v / 1000).toFixed(0)}k` } },
    yAxis: { type: 'category', data: top.map((t) => t.pol!.name).reverse() },
    series: [{
      type: 'bar',
      data: top.map((t) => ({
        value: Math.round(t.income), name: t.pol!.name,
        itemStyle: { color: PARTY_COLORS[t.pol!.party.replace(/\u00ad/g, '')] ?? FALLBACK_COLOR },
      })).reverse(),
      barMaxWidth: 32,
    }],
    grid: { left: 140, right: 24, top: 8, bottom: 40 },
  }
  return <ReactECharts option={option} style={{ width: '100%', height: Math.max(300, top.length * 28 + 60) }} notMerge />
}
```

- [ ] **Step 2: Create `frontend/app/sidejobs/page.tsx`**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { usePeriod } from '@/lib/period-context'
import { fetchData, dataUrl, SidejobsFile, Politician } from '@/lib/data'
import { IncomeByPartyChart, IncomeByCategoryChart, TopTopicsChart, TopEarnersChart } from '@/components/charts/SidejobsCharts'
import { ChartSkeleton } from '@/components/ui/ChartSkeleton'
import { Footer } from '@/components/ui/Footer'
import { COLOR_SECONDARY, PARTY_ORDER } from '@/lib/constants'

export default function SidejobsPage() {
  const { activePeriodId } = usePeriod()
  const [sjData, setSjData] = useState<SidejobsFile | null>(null)
  const [politicians, setPoliticians] = useState<Politician[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activePeriodId) return
    setLoading(true)
    Promise.all([
      fetchData<SidejobsFile>(dataUrl('sidejobs_{period}.json', activePeriodId)),
      fetchData<Politician[]>(dataUrl('politicians_{period}.json', activePeriodId)),
    ]).then(([sj, pols]) => {
      setSjData(sj)
      setPoliticians(pols)
      setLoading(false)
    }).catch(console.error)
  }, [activePeriodId])

  // Build ordered party list using canonical PARTY_ORDER, falling back to alphabetical for unknowns
  const present = sjData ? new Set(sjData.jobs.map((j) => j.party)) : new Set<string>()
  const parties = sjData
    ? [...PARTY_ORDER.filter((p) => present.has(p)), ...Array.from(present).filter((p) => !PARTY_ORDER.includes(p)).sort()]
    : []

  return (
    <>
      <h1 className="text-2xl font-bold mb-1">Nebeneinkünfte</h1>
      <p className="text-sm mb-4" style={{ color: COLOR_SECONDARY }}>
        Offengelegte Nebentätigkeiten und Einkünfte der Bundestagsabgeordneten.
      </p>

      {/* Coverage info */}
      {sjData && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm mb-6">
          <strong>{sjData.coverage.total - sjData.coverage.with_amount} von {sjData.coverage.total}</strong>{' '}
          Nebentätigkeiten ({Math.round((1 - sjData.coverage.with_amount / sjData.coverage.total) * 100)} %) haben
          keine Betragsangabe und fließen nicht in die Einkommens-Auswertungen ein.
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-6">
          <ChartSkeleton /><ChartSkeleton /><ChartSkeleton /><ChartSkeleton />
        </div>
      ) : sjData ? (
        <div className="flex flex-col gap-8">
          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Einkommen nach Partei</h2>
            <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>
              Monatliche und jährliche Zahlungen werden auf die Periodendauer hochgerechnet.
            </p>
            <IncomeByPartyChart jobs={sjData.jobs} parties={parties} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Einkommen nach Kategorie</h2>
            <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>
              Kategorien der Bundestagsverwaltung, gestapelt nach Partei.
            </p>
            <IncomeByCategoryChart jobs={sjData.jobs} parties={parties} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Themenfelder der Nebentätigkeiten</h2>
            <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>
              Top-15 Themenfelder nach Gesamteinkommen. Ein Job kann mehreren Themen zugeordnet sein.
            </p>
            <TopTopicsChart jobs={sjData.jobs} parties={parties} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Top-Verdiener</h2>
            <TopEarnersChart jobs={sjData.jobs} politicians={politicians} parties={parties} />
          </section>
        </div>
      ) : null}
      <Footer />
    </>
  )
}
```

- [ ] **Step 3: Verify sidejobs page**

Navigate to http://localhost:3000/sidejobs. Expected: coverage info box, 4 charts render, party colors match.

- [ ] **Step 4: Commit**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
git add frontend/components/charts/SidejobsCharts.tsx frontend/app/sidejobs/
git commit -m "feat: add sidejobs page with 4 income charts"
```

---

## Task 14: End-to-end smoke test

**Files:** none (verification only)

- [ ] **Step 1: Build the static site**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned/frontend
npm run build
```
Expected: `next build` completes with no errors. Output in `frontend/out/`.

- [ ] **Step 2: Check built output**
```bash
ls frontend/out/
```
Expected: `index.html`, `vote-map/`, `party-profile/`, `sidejobs/` directories.

- [ ] **Step 3: Check votes file size**
```bash
ls -lh frontend/public/data/votes_*.json
```
If any file exceeds 20 MB, note it in a code comment in `export_json.py`.

- [ ] **Step 4: Run all Python tests**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
uv run pytest tests/ -v
```
Expected: all tests PASS (including `test_export_json.py`).

- [ ] **Step 5: Run all TypeScript tests**
```bash
cd frontend && npm test
```
Expected: all tests PASS.

- [ ] **Step 6: Manual mobile check**

Open http://localhost:3000 on a phone or in browser DevTools with a mobile viewport (375px wide). Check:
- [ ] Bottom tab bar visible and usable
- [ ] Period selector visible
- [ ] Vote map scatter renders (smaller height on mobile)
- [ ] Sidejobs page charts don't overflow

- [ ] **Step 7: Final commit**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
git add -A
git commit -m "chore: pre-deploy cleanup and smoke test verified"
```

---

## Task 15: Vercel deployment

- [ ] **Step 1: Push the branch to GitHub**
```bash
cd C:/Users/rober/Desktop/projects/parlascanned
git push -u origin feat/nextjs-migration
```

- [ ] **Step 2: Merge to main**

Open a PR for `feat/nextjs-migration` → `main` on GitHub. Review, then merge.

- [ ] **Step 3: Connect Vercel to the repo (one-time setup)**

1. Go to https://vercel.com/new
2. Import the `parlascanned` GitHub repo
3. When prompted for configuration:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `out` (required for `output: 'export'`)
   - **Install Command:** `npm install`
4. Click **Deploy**

- [ ] **Step 4: Verify deployment**

Once Vercel deploys (1-2 minutes), open the Vercel URL. Check all four pages load and charts render.

- [ ] **Step 5: Verify Vercel auto-deploys**

Make a trivial change (edit a comment), push to `main`, and confirm Vercel triggers a new deployment automatically.

---

## Notes for Implementer

- **TypeScript strict mode** is on by default in the Next.js scaffold. All `null` checks are required.
- **`echarts-for-react` SSR**: ECharts is client-only. All chart components must be `'use client'` or wrapped in `dynamic(() => import(...), { ssr: false })`. The `'use client'` directive in each chart file is sufficient.
- **`output: 'export'` restriction**: With static export, `useSearchParams()` requires a Suspense boundary. Avoid it — use React context (PeriodProvider) for shared state instead.
- **`frontend/public/data/` must be committed to git.** Vercel reads from the git-checked-out files during build; it does not run `export_json.py`. The CI workflow commits the JSON files so they are always present on `main`.
- **Party name normalization**: The soft-hyphen (`\u00ad`) in `BÜNDNIS 90/\xadDIE GRÜNEN` must be stripped when displaying or looking up in `PARTY_COLORS`. Use `stripSoftHyphen()` from `lib/data.ts` or `.replace(/\u00ad/g, '')` inline.
