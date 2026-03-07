import logging
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import umap
from torch import nn
from torch.utils.data import DataLoader, Dataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

PERIOD_ID = 161  # Target legislative period (Bundestag 2025 - 2029)
N_FACTORS = 8
N_EPOCHS = 50
BATCH_SIZE = 256
LR = 0.01
VAL_SPLIT = 0.1
PATIENCE = 5

DATA_DIR = Path(__file__).parents[1] / "data"
OUTPUTS_DIR = Path(__file__).parents[1] / "outputs"


class VoteDataset(Dataset[tuple[torch.Tensor, torch.Tensor, torch.Tensor]]):
    """PyTorch Dataset serving (politician_idx, poll_idx, rating) triplets."""

    def __init__(self, df: pd.DataFrame) -> None:
        self.p = torch.tensor(df["p_idx"].to_numpy(), dtype=torch.long)
        self.poll = torch.tensor(df["poll_idx"].to_numpy(), dtype=torch.long)
        self.y = torch.tensor(df["rating"].to_numpy(), dtype=torch.float)

    def __len__(self) -> int:
        return len(self.y)

    def __getitem__(self, idx) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:  # ty: ignore[invalid-method-override]
        return self.p[idx], self.poll[idx], self.y[idx]


class PoliticianEmbeddingModel(nn.Module):
    """Matrix factorization: dot product of politician and poll embeddings + biases."""

    def __init__(
        self, n_politicians: int, n_polls: int, n_factors: int = N_FACTORS
    ) -> None:
        super().__init__()
        self.p_embed = nn.Embedding(n_politicians, n_factors)
        self.p_bias = nn.Embedding(n_politicians, 1)
        self.poll_embed = nn.Embedding(n_polls, n_factors)
        self.poll_bias = nn.Embedding(n_polls, 1)

    def forward(self, p: torch.Tensor, poll: torch.Tensor) -> torch.Tensor:
        dot = (self.p_embed(p) * self.poll_embed(poll)).sum(dim=1)
        return dot + self.p_bias(p).squeeze() + self.poll_bias(poll).squeeze()


def load_data(period_id: int) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Load votes, politicians and polls CSVs for a given period."""
    votes_path = DATA_DIR / f"votes_{period_id}.csv"
    if not votes_path.exists():
        log.error("%s not found! Run fetch_data.py first.", votes_path)
        raise SystemExit(1)
    log.info("Loading data for period %d...", period_id)
    return (
        pd.read_csv(votes_path),
        pd.read_csv(DATA_DIR / f"politicians_{period_id}.csv"),
        pd.read_csv(DATA_DIR / f"polls_{period_id}.csv"),
    )


def prepare_votes(
    df: pd.DataFrame, p_df: pd.DataFrame, poll_df: pd.DataFrame
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Filter to binary yes/no votes and add integer indices for embedding layers."""
    df = df[df["answer"].isin({"yes", "no"})].copy()
    df["rating"] = (df["answer"] == "yes").astype(float)

    p_ids = p_df["politician_id"].unique()
    poll_ids = poll_df["poll_id"].unique()

    df = df[df["politician_id"].isin(p_ids) & df["poll_id"].isin(poll_ids)].copy()
    df["p_idx"] = df["politician_id"].map({pid: i for i, pid in enumerate(p_ids)})
    df["poll_idx"] = df["poll_id"].map({pid: i for i, pid in enumerate(poll_ids)})

    return df, p_ids, poll_ids


def train(
    df: pd.DataFrame, n_politicians: int, n_polls: int
) -> PoliticianEmbeddingModel:
    """Train with early stopping on a held-out validation split."""
    val_df = df.sample(frac=VAL_SPLIT, random_state=42)
    train_df = df.drop(val_df.index)
    log.info("Training on %d votes, validating on %d.", len(train_df), len(val_df))

    model = PoliticianEmbeddingModel(n_politicians, n_polls)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR, weight_decay=1e-5)
    criterion = nn.BCEWithLogitsLoss()
    train_dl = DataLoader(VoteDataset(train_df), batch_size=BATCH_SIZE, shuffle=True)
    val_dl = DataLoader(VoteDataset(val_df), batch_size=BATCH_SIZE)

    best_val_loss = float("inf")
    best_state: dict = {}
    epochs_without_improvement = 0

    for epoch in range(N_EPOCHS):
        model.train()
        train_loss = sum(
            _step(model, optimizer, criterion, p, poll, y) for p, poll, y in train_dl
        ) / len(train_dl)

        val_loss = _eval(model, criterion, val_dl)

        log.info(
            "Epoch %d/%d - train: %.4f  val: %.4f",
            epoch + 1,
            N_EPOCHS,
            train_loss,
            val_loss,
        )

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= PATIENCE:
                log.info("Early stopping at epoch %d.", epoch + 1)
                break

    model.load_state_dict(best_state)
    return model


def _step(
    model: PoliticianEmbeddingModel,
    optimizer: torch.optim.Optimizer,
    criterion: nn.Module,
    p: torch.Tensor,
    poll: torch.Tensor,
    y: torch.Tensor,
) -> float:
    """Single training step, returns batch loss."""
    optimizer.zero_grad()
    loss = criterion(model(p, poll), y)
    loss.backward()
    optimizer.step()
    return loss.item()


@torch.no_grad()
def _eval(
    model: PoliticianEmbeddingModel, criterion: nn.Module, dl: DataLoader
) -> float:
    """Compute average loss over a DataLoader without updating gradients."""
    model.eval()
    return sum(criterion(model(p, poll), y).item() for p, poll, y in dl) / len(dl)


def save_embeddings(
    model: PoliticianEmbeddingModel,
    p_df: pd.DataFrame,
    p_ids: np.ndarray,
    period_id: int,
) -> np.ndarray:
    """Export full-dimensional embeddings to CSV and return the raw numpy array."""
    embeddings = model.p_embed.weight.detach().numpy()
    emb_df = pd.DataFrame(
        embeddings, columns=[f"dim_{i}" for i in range(embeddings.shape[1])]
    )
    emb_df["politician_id"] = p_ids
    path = OUTPUTS_DIR / f"politician_embeddings_{period_id}.csv"
    p_df.merge(emb_df, on="politician_id").to_csv(path, index=False)
    log.info("Embeddings saved to %s", path)
    return embeddings


def save_2d_embeddings(
    embeddings: np.ndarray, p_df: pd.DataFrame, period_id: int
) -> None:
    """Reduce embeddings to 2D via UMAP and export visualization CSV."""
    log.info("Running UMAP to produce 2D visualization embeddings...")
    coords = umap.UMAP(n_components=2, random_state=42).fit_transform(embeddings)
    viz_df = p_df.copy()
    viz_df["x"] = coords[:, 0]
    viz_df["y"] = coords[:, 1]
    path = OUTPUTS_DIR / f"politician_embeddings_{period_id}_2d.csv"
    viz_df.to_csv(path, index=False)
    log.info("2D embeddings saved to %s", path)


def main() -> None:
    OUTPUTS_DIR.mkdir(exist_ok=True)
    df_votes, p_df, poll_df = load_data(PERIOD_ID)
    df_votes, p_ids, poll_ids = prepare_votes(df_votes, p_df, poll_df)
    model = train(df_votes, len(p_ids), len(poll_ids))
    embeddings = save_embeddings(model, p_df, p_ids, PERIOD_ID)
    save_2d_embeddings(embeddings, p_df, PERIOD_ID)


if __name__ == "__main__":
    main()
