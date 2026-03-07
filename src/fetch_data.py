import csv
import logging
from pathlib import Path

import pandas as pd
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

BASE_URL = "https://www.abgeordnetenwatch.de/api/v2"
PARLIAMENT_PERIOD_ID = 161  # Bundestag 2025 - 2029 (21st legislative period)
PAGE_SIZE = 100

DATA_DIR = Path(__file__).parents[1] / "data"


def fetch_all_v2(endpoint: str, params: dict | None = None) -> list:
    """Fetch all pages from a paginated API endpoint."""
    params = dict(params or {})  # copy to avoid mutating the caller's dict
    all_data = []
    range_start = 0
    while True:
        params.update(
            {"range_start": range_start, "range_end": range_start + PAGE_SIZE}
        )
        response = requests.get(f"{BASE_URL}/{endpoint}", params=params, timeout=10)
        response.raise_for_status()
        page = response.json()["data"]
        all_data.extend(page)
        if len(page) < PAGE_SIZE:
            break
        range_start += PAGE_SIZE
    return all_data


def fetch_polls(period_id: int) -> pd.DataFrame:
    """Fetch all polls for a legislative period."""
    log.info("Fetching polls for period %d...", period_id)
    polls = fetch_all_v2("polls", params={"field_legislature": period_id})
    df = pd.DataFrame([{"poll_id": p["id"], "topic": p["label"]} for p in polls])
    log.info("Found %d polls.", len(df))
    return df


def fetch_politicians(period_id: int) -> tuple[pd.DataFrame, dict]:
    """Fetch politicians and return (df, mandate_id -> politician_id mapping)."""
    log.info("Fetching mandates (politicians)...")
    mandates = fetch_all_v2(
        "candidacies-mandates", params={"parliament_period": period_id}
    )

    politician_info = []
    seen_ids: set = set()
    mandate_to_politician = {}

    for m in mandates:
        pol = m["politician"]
        p_id = pol["id"]
        mandate_to_politician[m["id"]] = p_id

        if p_id not in seen_ids:
            fractions = m.get("fraction_membership", [])
            party = "Unknown"
            if fractions:
                party = fractions[0].get("fraction", {}).get("label", "Unknown")
                # Strip legislative period suffix, e.g. "SPD (2021-2025)" -> "SPD"
                if " (" in party:
                    party = party.split(" (")[0]
            politician_info.append(
                {"politician_id": p_id, "name": pol["label"], "party": party}
            )
            seen_ids.add(p_id)

    df = pd.DataFrame(politician_info)
    log.info("Extracted %d unique politicians.", len(df))
    return df, mandate_to_politician


def fetch_votes(poll_ids, mandate_to_politician: dict, path: Path) -> None:
    """Fetch votes for all polls and write to CSV incrementally."""
    log.info("Fetching votes incrementally...")
    n = len(poll_ids)
    with path.open(mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["politician_id", "poll_id", "answer"])
        for i, poll_id in enumerate(poll_ids):
            log.info("[%d/%d] Fetching votes for poll %s...", i + 1, n, poll_id)
            try:
                votes = fetch_all_v2("votes", params={"poll": poll_id})
                for v in votes:
                    m_id = v.get("mandate", {}).get("id")
                    p_id = mandate_to_politician.get(m_id)
                    if p_id:
                        writer.writerow([p_id, poll_id, v["vote"]])
            except Exception:
                log.exception("Error fetching votes for poll %s", poll_id)


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)

    df_polls = fetch_polls(PARLIAMENT_PERIOD_ID)
    df_polls.to_csv(DATA_DIR / f"polls_{PARLIAMENT_PERIOD_ID}.csv", index=False)

    df_politicians, mandate_to_politician = fetch_politicians(PARLIAMENT_PERIOD_ID)
    df_politicians.to_csv(
        DATA_DIR / f"politicians_{PARLIAMENT_PERIOD_ID}.csv", index=False
    )

    fetch_votes(
        df_polls["poll_id"],
        mandate_to_politician,
        DATA_DIR / f"votes_{PARLIAMENT_PERIOD_ID}.csv",
    )

    log.info("Done! All data saved to %s", DATA_DIR)


if __name__ == "__main__":
    main()
