# Parlascanned

Ein interaktives Dashboard, das Bundestagsabgeordnete durchleuchtet: Abstimmungsverhalten, politische Trennlinien, demografische Profile, und mehr.

[**Demo ansehen**](https://parlascanned.streamlit.app/) | [**Daten: abgeordnetenwatch.de**](https://www.abgeordnetenwatch.de)

---

## Idee

Namentliche Abstimmungen, Berufe, Alter, Geschlecht, akademische Titel -- all das ist öffentlich zugänglich, aber schwer zu überblicken. Parlascanned bündelt diese Daten für alle Wahlperioden ab 2021 und macht sie interaktiv erkundbar.

## Features

- **Abstimmungslandkarte:** Ein KI-Modell (kollaboratives Filtermodell, ähnlich Matrix-Faktorisierungen aus Empfehlungssystemen) weist jedem Abgeordneten eine Position im zweidimensionalen Raum zu. Je näher zwei Punkte, desto ähnlicher das Abstimmungsverhalten. Per Box- oder Lasso-Auswahl lassen sich mehrere Abgeordnete gleichzeitig markieren.
- **Abstimmungsverhalten (Heatmap):** Für ausgewählte Abgeordnete und Abstimmungen zeigt eine Heatmap Ja, Nein, Enthalten und Abwesenheit auf einen Blick.
- **Fraktionsdisziplin:** Wie geschlossen stimmt eine Fraktion ab? Ein Balkendiagramm zeigt die durchschnittliche Streuung der Abgeordneten um den Fraktionsmittelpunkt.
- **Parteiprofil:** Demografische und berufliche Profile der Fraktionen im Vergleich: Berufe, Altersverteilung, Geschlecht, akademische Titel.
- **Nebeneinkünfte:** Offengelegte Nebentätigkeiten und Einkünfte der Abgeordneten nach Partei, Kategorie und Themenfeld.
- **Wahlperioden-Auswahl:** Alle Wahlperioden ab dem 20. Bundestag (2021) sind verfügbar, sofern Daten und trainierte Embeddings vorhanden sind.

## Das Modell

Das Modell ist ein kollaboratives Filtermodell nach dem Vorbild von Matrix-Faktorisierungen, wie sie aus Empfehlungssystemen bekannt sind. Für jede namentliche Abstimmung wird ein Ja/Nein-Ergebnis pro Abgeordnetem als Trainingssignal verwendet.

**Architektur:**

- Jeder Abgeordnete und jede Abstimmung bekommt einen gelernten Embedding-Vektor (standardmäßig 2 Dimensionen).
- Das Modell berechnet die **L2-Distanz** zwischen dem Embedding eines Abgeordneten und dem einer Abstimmung.
- Zusätzlich lernt jede Einheit einen **Bias**, der allgemeine Ja/Nein-Tendenzen absorbiert, damit die Embeddings die inhaltliche Struktur sauber abbilden können.
- Verlustfunktion: `BCEWithLogitsLoss` auf binären Ja/Nein-Votes.
- Training mit `PyTorch Lightning`, frühem Abbruch wenn der relative Fortschritt unter 1 % pro Epoche fällt.

Nach dem Training werden nur die Abgeordneten-Embeddings exportiert. Ihre relative Position im Raum bildet das Abstimmungsverhalten ab.

## Setup

Voraussetzungen: Python 3.13, [uv](https://github.com/astral-sh/uv), Node.js 20+

```bash
# Python-Abhängigkeiten installieren (inkl. Dev-Tools)
uv sync --group dev

# Voting-Daten von abgeordnetenwatch.de laden (aktuelle Wahlperiode)
uv run src/fetch_data.py

# Modell trainieren und Embeddings berechnen
uv run src/train_model.py

# Frontend starten (Next.js)
cd frontend && npm install && npm run dev
```

Optionale Parameter (jeweils `--help` für Details):

```bash
uv run src/fetch_data.py --period 111       # bestimmte Wahlperiode
uv run src/train_model.py --factors 2 --epochs 50 --lr 0.01
```

## Projektstruktur

```
src/
  fetch_data.py           Datenabruf von der abgeordnetenwatch.de API
  model.py                Modellarchitektur (PoliticianEmbeddingModel)
  storage.py              CSV-Lesen/Schreiben, Pfade
  transforms.py           Reine Datentransformationen (Cohesion, Pivot, ...)
  occupation_clusters.py  Normalisierung von Berufsbezeichnungen
  train_model.py          Einstiegspunkt für das Training
frontend/
  app/                    Next.js App Router (Seiten und Layout)
  components/             UI-Komponenten und D3-Charts
  lib/                    Daten-Fetching, Kontexte, Konstanten
data/                     Rohdaten (gitignored)
outputs/                  Embedding-CSVs (gitignored)
```

## Danksagung

Die Abstimmungsdaten stammen von [**abgeordnetenwatch.de**](https://www.abgeordnetenwatch.de), einer gemeinnützigen Plattform, die Bürger mit ihren gewählten Abgeordneten verbindet und seit Jahren Transparenz über das parlamentarische Handeln schafft. Ohne ihre offene API wäre dieses Projekt nicht möglich. Herzlichen Dank.

## Lizenz

MIT
