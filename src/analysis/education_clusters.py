from .. import match_rules

# Keyword rules for normalizing raw education strings into canonical study-field
# categories and academic degree levels.
# Order matters: first match wins. Matching is case-insensitive substring search.

_FIELD_RULES: list[tuple[list[str], str]] = [
    # ── Jura / Rechtswissenschaft ───────────────────────────────────────────
    (
        [
            "rechtswissenschaft",
            "rechtsanwalt",
            "rechtsanwältin",
            "volljurist",
            "jurist",
            "juristin",
            "jura",
            "fachanwalt",
            "fachanwältin",
            "notar",
            "assessor",
            "richter",
            "richterin",
            "völkerrecht",
            "steuerrecht",
        ],
        "Jura",
    ),
    # ── Medizin / Gesundheit ────────────────────────────────────────────────
    (
        [
            "medizin",
            "arzt",
            "ärztin",
            "zahnarzt",
            "zahnärzt",
            "tierärzt",
            "veterinär",
            "virologe",
            "neurolog",
            "chirurg",
            "humanmedizin",
            "pharma",
            "krankenschwester",
            "krankenpfleger",
            "pflegefach",
            "gesundheits-",
            "altenpfleger",
            "altenpflegerin",
            "pflegedienstleiter",
            "fachkinderkrankenschwester",
            "stomatolog",
        ],
        "Medizin / Gesundheit",
    ),
    # ── Ingenieurwesen ──────────────────────────────────────────────────────
    (
        [
            "ingenieur",
            "ingenieurin",
            "maschinenbau",
            "elektrotechnik",
            "wirtschaftsingenieur",
            "bauingenieur",
            "bauingenier",
            "dr.-ing",
            "dipl.-ing",
            "dipl. ing",
            "chemie-ingenieur",
            "elektronikingenieur",
        ],
        "Ingenieurwesen",
    ),
    # ── Politikwissenschaft ─────────────────────────────────────────────────
    (
        [
            "politikwissenschaft",
            "politolog",
            "politische wissenschaft",
            "staatswissenschaft",
            "politikwiss",
            "poltikwissenschaft",
            "sc. pol",
            "promotion politik",
            "internationale politik",
            "internationale beziehungen",
            "konfliktforsch",
            "political economy",
        ],
        "Politikwissenschaft",
    ),
    # ── Informatik / IT ─────────────────────────────────────────────────────
    (
        ["informatik", "informatiker", "informatikerin", "it-", "software"],
        "Informatik / IT",
    ),
    # ── Wirtschaftswissenschaft (BWL / VWL) ─────────────────────────────────
    (
        [
            "volkswirt",
            "betriebswirt",
            "kaufmann",
            "kauffrau",
            "ökonom",
            "ökonomin",
            "wirtschaftswissenschaft",
            "wirtschaftspädagogik",
            "finanzwirt",
            "wirtschaftsmathematik",
            "bwl",
            "vwl",
            "betriebswirtschaft",
            "handelsfachwirt",
            "wirtschaftsprüfer",
            "steuerberater",
            "steuerberaterin",
            "steuerfachangestellte",
            "bilanzbuchhalter",
            "wirtschaftsinformatik",
            "business administration",
            "buisness administration",
            "wirschafts-",
            "wirtschaftsfachwirt",
            "wirtschaftskommunikation",
            "economics",
            "finanzbuchhalter",
            "bertriebswirt",
        ],
        "Wirtschaft (BWL/VWL)",
    ),
    # ── Sozialwissenschaft / Soziale Arbeit ─────────────────────────────────
    (
        [
            "sozialwissenschaft",
            "soziolog",
            "sozialarbeit",
            "sozialpädagog",
            "sozialethik",
            "sozialökono",
            "soziale arbeit",
            "psycholog",
        ],
        "Sozialwissenschaft",
    ),
    # ── Naturwissenschaft ───────────────────────────────────────────────────
    (
        [
            "physik",
            "chemik",
            "chemie",
            "biolog",
            "mathematik",
            "mathematiker",
            "mathematikerin",
            "biochem",
            "geowissenschaft",
            "biophysik",
            "geograph",
            "geolog",
            "umweltwissenschaft",
            "forstwirtschaft",
            "forstwirt",
            "agrar",
            "landwirt",
        ],
        "Naturwissenschaft",
    ),
    # ── Pädagogik / Lehramt ─────────────────────────────────────────────────
    (
        [
            "lehrer",
            "lehrerin",
            "lehramt",
            "pädagog",
            "erziehung",
            "erzieherin",
            "erzieher",
            "studienrat",
            "studienrätin",
            "studiendirektor",
            "oberstudienrat",
            "schulleiter",
            "gymnasiallehrer",
            "schulrektorin",
            "lehrämter",
            "master of education",
        ],
        "Pädagogik / Lehramt",
    ),
    # ── Geisteswissenschaft ─────────────────────────────────────────────────
    (
        [
            "germanist",
            "historik",
            "geschichtswiss",
            "geschichte",
            "theolog",
            "philosoph",
            "literaturwiss",
            "sprachwiss",
            "kulturwiss",
            "religionswiss",
            "romanist",
            "musikwiss",
            "slawist",
            "islamwiss",
            "kunstwiss",
            "philolog",
            "dramatur",
            "rumänistik",
            "linguistik",
            "sinolog",
            "dolmetsch",
            "übersetzer",
        ],
        "Geisteswissenschaft",
    ),
    # ── Verwaltung ──────────────────────────────────────────────────────────
    (
        [
            "verwaltungswirt",
            "verwaltungsfach",
            "verwaltungswissenschaft",
            "verwaltungsangest",
            "ministerialrat",
            "ministerialdirigent",
            "kreisinspektorin",
            "verwaltungsmanager",
            "zollbeamter",
            "oberamtsrat",
        ],
        "Verwaltung",
    ),
    # ── Medien / Kommunikation ──────────────────────────────────────────────
    (
        [
            "journalist",
            "medienwissenschaft",
            "kommunikationswiss",
            "kommunikationswirt",
            "publizistik",
            "mediengestalter",
            "medienberater",
            "medienwissenschaftler",
            "wirtschaftskommunikation",
        ],
        "Medien / Kommunikation",
    ),
    # ── Polizei / Militär ───────────────────────────────────────────────────
    (
        [
            "polizei",
            "soldat",
            "offizier",
            "bundeswehr",
            "oberst",
            "generalleutnant",
            "waffenmeister",
        ],
        "Polizei / Militär",
    ),
    # ── Handwerk / technische Ausbildung ────────────────────────────────────
    (
        [
            "meister",
            "mechanik",
            "techniker",
            "elektroniker",
            "dachdecker",
            "maler-",
            "lackierer",
            "schlosser",
            "installateur",
            "werkzeugmacher",
            "facharbeiter",
            "tischler",
            "schornsteinfeger",
            "hafenfacharbeiter",
            "abwassermeister",
            "gartenbau",
            "metzger",
            "goldschmied",
            "monteur",
            "mechatroniker",
            "handwerker",
            "friseur",
            "bergmann",
            "lokomotivführer",
            "lokomoticführer",
        ],
        "Handwerk / Technik",
    ),
    # ── Kaufmännische Ausbildung ────────────────────────────────────────────
    (
        [
            "bankkaufmann",
            "bankkauffrau",
            "industriekaufmann",
            "industriekauffrau",
            "bürokaufmann",
            "bürokauffrau",
            "einzelhandelskauf",
            "versicherungsfach",
            "speditionskaufmann",
            "veranstaltungskauffrau",
            "hotelfachfrau",
            "restaurantfachmann",
            "reiseverkehrskauf",
            "fachwirtin im gastgewerbe",
            "kaufmännisch",
            "buchhändler",
        ],
        "Kaufm. Ausbildung",
    ),
]

