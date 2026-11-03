"""Convert period CSVs to JSON files for the Next.js frontend.

Writes to frontend/public/data/. Run via src.pipeline or standalone.
"""

import argparse
import logging
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from .analysis.transforms import (
    compute_age_df,
    compute_cohesion,
    compute_education_degree_pivot,
    compute_education_field_pivot,
    compute_effective_income,
    compute_occupation_pivot,
    compute_sex_counts,
    compute_title_counts,
)
from .cli import add_period_argument, build_parser, configure_logging
from .constants import PARTY_ORDER, SIDEJOB_CATEGORIES
from .export_utils import clean_matrix, split_topics, write_json
from .fetch.abgeordnetenwatch import fetch_periods_df
from .paths import DATA_DIR, FRONTEND_DATA_DIR, OUTPUTS_DIR

log = logging.getLogger(__name__)

OUTPUT_DIR = FRONTEND_DATA_DIR


def prepare_income_sidejobs(
    period: int,
    period_start: date,
    period_end: date,
    df_sidejobs: pd.DataFrame,
    *,
    positive_only: bool = False,
) -> pd.DataFrame:
    """Return sidejobs with numeric income and computed prorated income."""
    sj_income = df_sidejobs[df_sidejobs["income"].notna()].copy()
    sj_income["income"] = pd.to_numeric(sj_income["income"], errors="coerce")
    n_nan = int(sj_income["income"].isna().sum())
    if n_nan:
        log.warning(
            "Period %d: %d sidejob income value(s) could not be parsed as numeric"
            " and will be skipped.",
            period,
            n_nan,
        )
    sj_income = sj_income[sj_income["income"].notna()].copy()
    sj_income["prorated_income"] = sj_income.apply(
        lambda row: compute_effective_income(row, period_start, period_end), axis=1
    )
    if positive_only:
        sj_income = sj_income[sj_income["prorated_income"] > 0].copy()
    return sj_income


def export_sidejobs(
    period: int,
    pols_df: pd.DataFrame,
    period_start: date,
    period_end: date,
    df_sidejobs: pd.DataFrame,
) -> None:
    """Build and write sidejobs JSON for one period."""
    sj_df = df_sidejobs.merge(
        pols_df.filter(["politician_id", "party_label"]),
        on="politician_id",
        how="left",
    ).assign(
        category_label=lambda df: (
            pd.to_numeric(df["category"], errors="coerce")
            .map(SIDEJOB_CATEGORIES)
            .fillna("Sonstiges")
        )
    )
    n_total = len(sj_df)
    n_with = int(sj_df["income"].notna().sum())

    sj_income = prepare_income_sidejobs(
        period,
        period_start,
        period_end,
        sj_df,
    )
    has_topics = "topics" in sj_income.columns

    jobs = [
        {
            "politician_id": int(row["politician_id"]),
            "party": str(row.get("party_label") or ""),
            "category_label": str(row.get("category_label") or "Sonstiges"),
            "income_level": int(row["income_level"])
            if pd.notna(row.get("income_level"))
            else None,
            "prorated_income": round(float(row["prorated_income"]), 2),
            "topics": split_topics(row.get("topics")) if has_topics else [],
            "has_amount": True,
        }
        for row in sj_income.to_dict("records")
    ]

    write_json(
        OUTPUT_DIR / str(period) / "sidejobs.json",
        {"jobs": jobs, "coverage": {"total": n_total, "with_amount": n_with}},
    )


