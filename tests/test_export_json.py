"""Tests for src/export_json.py.

Verifies that export_period produces correctly-shaped JSON output.
Uses real period 161 data (must have been fetched already).
"""

import json
from datetime import date
from pathlib import Path
from typing import Any

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


def _load(run_export: Path, name: str) -> Any:
    return json.loads((run_export / name).read_text())


def test_politicians_shape(run_export):
    data = _load(run_export, f"politicians_{PERIOD_ID}.json")
    assert isinstance(data, list)
    assert len(data) > 0
    required = {
        "politician_id",
        "name",
        "party",
        "sex",
        "year_of_birth",
        "occupation",
        "education",
        "field_title",
    }
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
    assert len(data["jobs"]) > 0, (
        "Expected period 161 to have sidejobs with income amounts"
    )
    job = data["jobs"][0]
    assert {
        "politician_id",
        "party",
        "prorated_income",
        "topics",
        "has_amount",
    }.issubset(job.keys())
    assert isinstance(job["topics"], list)


def test_party_profile_shape(run_export):
    data = _load(run_export, f"party_profile_{PERIOD_ID}.json")
    assert "parties" in data
    assert "age" in data
    assert "sex" in data
    assert "titles" in data
    assert "occupation" in data
    assert "education_field" in data
    assert "education_degree" in data
    for key in ("occupation", "education_field", "education_degree"):
        pivot = data[key]
        assert {"categories", "parties", "pct", "dev"}.issubset(pivot.keys())
        assert len(pivot["pct"]) == len(pivot["categories"])
        assert len(pivot["pct"][0]) == len(pivot["parties"])
