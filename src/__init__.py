"""Shared utilities for the src package."""


def match_rules(
    value: str | None,
    rules: list[tuple[list[str], str]],
    *,
    default: str = "Sonstiges",
    empty_label: str = "Keine Angabe",
) -> str:
    """Match a raw string against keyword rules (case-insensitive substring search).

    Returns empty_label for null/blank values, the first matching rule's label,
    or default if no rule matches. Used by occupation and education normalizers.
    """
    if not isinstance(value, str) or not value.strip():
        return empty_label
    lowered = value.lower()
    for keywords, label in rules:
        if any(k in lowered for k in keywords):
            return label
    return default
