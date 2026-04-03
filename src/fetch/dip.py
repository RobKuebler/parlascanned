"""Generic HTTP client for the DIP Bundestag API.

Provides fetch_dip_all() for cursor-paginated requests against
https://search.dip.bundestag.de/api/v1. Uses curl instead of
requests to bypass the enodia bot-challenge that blocks python-requests.

Intended to be imported by any module that queries the DIP API
(protocol_xml, antraege, drucksachen, …).
"""

import json
import logging
import os
import subprocess
import time
import urllib.parse

log = logging.getLogger(__name__)

DIP_BASE_URL = "https://search.dip.bundestag.de/api/v1"
DIP_PAGE_SIZE = 100


def _curl_get(url: str, params: dict) -> dict:
    """Make a GET request via curl and return parsed JSON.

    curl bypasses the enodia bot-challenge that blocks python-requests.
    Retries up to 5 times on empty or non-JSON responses.
    """
    full_url = f"{url}?{urllib.parse.urlencode(params)}"
    for attempt in range(5):
        result = subprocess.run(  # noqa: S603
            [  # noqa: S607
                "curl",
                "-s",
                "--retry",
                "3",
                "--retry-delay",
                "2",
                "--retry-connrefused",
                full_url,
            ],
            capture_output=True,
            check=False,
        )
        if result.returncode != 0:
            stderr = result.stderr.decode(errors="replace").strip()
            msg = f"curl failed (exit {result.returncode}): {stderr}"
            raise RuntimeError(msg)
        body = result.stdout.decode("utf-8")
        if not body.strip():
            wait = 2**attempt
            log.warning(
                "Empty response (attempt %d/5), retrying in %ds…", attempt + 1, wait
            )
            time.sleep(wait)
            continue
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            wait = 2**attempt
            log.warning(
                "Non-JSON response (attempt %d/5), body: %.200s — retrying in %ds…",
                attempt + 1,
                body,
                wait,
            )
            time.sleep(wait)
    msg = "curl returned no valid JSON after 5 attempts"
    raise RuntimeError(msg)


def fetch_dip_all(endpoint: str, params: dict | None = None) -> list:
    """Fetch all records from a DIP endpoint using cursor pagination.

    Reads DIP_API_KEY from the environment. Stops when a page returns
    fewer than DIP_PAGE_SIZE documents or when the response omits the
    cursor field.
    """
    api_key = os.environ.get("DIP_API_KEY")
    if not api_key:
        msg = (
            "DIP_API_KEY is missing. Set it as an environment variable "
            "or GitHub Actions secret."
        )
        raise RuntimeError(msg)

    results = []
    cursor = None
    base_params: dict = {
        "format": "json",
        "apikey": api_key,
        "limit": DIP_PAGE_SIZE,
    }
    if params:
        base_params.update(params)

    total_found = None
    while True:
        call_params = {**base_params}
        if cursor:
            call_params["cursor"] = cursor
        data = _curl_get(f"{DIP_BASE_URL}/{endpoint}", call_params)
        if total_found is None:
            total_found = data.get("numFound", "?")
        docs = data.get("documents", [])
        results.extend(docs)
        log.info("/%s: %d / %s records fetched…", endpoint, len(results), total_found)
        if len(docs) < DIP_PAGE_SIZE:
            break
        cursor = data.get("cursor")
        if not cursor:
            break

    log.info("Fetched %d records from /%s", len(results), endpoint)
    return results