def export_conflicts(
    period: int,
    pols_df: pd.DataFrame,
    period_start: date,
    period_end: date,
    df_sidejobs: pd.DataFrame,
    df_committees: pd.DataFrame,
    df_memberships: pd.DataFrame,
) -> None:
    """Compute and export conflict-of-interest data."""
    sj = prepare_income_sidejobs(
        period,
        period_start,
        period_end,
        df_sidejobs,
        positive_only=True,
    )
    sj["sidejob_topics"] = sj["topics"].apply(lambda value: set(split_topics(value)))
    sj = sj[sj["sidejob_topics"].map(len) > 0]

    committees = df_committees.copy()
    committees["committee_topics"] = committees["topics"].apply(
        lambda value: set(split_topics(value))
    )
    committees = committees[committees["committee_topics"].map(len) > 0]

    mem = df_memberships.merge(
        committees.filter(["committee_id", "label", "committee_topics"]),
        on="committee_id",
        how="inner",
    )
    merged = mem.merge(
        sj.filter(["politician_id", "sidejob_topics", "prorated_income"]),
        on="politician_id",
        how="inner",
    )

    empty_result = {
        "stats": {
            "total_income": 0.0,
            "affected_politicians": 0,
            "affected_committees": 0,
        },
        "conflicts": [],
    }
    output_path = OUTPUT_DIR / str(period) / "conflicts.json"

    if merged.empty:
        write_json(output_path, empty_result)
        return

    merged["intersection"] = merged.apply(
        lambda row: row["committee_topics"] & row["sidejob_topics"], axis=1
    )
    conflicted = merged[merged["intersection"].map(len) > 0]
    if conflicted.empty:
        write_json(output_path, empty_result)
        return

    rows: list[dict] = []
    party_map = pols_df.set_index("politician_id")["party_label"].to_dict()
    for (politician_id, committee_label), group in conflicted.groupby(
        ["politician_id", "label"]
    ):
        rows.append(
            {
                "politician_id": int(politician_id),
                "party": str(party_map.get(int(politician_id), "")),
                "committee_label": str(committee_label),
                "matching_topics": sorted(set().union(*group["intersection"])),
                "conflicted_income": round(float(group["prorated_income"].sum()), 2),
            }
        )

    rows.sort(key=lambda row: row["conflicted_income"], reverse=True)
    stats = {
        "total_income": round(sum(row["conflicted_income"] for row in rows), 2),
        "affected_politicians": len({row["politician_id"] for row in rows}),
        "affected_committees": len({row["committee_label"] for row in rows}),
    }
    write_json(output_path, {"stats": stats, "conflicts": rows})


def pivot_to_json(
    pivot_pct: pd.DataFrame,
    dev_z: np.ndarray,
    pivot_count: pd.DataFrame,
) -> dict:
    """Serialize a deviation pivot for the frontend DeviationHeatmap component."""
    return {
        "categories": list(pivot_pct.index),
        "parties": list(pivot_pct.columns),
        "pct": clean_matrix(pivot_pct.to_numpy().astype(float), 1),
        "dev": clean_matrix(dev_z, 2),
        "count": [
            [int(value) for value in row]
            for row in pivot_count.to_numpy().astype(int).tolist()
        ],
        "party_totals": [int(value) for value in pivot_count.sum(axis=0).tolist()],
    }


def export_party_profile(
    period: int,
    pols_df: pd.DataFrame,
    period_start: date,
) -> None:
    """Build and write party_profile JSON for one period."""
    present = set(pols_df["party_label"].dropna().unique())
    canonical_order = {party.replace("\xad", "") for party in PARTY_ORDER}
    ordered_parties = [
        party.replace("\xad", "")
        for party in PARTY_ORDER
        if party.replace("\xad", "") in present
    ] + sorted(present - canonical_order)

    age_df = compute_age_df(pols_df, period_start.year)
    sex_df = compute_sex_counts(pols_df)
    title_df = compute_title_counts(pols_df)
    occ_pct, _, occ_dev_z, occ_count = compute_occupation_pivot(
        pols_df, ordered_parties
    )
    field_pct, _, field_dev_z, field_count = compute_education_field_pivot(
        pols_df, ordered_parties
    )
    degree_pct, _, degree_dev_z, degree_count = compute_education_degree_pivot(
        pols_df, ordered_parties
    )

    payload = {
        "parties": ordered_parties,
        "age": age_df.filter(["name", "party_label", "alter"])
        .rename(columns={"party_label": "party", "alter": "age"})
        .to_dict("records"),
        "sex": sex_df.to_dict("records"),
        "titles": title_df.to_dict("records"),
        "occupation": pivot_to_json(occ_pct, occ_dev_z, occ_count),
        "education_field": pivot_to_json(field_pct, field_dev_z, field_count),
        "education_degree": pivot_to_json(degree_pct, degree_dev_z, degree_count),
    }

    write_json(
        OUTPUT_DIR / str(period) / "party_profile.json",
        payload,
    )


