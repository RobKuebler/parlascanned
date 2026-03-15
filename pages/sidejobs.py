import sys
from datetime import UTC, date, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# Ensure pages/ is on sys.path so constants can be imported on Streamlit Cloud.
sys.path.insert(0, str(Path(__file__).parent))
from constants import (
    BAR_LINE_COLOR,
    BAR_LINE_WIDTH,
    COLOR_SECONDARY,
    FALLBACK_COLOR,
    PARTY_COLORS,
    PARTY_ORDER,
)

from src.storage import DATA_DIR


def _annualized_income(
    monthly: float,
    created_ts: float | None,
    period_start: date,
    period_end: date,
) -> float:
    """Estimate total income for monthly payments within a period.

    Uses max(created_date, period_start) as the start and
    min(today, period_end) as the end, then multiplies by months elapsed.
    The created timestamp is a reasonable lower-bound for when payments began.
    """
    today = datetime.now(tz=UTC).date()
    if created_ts is not None:
        created_date = datetime.fromtimestamp(created_ts, tz=UTC).date()
        start = max(created_date, period_start)
    else:
        start = period_start
    end = min(today, period_end)
    months = max(0, (end.year - start.year) * 12 + (end.month - start.month) + 1)
    return monthly * months


@st.cache_data
def _load_csv(path: Path) -> pd.DataFrame:
    """Load a CSV from disk; result is cached until the file changes."""
    return pd.read_csv(path)


# Header
st.html(
    f"""
    <div style='text-align:center; padding:32px 0 24px'>
      <h1 style='margin:0; font-size:2rem; letter-spacing:-0.5px'>
        Nebeneinkünfte
      </h1>
      <p style='margin:8px 0 0; color:{COLOR_SECONDARY}; font-size:0.95rem;
                max-width:520px; margin-left:auto; margin-right:auto; line-height:1.6'>
        Offengelegte Nebentätigkeiten und Einkünfte der Bundestagsabgeordneten
        nach Partei. Datenquelle: abgeordnetenwatch.de.
      </p>
    </div>
    """
)

period_id: int = st.session_state["period_id"]
sidejobs_path = DATA_DIR / str(period_id) / "sidejobs.csv"

if not sidejobs_path.exists():
    st.info(
        "Noch keine Nebeneinkünfte-Daten für diese Periode. "
        "Bitte `fetch_data.py` ausführen."
    )
    st.stop()

pols_df = _load_csv(DATA_DIR / str(period_id) / "politicians.csv")
sj_df = _load_csv(sidejobs_path).copy()

# Join with politicians to get name and party.
df = sj_df.merge(
    pols_df[["politician_id", "name", "party"]],
    on="politician_id",
    how="left",
)
df["party_label"] = df["party"].str.replace("\xad", "", regex=False)

# Determine display order for parties present in this period.
present = set(df["party_label"].dropna().unique())
party_order_present = [
    p.replace("\xad", "") for p in PARTY_ORDER if p.replace("\xad", "") in present
] + sorted(present - {p.replace("\xad", "") for p in PARTY_ORDER})
color_map = {
    p.replace("\xad", ""): PARTY_COLORS.get(p, FALLBACK_COLOR)
    for p in PARTY_ORDER
    if p.replace("\xad", "") in present
}
color_map.update({p: FALLBACK_COLOR for p in present if p not in color_map})

# ── Central income computation ────────────────────────────────────────────────
# Annualize monthly entries; keep annual/one-time as-is. Used by Chart 2 and 3.
periods_df = _load_csv(DATA_DIR / "periods.csv")
period_row = periods_df[periods_df["period_id"] == period_id]
has_period_dates = (
    not period_row.empty
    and "start_date" in period_row.columns
    and "interval" in df.columns
)

sj_income = df[df["income"].notna()].copy()
sj_income["income"] = pd.to_numeric(sj_income["income"], errors="coerce")

if has_period_dates:
    p_start = date.fromisoformat(str(period_row["start_date"].iloc[0]))
    p_end = date.fromisoformat(str(period_row["end_date"].iloc[0]))

    def _effective_income(row: pd.Series) -> float:
        """Return annualized income; annualizes monthly entries using created date."""
        if str(row.get("interval", "")) == "1":
            ts = row.get("created") if "created" in row.index else None
            return _annualized_income(row["income"], ts, p_start, p_end)
        return row["income"]

    sj_income["income"] = sj_income.apply(_effective_income, axis=1)

