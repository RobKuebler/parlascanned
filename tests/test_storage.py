from src import storage


def test_current_wahlperiode_delegates_to_current_period(monkeypatch):
    """current_wahlperiode() ist ein Alias für current_period()."""
    monkeypatch.setattr(storage, "current_period", lambda: 21)
    assert storage.current_wahlperiode() == 21
