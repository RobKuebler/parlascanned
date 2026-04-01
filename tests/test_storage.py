import src.fetch.abgeordnetenwatch as aw


def test_current_wahlperiode_delegates_to_current_period(monkeypatch):
    """current_wahlperiode() ist ein Alias für current_period()."""
    monkeypatch.setattr(aw, "current_period", lambda: 21)
    assert aw.current_wahlperiode() == 21
