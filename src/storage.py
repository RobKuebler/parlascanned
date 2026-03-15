import logging
from pathlib import Path

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parents[1] / "data"
OUTPUTS_DIR = Path(__file__).parents[1] / "outputs"


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
    model,
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