# Per-politician total income (only those with at least one exact disclosure).
pol_income = (
    sj_income.groupby(["politician_id", "name", "party_label"], as_index=False)[
        "income"
    ]
    .sum()
    .query("income > 0")
)

# ── Chart 1: Average sidejobs per politician by party ────────────────────────
with st.container(border=True):
    st.markdown("##### Nebentätigkeiten pro Abgeordnetem")

    counts_per_pol = (
        df.groupby(["politician_id", "party_label"], as_index=False)
        .size()
        .rename({"size": "n_sidejobs"}, axis=1)
    )
    avg_by_party = (
        counts_per_pol.groupby("party_label", as_index=False)["n_sidejobs"]
        .mean()
        .rename(columns={"n_sidejobs": "avg_sidejobs"})
    )
    avg_by_party = avg_by_party[avg_by_party["party_label"].isin(party_order_present)]

    fig_avg = px.bar(
        avg_by_party,
        x="party_label",
        y="avg_sidejobs",
        color="party_label",
        color_discrete_map=color_map,
        labels={"party_label": "", "avg_sidejobs": "Ø Nebentätigkeiten"},
        category_orders={"party_label": party_order_present},
        height=360,
    )
    fig_avg.update_traces(
        hovertemplate=(
            "<b>%{x}</b><br>"
            "<b>%{y:.2f}</b> Nebentätigkeiten pro Abgeordnetem"
            "<extra></extra>"
        ),
        showlegend=False,
        marker_line_width=BAR_LINE_WIDTH,
        marker_line_color=BAR_LINE_COLOR,
    )
    fig_avg.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin={"l": 0, "r": 0, "t": 8, "b": 0},
        xaxis={"showgrid": False},
        yaxis={"showgrid": False},
    )
    st.plotly_chart(fig_avg, width="stretch", config={"displayModeBar": True})

# ── Chart 2: Income by party ──────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("##### Einkommen nach Partei")
    st.caption(
        "Nur Abgeordnete mit mindestens einem exakt offengelegten Betrag (Brutto). "
        "Monatliche Zahlungen werden hochgerechnet (Monatsbetrag × Monate seit Erfassungsdatum)."
    )

    if pol_income.empty:
        st.info("Keine genauen Einkommensdaten verfügbar.")
    else:
        party_income = pol_income.groupby("party_label", as_index=False).agg(
            total=("income", "sum"), mean=("income", "mean")
        )
        party_income = party_income[
            party_income["party_label"].isin(party_order_present)
        ]

        def _income_bar(y_col: str, y_label: str, height: int = 300) -> go.Figure:
            fig = px.bar(
                party_income,
                x="party_label",
                y=y_col,
                color="party_label",
                color_discrete_map=color_map,
                labels={"party_label": "", y_col: y_label},
                category_orders={"party_label": party_order_present},
                height=height,
            )
            fig.update_traces(
                hovertemplate="<b>%{x}</b><br><b>%{y:,.0f} €</b><extra></extra>",
                showlegend=False,
                marker_line_width=BAR_LINE_WIDTH,
                marker_line_color=BAR_LINE_COLOR,
            )
            fig.update_layout(
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                margin={"l": 0, "r": 0, "t": 8, "b": 0},
                xaxis={"showgrid": False},
                yaxis={"showgrid": False, "tickformat": ",.0f"},
            )
            return fig

        st.markdown("###### Summe")
        st.plotly_chart(
            _income_bar("total", "Gesamteinkommen (€)"),
            width="stretch",
            config={"displayModeBar": True},
        )
        st.markdown("###### Ø pro Abgeordnetem")
        st.plotly_chart(
            _income_bar("mean", "Ø Einkommen (€)"),
            width="stretch",
            config={"displayModeBar": True},
        )

