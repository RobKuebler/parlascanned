# Design: PoliticianSearch — Suche & bidirektionale Sync mit Abstimmungslandkarte

**Datum:** 2026-03-22
**Seite:** `/vote-map` (Abstimmungskarte)
**Bereich:** Zwischen VoteMapScatter und VoteHeatmap

---

## Ziel

Auf der Abstimmungskarte soll zwischen dem Scatter-Plot (Abstimmungslandkarte) und dem Heatmap (Abstimmungsverhalten) eine Suchleiste mit Multiselect für Politiker erscheinen. Die Auswahl soll bidirektional mit dem Scatter-Plot synchronisiert sein:

- Auswahl im Multiselect → Punkte im Scatter werden markiert
- Auswahl im Scatter (Klick, Rechteck, Lasso) → Chips im Multiselect erscheinen

---

## Komponente: `PoliticianSearch`

**Datei:** `frontend/components/charts/PoliticianSearch.tsx`

### Props

```typescript
interface PoliticianSearchProps {
  politicians: Politician[]
  selected: number[]                          // politician_ids
  onSelectionChange: (ids: number[]) => void
}
```

### UI-Verhalten

1. **Suchfeld** mit Placeholder „Politiker suchen…"
2. **Dropdown** erscheint beim Tippen:
   - Gefilterte Treffer (case-insensitive, nach Name)
   - Jeder Eintrag zeigt: Name + Partei-Badge (Farbe aus `PARTY_COLORS`)
   - Bereits ausgewählte Politiker werden im Dropdown ausgeblendet
3. **Chips** für ausgewählte Politiker, oberhalb des Suchfelds:
   - Zeigen Name (ggf. gekürzt) + ×-Button zum Entfernen
   - Chip-Farbe neutral, Partei-Badge als farbiger Punkt
4. **„Auswahl aufheben"**-Button erscheint wenn ≥1 Politiker ausgewählt

---

## Bidirektionale Sync

Kein zusätzlicher State nötig. `vote-map/page.tsx` hält bereits `selectedPoliticians` (Array von `politician_id`). Beide Komponenten lesen und schreiben denselben State:

```
VoteMapScatter ──onSelectionChange──┐
                                    ▼
                         selectedPoliticians (page.tsx)
                                    │
PoliticianSearch ◄──selected────────┘
                 └──onSelectionChange──► (selber Setter)
```

---

## Änderungen in `vote-map/page.tsx`

- `<PoliticianSearch>` zwischen `<VoteMapScatter>` und `<VoteHeatmap>` einbinden
- Props: `politicians`, `selectedPoliticians`, `setSelectedPoliticians` (oder Handler)
- Keine weiteren State-Änderungen erforderlich

---

## Was sich NICHT ändert

- `VoteMapScatter` — keine Änderungen
- `VoteHeatmap` — keine Änderungen
- Datenmodell / API-Calls — keine Änderungen

---

## Out of Scope

- Sortierung der Chips (erscheinen in Reihenfolge der Auswahl)
- Pagination im Dropdown (max. ~700 Politiker, performant genug ohne Virtualisierung)
- Keyboard-Navigation im Dropdown (nice-to-have, nicht Teil dieses Specs)
