import logging
from datetime import UTC
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parents[1] / "data"
OUTPUTS_DIR = Path(__file__).parents[1] / "outputs"


def current_bundestag_number() -> int:
    """Return the bundestag_number of the currently active legislature from periods.csv.

    Falls back to the latest known period if today falls outside all known ranges
    (e.g. a future period whose end_date is not yet set).
    """
    from datetime import datetime

    df = pd.read_csv(DATA_DIR / "periods.csv")
    today = datetime.now(tz=UTC).date().isoformat()
    active = df[(df["start_date"] <= today) & (df["end_date"] >= today)]
    row = active.iloc[0] if not active.empty else df.iloc[-1]
    return int(row["bundestag_number"])


def load_data(period_id: int) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Load votes, politicians and polls CSVs for a given period."""
    period_dir = DATA_DIR / str(period_id)
    votes_path = period_dir / "votes.csv"
    if not votes_path.exists():
        log.error("%s not found! Run fetch_data.py first.", votes_path)
        raise SystemExit(1)
    log.info("Loading data for period %d...", period_id)
    return (
        pd.read_csv(votes_path),
        pd.read_csv(period_dir / "politicians.csv"),
        pd.read_csv(period_dir / "polls.csv"),
    )


def save_embeddings(
    model: Any,
    p_df: pd.DataFrame,
    p_ids: np.ndarray,
    period_id: int,
) -> None:
    """Export embeddings to CSV with politician metadata. Columns: x, y (z for 3D)."""
    weights = model.p_embed.weight.detach().numpy()
    n_dims = weights.shape[1]
    coords = {"x": weights[:, 0], "y": weights[:, 1]}
    if n_dims == 3:
        coords["z"] = weights[:, 2]
    emb_df = pd.DataFrame({"politician_id": p_ids, **coords})
    path = OUTPUTS_DIR / f"politician_embeddings_{period_id}.csv"
    p_df.merge(emb_df, on="politician_id").to_csv(path, index=False)
    log.info("Embeddings saved to %s", path)
