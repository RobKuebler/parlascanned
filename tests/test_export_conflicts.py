"""Unit tests for _export_conflicts() in src/export.py."""

import json
from datetime import date
from pathlib import Path

import pandas as pd
import pytest

import src.export as ej

_POLS = pd.DataFrame(
    {
        "politician_id": [1, 2, 3],
        "party": ["CDU/CSU", "SPD", "FDP"],
        "party_label": ["CDU/CSU", "SPD", "FDP"],
    }
)

_COMMITTEES = pd.DataFrame(
    {
        "committee_id": [10, 20],
        "label": ["Finanzausschuss", "Wirtschaftsausschuss"],
        "topics": ["Finanzen|Öffentliche Finanzen, Steuern und Abgaben", "Wirtschaft"],
    }
)

_MEMBERSHIPS = pd.DataFrame(
    {
        "politician_id": [1, 2, 3],
        "committee_id": [10, 20, 10],
        "role": ["Mitglied", "Mitglied", "Obmann"],
    }
)

# Pol 1: sidejob in Finanzen → conflict with Finanzausschuss
# Pol 2: sidejob in Gesundheit → no conflict with Wirtschaftsausschuss
# Pol 3: sidejob in Wirtschaft AND Finanzausschuss → no conflict (topic mismatch)
_SIDEJOBS = pd.DataFrame(
    {
        "politician_id": [1, 2, 3],
        "income": [12000.0, 8000.0, 6000.0],
        "income_level": [2, 1, 1],
        "category": ["29647", "29647", "29647"],
        "date_start": [None, None, None],
        "date_end": [None, None, None],
        "created": [1640000000, 1640000000, 1640000000],
        "interval": [None, None, None],
        "topics": ["Finanzen|Recht", "Gesundheit", "Wirtschaft"],
    }
)

_P_START = date(2025, 1, 1)
_P_END = date(2025, 12, 31)


@pytest.fixture
def conflicts_json(tmp_path, monkeypatch):
    """Run _export_conflicts into a temp dir and return the parsed JSON."""
    out_dir = tmp_path / "output"
    out_dir.mkdir()
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)
    ej._export_conflicts(
        21,
        _POLS,
        _P_START,
        _P_END,
        _SIDEJOBS,
        _COMMITTEES,
        _MEMBERSHIPS,
    )
    return json.loads((out_dir / "21" / "conflicts.json").read_text())


def test_only_matching_topics_produce_conflicts(conflicts_json):
    # Pol 3: sidejob topic is Wirtschaft, but committee is Finanzausschuss → no topic overlap, no conflict
    ids = {c["politician_id"] for c in conflicts_json["conflicts"]}
    assert ids == {1}


def test_conflict_entry_shape(conflicts_json):
    entry = conflicts_json["conflicts"][0]
    assert entry["politician_id"] == 1
    assert entry["party"] == "CDU/CSU"
    assert entry["committee_label"] == "Finanzausschuss"
    assert "Finanzen" in entry["matching_topics"]
    assert entry["conflicted_income"] > 0


def test_stats_totals(conflicts_json):
    s = conflicts_json["stats"]
    assert s["affected_politicians"] == 1
    assert s["affected_committees"] == 1
    assert s["total_income"] == conflicts_json["conflicts"][0]["conflicted_income"]


def test_sorted_by_income_descending():
    """With two conflicting politicians, output is sorted highest income first."""
    import src.export as ej2

    pols = pd.DataFrame(
        {
            "politician_id": [1, 2],
            "party": ["CDU/CSU", "SPD"],
            "party_label": ["CDU/CSU", "SPD"],
        }
    )
    committees = pd.DataFrame(
        {"committee_id": [10], "label": ["Finanzausschuss"], "topics": ["Finanzen"]}
    )
    memberships = pd.DataFrame(
        {
            "politician_id": [1, 2],
            "committee_id": [10, 10],
            "role": ["Mitglied", "Mitglied"],
        }
    )
    sidejobs = pd.DataFrame(
        {
            "politician_id": [1, 2],
            "income": [6000.0, 24000.0],
            "income_level": [1, 3],
            "category": ["29647", "29647"],
            "date_start": [None, None],
            "date_end": [None, None],
            "created": [1640000000, 1640000000],
            "interval": [None, None],
            "topics": ["Finanzen", "Finanzen"],
        }
    )

    import json
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        from unittest import mock

        with mock.patch.object(ej2, "OUTPUT_DIR", out):
            ej2._export_conflicts(
                21, pols, _P_START, _P_END, sidejobs, committees, memberships
            )
        result = json.loads((out / "21" / "conflicts.json").read_text())

    incomes = [c["conflicted_income"] for c in result["conflicts"]]
    assert incomes == sorted(incomes, reverse=True)
    assert result["conflicts"][0]["politician_id"] == 2


def test_empty_when_no_topics_overlap():
    """Returns stats zeros and empty conflicts when no topics match."""
    import json
    import tempfile

    import src.export as ej2

    pols = pd.DataFrame(
        {"politician_id": [1], "party": ["CDU/CSU"], "party_label": ["CDU/CSU"]}
    )
    committees = pd.DataFrame(
        {"committee_id": [10], "label": ["Finanzausschuss"], "topics": ["Finanzen"]}
    )
    memberships = pd.DataFrame(
        {"politician_id": [1], "committee_id": [10], "role": ["Mitglied"]}
    )
    sidejobs = pd.DataFrame(
        {
            "politician_id": [1],
            "income": [5000.0],
            "income_level": [1],
            "category": ["29647"],
            "date_start": [None],
            "date_end": [None],
            "created": [1640000000],
            "interval": [None],
            "topics": ["Gesundheit"],
        }
    )

    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        from unittest import mock

        with mock.patch.object(ej2, "OUTPUT_DIR", out):
            ej2._export_conflicts(
                21, pols, _P_START, _P_END, sidejobs, committees, memberships
            )
        result = json.loads((out / "21" / "conflicts.json").read_text())

    assert result["conflicts"] == []
    assert result["stats"]["affected_politicians"] == 0