# ── Chart 3: Income raincloud by party (log scale) ───────────────────────────
with st.container(border=True):
    st.markdown("##### Einkommensverteilung nach Partei")
    st.caption("Ein Punkt = ein Abgeordneter (Gesamteinkommen der Periode, Brutto).")

    if pol_income.empty:
        st.info("Keine genauen Einkommensdaten verfügbar.")
    else:
        fig_rain = go.Figure()
        rng = np.random.RandomState(42)
        STEP = 2.5

        parties_with_income = [
            p
            for p in party_order_present
            if len(pol_income[pol_income["party_label"] == p]) > 0
        ]
        for idx, party in enumerate(reversed(parties_with_income)):
            y_base = idx * STEP
            subset = pol_income[pol_income["party_label"] == party]
            incomes = subset["income"].to_numpy()
            names = subset["name"].to_numpy()
            color = color_map.get(party, FALLBACK_COLOR)

            fig_rain.add_trace(
                go.Violin(
                    x=incomes,
                    y=np.full(len(incomes), y_base),
                    orientation="h",
                    side="positive",
                    fillcolor=color,
                    line_color=color,
                    opacity=0.55,
                    width=1.8,
                    points=False,
                    showlegend=False,
                    hoverinfo="skip",
                )
            )

            jitter = rng.uniform(-0.15, 0.15, len(incomes))
            fig_rain.add_trace(
                go.Scatter(
                    x=incomes,
                    y=np.full(len(incomes), y_base) - 0.55 + jitter,
                    mode="markers",
                    marker={"color": color, "size": 4, "opacity": 0.6},
                    customdata=names,
                    showlegend=False,
                    hovertemplate=(
                        "<b>%{customdata}</b><br>"
                        f"<span style='color:#999'>{party}</span><br>"
                        "%{x:,.0f} €"
                        "<extra></extra>"
                    ),
                )
            )

        tick_positions = [idx * STEP for idx in range(len(parties_with_income))]
        fig_rain.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            margin={"l": 0, "r": 0, "t": 8, "b": 0},
            height=max(300, len(parties_with_income) * 90 + 60),
            showlegend=False,
            violingap=0,
            violinmode="overlay",
            xaxis={
                "showgrid": False,
                "title": "Gesamteinkommen (€)",
                "tickformat": ",.0f",
            },
            yaxis={
                "showgrid": False,
                "title": "",
                "tickmode": "array",
                "tickvals": tick_positions,
                "ticktext": list(reversed(parties_with_income)),
            },
        )
        st.plotly_chart(fig_rain, width="stretch", config={"displayModeBar": True})

# ── Chart 3: Top earners ─────────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("##### Top-Verdiener")
    st.caption(
        "Jahres- und Einmalzahlungen (Brutto). Monatliche Zahlungen werden "
        "hochgerechnet: Monatsbetrag × Monate seit Erfassungsdatum (max. bis Periodenende)."
    )

    if pol_income.empty:
        st.info("Keine genauen Einkommensdaten verfügbar.")
    else:
        top = pol_income.nlargest(20, "income")

        fig_top = go.Figure(
            go.Bar(
                x=top["income"],
                y=top["name"],
                orientation="h",
                marker={
                    "color": [
                        color_map.get(p, FALLBACK_COLOR) for p in top["party_label"]
                    ],
                    "line": {"color": BAR_LINE_COLOR, "width": BAR_LINE_WIDTH},
                },
                customdata=list(zip(top["party_label"], top["income"], strict=False)),
                hovertemplate=(
                    "<b>%{y}</b> (%{customdata[0]})<br>"
                    "<b>%{customdata[1]:,.0f} €</b><extra></extra>"
                ),
            )
        )
        fig_top.update_layout(
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            margin={"l": 0, "r": 0, "t": 8, "b": 0},
            height=max(300, len(top) * 28 + 60),
            xaxis={"showgrid": False, "title": "Einkommen (€)", "tickformat": ",.0f"},
            yaxis={"showgrid": False, "title": "", "autorange": "reversed"},
        )
        st.plotly_chart(fig_top, width="stretch", config={"displayModeBar": True})

# Footer
st.html(
    "<p style='text-align:center; color:#ccc; font-size:12px; margin-top:48px'>"
    "von <a href='https://robkuebler.github.io' style='color:#ccc'>Robert Kübler</a>"
    " | Code auf <a href='https://github.com/RobKuebler/politician_embeddings' style='color:#ccc'>GitHub</a>"
    " | Daten von <a href='https://www.abgeordnetenwatch.de' style='color:#ccc'>"
    "abgeordnetenwatch.de</a>"
    "</p>"
)
