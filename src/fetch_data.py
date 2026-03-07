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

# Abgeordnetenwatch API configuration
BASE_URL = "https://www.abgeordnetenwatch.de/api/v2"
PARLIAMENT_PERIOD_ID = 161  # Bundestag 2025 - 2029 (21st legislative period)

DATA_DIR = Path(__file__).parents[1] / "data"
DATA_DIR.mkdir(exist_ok=True)


def fetch_all_v2(endpoint, params=None):
    """
    Utility function to fetch all results from a paginated API endpoint.
    Uses range_start and range_end for navigation.
    """
    if params is None:
        params = {}

    all_data = []
    range_start = 0
    step = 100

    while True:
        params.update(
            {
                "range_start": range_start,
                "range_end": range_start + step,
            },
        )
        response = requests.get(f"{BASE_URL}/{endpoint}", params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        all_data.extend(data["data"])

        # Break loop if we received fewer results than the step size (end of list)
        if len(data["data"]) < step:
            break
        range_start += step
    return all_data


# 1. Fetch Polls for the specified legislative period
log.info("Fetching polls for period %d...", PARLIAMENT_PERIOD_ID)
polls = fetch_all_v2("polls", params={"field_legislature": PARLIAMENT_PERIOD_ID})
poll_list = [{"poll_id": p["id"], "topic": p["label"]} for p in polls]
df_polls = pd.DataFrame(poll_list)
df_polls.to_csv(DATA_DIR / f"polls_{PARLIAMENT_PERIOD_ID}.csv", index=False)
log.info("Found %d polls. Saved to polls_%d.csv.", len(df_polls), PARLIAMENT_PERIOD_ID)

# 2. Fetch Mandates to get politicians and their party affiliations
log.info("Fetching mandates (politicians)...")
mandates = fetch_all_v2(
    "candidacies-mandates",
    params={"parliament_period": PARLIAMENT_PERIOD_ID},
)
politician_info = []
politician_ids = set()
mandate_to_politician = {}

for m in mandates:
    pol = m["politician"]
    p_id = pol["id"]
    m_id = m["id"]
    # Map mandate ID to politician ID for vote matching
    mandate_to_politician[m_id] = p_id

    if p_id not in politician_ids:
        # Extract party label from fraction membership
        fractions = m.get("fraction_membership", [])
        party_label = "Unknown"
        if fractions:
            # Use the first/most recent fraction entry
            party_label = fractions[0].get("fraction", {}).get("label", "Unknown")
            # Strip legislative period suffix, e.g. "SPD (2021-2025)" -> "SPD"
            if " (" in party_label:
                party_label = party_label.split(" (")[0]

        politician_info.append(
            {
                "politician_id": p_id,
                "name": pol["label"],
                "party": party_label,
            },
        )
        politician_ids.add(p_id)

df_politicians = pd.DataFrame(politician_info)
df_politicians.to_csv(DATA_DIR / f"politicians_{PARLIAMENT_PERIOD_ID}.csv", index=False)
log.info(
    "Extracted %d unique politicians. Saved to politicians_%d.csv.",
    len(df_politicians),
    PARLIAMENT_PERIOD_ID,
)

# 3. Fetch Votes incrementally to handle large data volumes and prevent timeouts
log.info("Fetching votes incrementally...")
votes_path = DATA_DIR / f"votes_{PARLIAMENT_PERIOD_ID}.csv"
with votes_path.open(mode="w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["politician_id", "poll_id", "answer"])

    for i, poll_id in enumerate(df_polls["poll_id"]):
        log.info("[%d/%d] Fetching votes for poll %s...", i + 1, len(df_polls), poll_id)
        range_start = 0
        step = 100
        while True:
            params = {
                "poll": poll_id,
                "range_start": range_start,
                "range_end": range_start + step,
            }
            try:
                response = requests.get(f"{BASE_URL}/votes", params=params, timeout=10)
                response.raise_for_status()
                data = response.json()

                for v in data["data"]:
                    m_id = v.get("mandate", {}).get("id")
                    p_id = mandate_to_politician.get(m_id)
                    if p_id:
                        writer.writerow([p_id, poll_id, v["vote"]])

                if len(data["data"]) < step:
                    break
                range_start += step
            except Exception:
                log.exception(
                    "Error fetching poll %s at range %d",
                    poll_id,
                    range_start,
                )
                break

log.info(
    "Done! Data saved to votes_%d.csv, politicians_%d.csv, and polls_%d.csv.",
    PARLIAMENT_PERIOD_ID,
    PARLIAMENT_PERIOD_ID,
    PARLIAMENT_PERIOD_ID,
)