def export_period(
    period: int,
    period_start: date,
    period_end: date,
    *,
    df_politicians: pd.DataFrame,
    df_polls: pd.DataFrame,
    df_sidejobs: pd.DataFrame | None = None,
    df_committees: pd.DataFrame | None = None,
    df_memberships: pd.DataFrame | None = None,
) -> bool:
    """Export all JSON files for one parliament period.

    Returns False if required auxiliary files (embeddings, votes) are missing.
    """
    period_dir = DATA_DIR / str(period)
    emb_path = OUTPUTS_DIR / f"politician_embeddings_{period}.csv"

    if not emb_path.exists():
        log.warning("No embeddings for period %d, skipping", period)
        return False

    pols_df = df_politicians.assign(
        party=lambda df: df["party"].str.replace(
            "Die Linke.", "Die Linke", regex=False
        ),
        party_label=lambda df: (
            df["party"]
            .str.replace("Die Linke.", "Die Linke", regex=False)
            .str.replace("\xad", "", regex=False)
        ),
    )

    # ── politicians ───────────────────────────────────────────────────────────
    write_json(
        (OUTPUT_DIR / str(period)) / "politicians.json",
        pols_df.filter(
            [
                "politician_id",
                "name",
                "party",
                "sex",
                "year_of_birth",
                "occupation",
                "education",
                "field_title",
            ]
        ).to_dict("records"),
    )

    # ── embeddings ────────────────────────────────────────────────────────────
    emb_df = pd.read_csv(emb_path)
    if "z" in emb_df.columns:
        log.warning("3D embeddings detected for period %d; exporting 2D only", period)
    if "politician_id" not in emb_df.columns:
        emb_df = emb_df.merge(
            pols_df.filter(["name", "politician_id"]), on="name", how="left"
        )
    write_json(
        (OUTPUT_DIR / str(period)) / "embeddings.json",
        {
            "dimensions": 2,
            "data": emb_df.filter(["politician_id", "x", "y"]).to_dict("records"),
        },
    )

    # ── votes ─────────────────────────────────────────────────────────────────
    votes_path = period_dir / "votes.csv"
    if not votes_path.exists():
        log.warning("No votes.csv for period %d, skipping", period)
        return False
    votes_df = pd.read_csv(votes_path)
    write_json(
        (OUTPUT_DIR / str(period)) / "votes.json",
        votes_df.filter(["politician_id", "poll_id", "answer"]).to_dict("records"),
    )

    # ── polls ─────────────────────────────────────────────────────────────────
    write_json(
        (OUTPUT_DIR / str(period)) / "polls.json",
        df_polls.filter(["poll_id", "topic"]).to_dict("records"),
    )

    # ── cohesion ──────────────────────────────────────────────────────────────
    # emb_df may already have a party column from save_embeddings; drop it to
    # avoid collision, then join the canonical party from pols_df.
    coh_df = compute_cohesion(
        emb_df.filter(["politician_id", "x", "y"]).merge(
            pols_df.filter(["politician_id", "party"]), on="politician_id", how="left"
        ),
        exclude_party="fraktionslos",
    )
    write_json((OUTPUT_DIR / str(period)) / "cohesion.json", coh_df.to_dict("records"))

    # ── sidejobs ──────────────────────────────────────────────────────────────
    if df_sidejobs is not None:
        export_sidejobs(period, pols_df, period_start, period_end, df_sidejobs)

    # ── conflicts ─────────────────────────────────────────────────────────────
    if (
        df_sidejobs is not None
        and df_committees is not None
        and df_memberships is not None
    ):
        export_conflicts(
            period,
            pols_df,
            period_start,
            period_end,
            df_sidejobs,
            df_committees,
            df_memberships,
        )

    # ── party profile ─────────────────────────────────────────────────────────
    export_party_profile(period, pols_df, period_start)

    log.info("Exported period %d", period)
    return True


def export_keyword_timeline(period: int) -> None:
    """Export keyword_timeline.json for the frontend.

    Output: frontend/public/data/{period}/keyword_timeline.json
    Skipped silently if no protocol XMLs exist for the period.
    """
    from .analysis.keyword_timeline import fetch_keyword_timeline

    xml_dir = DATA_DIR / str(period) / "plenary_protocols"
    if not xml_dir.exists() or not any(xml_dir.glob("*.xml")):
        log.warning(
            "No protocol XMLs for period %d, skipping keyword timeline.", period
        )
        return

    data = fetch_keyword_timeline(DATA_DIR / str(period))
    out = OUTPUT_DIR / str(period)

    # Main file: backward-compatible schema (meta without party fields, terms only)
    write_json(
        out / "keyword_timeline.json",
        {
            "meta": {
                "months": data["meta"]["months"],
                "total_words_per_month": data["meta"]["total_words_per_month"],
            },
            "terms": data["terms"],
        },
    )

    # Party file: lazy-loaded by the frontend when party features are used
    write_json(
        out / "keyword_timeline_parties.json",
        {
            "parties": data["meta"]["parties"],
            "party_words": data["meta"]["party_words"],
            "by_party": data["by_party"],
        },
    )


