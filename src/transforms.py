import numpy as np
import pandas as pd

from src.occupation_clusters import normalize_occupation


def compute_cohesion(
    df: pd.DataFrame, *, exclude_party: str | None = None
) -> pd.DataFrame:
    """Compute average distance from party centroid per party.

    Accepts a 2D embeddings DataFrame with columns: x, y, party.
    Returns DataFrame with columns: party, streuung, label. Sorted ascending.
    """
    centroids = df.groupby("party")[["x", "y"]].mean()
    cx = df["party"].map(centroids["x"])
    cy = df["party"].map(centroids["y"])
    coh = (
        np.sqrt((df["x"] - cx) ** 2 + (df["y"] - cy) ** 2)
        .groupby(df["party"])
        .mean()
        .reset_index(name="streuung")
    )
    if exclude_party is not None:
        coh = coh[coh["party"] != exclude_party]
    coh["label"] = coh["party"].str.replace("\xad", "", regex=False)
    return coh.sort_values("streuung")


def compute_occupation_pivot(
    pols_df: pd.DataFrame, party_labels_ordered: list[str]
) -> tuple[pd.DataFrame, np.ndarray, float]:
    """Build occupation frequency pivot matrix for the heatmap.

    Returns (pivot, z, zmax) where z is the numpy matrix with 0 replaced by NaN
    and zmax is the 80th percentile (used to cap the colorscale).
    """
    occ_df = pols_df[["party_label", "occupation"]].copy()
    occ_df["occ_cat"] = (
        occ_df["occupation"]
        .where(occ_df["occupation"].notna(), other=None)
        .apply(normalize_occupation)
    )
    counts = occ_df.groupby(["party_label", "occ_cat"]).size().reset_index(name="count")
    pivot = counts.pivot_table(
        index="occ_cat", columns="party_label", values="count", fill_value=0
    )
    occ_totals = counts.groupby("occ_cat")["count"].sum().sort_values(ascending=False)
    pivot = pivot.reindex(occ_totals.index)
    pivot = pivot.reindex(
        columns=[p for p in party_labels_ordered if p in pivot.columns]
    )
    z = pivot.to_numpy().astype(float)
    z[z == 0] = np.nan
    zmax = float(np.nanpercentile(z, 80))
    return pivot, z, zmax


def compute_age_df(pols_df: pd.DataFrame, current_year: int) -> pd.DataFrame:
    """Add 'alter' (age) column; drops rows with missing year_of_birth."""
    age_df = (
        pols_df[["party_label", "year_of_birth"]]
        .dropna(subset=["year_of_birth"])
        .copy()
    )
    age_df["alter"] = current_year - age_df["year_of_birth"].astype(int)
    return age_df


def compute_sex_counts(pols_df: pd.DataFrame) -> pd.DataFrame:
    """Compute gender distribution per party with percentage column.

    Returns DataFrame with columns: party_label, geschlecht, count, pct.
    """
    sex_df = pols_df[["party_label", "sex"]].dropna(subset=["sex"]).copy()
    sex_map = {"m": "Männlich", "f": "Weiblich", "d": "Divers"}
    sex_df["geschlecht"] = sex_df["sex"].map(sex_map).fillna(sex_df["sex"])
    counts = (
        sex_df.groupby(["party_label", "geschlecht"]).size().reset_index(name="count")
    )
    totals = counts.groupby("party_label")["count"].transform("sum")
    counts["pct"] = (counts["count"] / totals * 100).round(1)
    return counts


def compute_title_counts(pols_df: pd.DataFrame) -> pd.DataFrame:
    """Compute Mit Titel / Ohne Titel distribution per party with percentage column.

    Returns DataFrame with columns: party_label, titel, count, pct.
    """
    title_df = pols_df[["party_label", "field_title"]].copy()
    title_df["titel"] = title_df["field_title"].apply(
        lambda t: "Mit Titel" if isinstance(t, str) and t.strip() else "Ohne Titel"
    )
    counts = title_df.groupby(["party_label", "titel"]).size().reset_index(name="count")
    totals = counts.groupby("party_label")["count"].transform("sum")
    counts["pct"] = (counts["count"] / totals * 100).round(1)
    return counts
