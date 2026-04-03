"""Domain constants shared across the analysis and export layers."""

# Display order for parties in charts.
# Mirrors frontend/pages/constants.py — soft-hyphen (\xad) in GRÜNEN is intentional.
PARTY_ORDER = [
    "CDU/CSU",
    "SPD",
    "AfD",
    "BÜNDNIS 90/\xadDIE GRÜNEN",
    "Die Linke",
    "BSW",
    "FDP",
    "fraktionslos",
]

# Maps abgeordnetenwatch category IDs to human-readable labels.
SIDEJOB_CATEGORIES: dict[int, str] = {
    29647: "Entgeltliche Tätigkeit",
    29228: "Unternehmensbeteiligung / Organmitglied",
    29229: "Funktionen in öffentlichen Institutionen",
    29230: "Verband / Stiftung / Verein",
    29231: "Unternehmensbeteiligung",
    29232: "Spende / Zuwendung",
    29233: "Vereinbarung über künftige Tätigkeit",
    29234: "Tätigkeit vor Mitgliedschaft",
}
