"""Download plenary protocol XMLs from dserver.bundestag.de.

Fetches protocol metadata directly from the DIP API and downloads each
XML whose file does not yet exist. Already-present files are skipped.

Usage:
    uv run python -m src.fetch.protocol_xml --period 20
"""

import argparse
import logging
import subprocess
from pathlib import Path

from ..cli import (
    add_period_argument,
    build_parser,
    configure_logging,
    write_github_output,
)
from ..fetch.abgeordnetenwatch import refresh_periods
from ..fetch.dip import fetch_dip_all
from ..paths import DATA_DIR

log = logging.getLogger(__name__)


def _curl_download(url: str, path: Path) -> None:
    """Download url to path via curl.

    curl is used instead of requests to bypass the enodia bot-challenge.
    """
    result = subprocess.run(  # noqa: S603
        ["curl", "-s", "-o", str(path), "--retry", "3", url],  # noqa: S607
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode(errors="replace").strip()
        msg = f"curl failed (exit {result.returncode}): {stderr}"
        raise RuntimeError(msg)


def fetch_protocol_xmls(period: int, out_dir: Path) -> int:
    """Download missing plenary protocol XMLs for a period.

    Fetches the list of protocols from the DIP API, then downloads each
    XML whose file does not yet exist. Returns count of newly downloaded files.
    """
    docs = fetch_dip_all(
        "plenarprotokoll",
        {"f.wahlperiode": period, "f.herausgeber": "BT"},
    )

    xml_dir = Path(out_dir) / "plenary_protocols"
    xml_dir.mkdir(exist_ok=True)

    downloaded = 0
    for doc in docs:
        if doc.get("herausgeber") != "BT":
            continue
        fundstelle = doc.get("fundstelle") or {}
        url = str(fundstelle.get("xml_url", "") or "").strip()
        dok_nr = doc.get("dokumentnummer", "?")
        if not url:
            log.warning("Protocol %s has no xml_url, skipping.", dok_nr)
            continue
        try:
            sitzungsnr = int(dok_nr.split("/")[-1])
        except (ValueError, IndexError):
            log.warning("Cannot parse sitzungsnummer from %r, skipping.", dok_nr)
            continue
        dest = xml_dir / f"{sitzungsnr:03d}.xml"
        if dest.exists():
            continue
        log.info("Downloading %s -> %s", url, dest.name)
        try:
            _curl_download(url, dest)
        except RuntimeError:
            dest.unlink(missing_ok=True)
            raise
        downloaded += 1

    log.info("Downloaded %d new XML files to %s", downloaded, xml_dir)
    return downloaded


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = build_parser("Lade fehlende XML-Dateien zu Bundestags-Plenarprotokollen.")
    add_period_argument(parser)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    configure_logging()
    args = parse_args(argv)

    period = args.period or refresh_periods()
    out_dir = DATA_DIR / str(period)

    log.info("Period %d...", period)
    n = fetch_protocol_xmls(period, out_dir)
    write_github_output(
        changed=n > 0,
        downloaded_xmls=n,
        period=period,
        wahlperiode=period,
    )
    log.info("Done. %d new XML files.", n)


if __name__ == "__main__":
    main()