# ── Degree-level rules ──────────────────────────────────────────────────────
# Checked independently of field — multiple keywords can match,
# but we take the highest level (first match in this list).
_DEGREE_RULES: list[tuple[list[str], str]] = [
    (
        [
            "promoviert",
            "promotion",
            "doktor",
            "dr.",
            "dr.-",
            "dr. ",
            "dr.rer",
            "dr.phil",
        ],
        "Promotion",
    ),
    (
        ["staatsexamen", "volljurist", "assessor", "referendar"],
        "Staatsexamen",
    ),
    (
        [
            "diplom",
            "dipl.",
            "dipl-",
            "dipl ",
            "diplomiert",
        ],
        "Diplom",
    ),
    (
        ["magister", "master", "m.a.", "m.sc.", "m. a.", "m. sc.", "mba", "ll.m"],
        "Master / Magister",
    ),
    (
        ["bachelor", "b.a.", "b.sc.", "b. a.", "b. sc."],
        "Bachelor",
    ),
    (
        [
            "meister",
            "fachwirt",
            "techniker",
            "staatlich gepr",
            "staatl. gepr",
            "examiniert",
            "fachkraft",
        ],
        "Meister / Fachwirt",
    ),
    (
        [
            "ausbildung",
            "kaufmann",
            "kauffrau",
            "fachmann",
            "fachfrau",
            "fachangestellte",
            "laborant",
            "mechanik",
            "installateur",
            "elektroniker",
            "dachdecker",
            "werkzeugmacher",
            "schlosser",
            "goldschmied",
            "metzger",
            "tischler",
            "hafenfach",
            "hotelfach",
            "restaurantfach",
            "assistentin",
            "assistent",
        ],
        "Ausbildung",
    ),
]


def normalize_education_field(edu: str | None) -> str:
    """Map a raw education string to a canonical study-field category.

    Returns "Keine Angabe" for null values, "Sonstiges" if no rule matches.
    """
    return match_rules(edu, _FIELD_RULES)


def normalize_education_degree(edu: str | None) -> str:
    """Extract the highest academic degree level from a raw education string.

    Returns "Keine Angabe" for null values,
    "Nicht erkennbar" if no degree keyword matches.
    """
    return match_rules(edu, _DEGREE_RULES, default="Nicht erkennbar")


def has_doctorate(row) -> bool:
    """Return True if any available field signals a doctorate.

    Checks field_title, occupation, and education against the existing
    doctorate keywords in _DEGREE_RULES by reusing normalize_education_degree.
    """
    fields = [row.get("field_title"), row.get("occupation"), row.get("education")]
    combined = " ".join(f for f in fields if isinstance(f, str) and f.strip())
    return normalize_education_degree(combined) == "Promotion"
