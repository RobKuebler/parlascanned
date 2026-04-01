import pytest

import src.fetch.abgeordnetenwatch as aw


@pytest.fixture(autouse=True)
def clear_periods_cache():
    """Clear the fetch_periods_df lru_cache between tests."""
    aw.fetch_periods_df.cache_clear()
    yield
    aw.fetch_periods_df.cache_clear()