def _drucksachen_cache_path(period: int, typ: str) -> Path:
    """Return the local cache file path for raw Drucksachen of one type.

    Stored in data/{period}/drucksachen_{slug}.json. The file is NOT committed
    to git — it is preserved between GitHub Actions runs via actions/cache.
    """
    slug = typ.lower().replace(" ", "_").replace("ß", "ss").replace("ö", "oe")
    return DATA_DIR / str(period) / f"drucksachen_{slug}.json"


def export_motions(period: int) -> None:
    """Fetch all Drucksachen for a period and write motions_stats.json
    and motions_titles.json.

    Raw records are cached in data/{period}/drucksachen_{typ}.json (preserved
    via GitHub Actions cache, not committed to git). If the cache file exists
    the API fetch is skipped entirely for that type.
    Skipped silently if DIP_API_KEY is not set.
    """
    import json
    import os

    if not os.environ.get("DIP_API_KEY"):
        log.warning(
            "DIP_API_KEY not set — skipping motions export for period %d.", period
        )
        return

    from .analysis.drucksachen import (
        _CANONICAL_PARTY_ORDER,
        compute_counts_by_party,
        compute_timeline,
        compute_top_authors,
        compute_word_freq,
        extract_party,
    )
    from .fetch.drucksachen import DRUCKSACHE_TYPEN, fetch_drucksachen

    stats: dict = {}
    all_titles: list[dict] = []

    for typ in DRUCKSACHE_TYPEN:
        cache_path = _drucksachen_cache_path(period, typ)

        cached: list[dict] = []
        since: str | None = None
        if cache_path.exists():
            raw = json.loads(cache_path.read_text(encoding="utf-8"))
            # f.herausgeber=BT leaks BR records from the API; filter on load so
            # any previously cached BR records are silently dropped.
            cached = [d for d in raw if d.get("herausgeber") == "BT"]
            dates = [d["datum"] for d in cached if d.get("datum")]
            if dates:
                since = max(dates)

        new_docs = fetch_drucksachen(period, typ, since=since)

        # Merge: append only records not already in the cache (deduplicate by id).
        cached_ids = {d["id"] for d in cached if "id" in d}
        new_only = [d for d in new_docs if d.get("id") not in cached_ids]
        if new_only:
            log.info("%d new Drucksachen for %s/%s", len(new_only), period, typ)
        docs = cached + new_only

        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(
            json.dumps(docs, ensure_ascii=False, indent=None), encoding="utf-8"
        )

        if not docs:
            stats[typ] = {
                "counts_by_party": [],
                "timeline": {"months": [], "series": []},
                "word_freq": {},
                "top_authors": {},
            }
            continue

        counts = compute_counts_by_party(docs)
        active = {c["party"] for c in counts}
        ordered_parties = [p for p in _CANONICAL_PARTY_ORDER if p in active]

        stats[typ] = {
            "counts_by_party": counts,
            "timeline": compute_timeline(docs, ordered_parties),
            "word_freq": compute_word_freq(docs),
            "top_authors": compute_top_authors(docs),
        }

        for doc in docs:
            party = extract_party(doc)
            titel = doc.get("titel", "")
            if party and titel:
                all_titles.append(
                    {
                        "typ": typ,
                        "party": party,
                        "datum": doc.get("datum", ""),
                        "titel": titel,
                    }
                )

    out = OUTPUT_DIR / str(period)
    write_json(out / "motions_stats.json", stats)
    write_json(out / "motions_titles.json", all_titles)


def export_periods(available: list[dict]) -> None:
    """Write the periods.json index file consumed by the frontend."""
    write_json(OUTPUT_DIR / "periods.json", available)


def _period_is_exportable(period: int) -> bool:
    """Return True if a period has input data available (votes.csv exists)."""
    return (DATA_DIR / str(period) / "votes.csv").exists()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = build_parser("Exportiere JSON-Dateien für das Frontend.")
    add_period_argument(parser)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    """Export JSON files for one or all periods."""
    configure_logging()
    args = parse_args(argv)

    periods_df = fetch_periods_df()
    if args.period is not None and args.period not in set(
        periods_df["bundestag_number"].astype(int)
    ):
        msg = f"Period {args.period} not found."
        raise SystemExit(msg)

    available: list[dict] = []

    for _, row in periods_df.iterrows():
        period = int(row["bundestag_number"])

        if _period_is_exportable(period):
            available.append(
                {
                    "wahlperiode": period,
                    "label": str(row.get("label", f"Wahlperiode {period}")),
                    "has_data": True,
                }
            )

        if args.period is not None and period != args.period:
            continue

        export_keyword_timeline(period)
        export_motions(period)

    export_periods(available)
    log.info("Done. Exported %d periods.", len(available))


if __name__ == "__main__":
    main()
