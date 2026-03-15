import sys
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# Ensure pages/ is on sys.path so constants can be imported on Streamlit Cloud.
sys.path.insert(0, str(Path(__file__).parent))
from constants import COLOR_SECONDARY, FALLBACK_COLOR, PARTY_COLORS, PARTY_ORDER

from src.storage import DATA_DIR
from src.transforms import (
    compute_age_df,
    compute_occupation_pivot,
    compute_sex_counts,
    compute_title_counts,
)

CURRENT_YEAR = datetime.now(tz=UTC).year


@st.cache_data
def _load_csv(path: Path) -> pd.DataFrame:
    # Cached CSV loader; result is reused across reruns until the file changes
    return pd.read_csv(path)


# Header
st.html(
    f"""
    <div style='text-align:center; padding:32px 0 24px'>
      <h1 style='margin:0; font-size:2rem; letter-spacing:-0.5px'>
        Parteiprofil
      </h1>
      <p style='margin:8px 0 0; color:{COLOR_SECONDARY}; font-size:0.95rem; max-width:520px; margin-left:auto; margin-right:auto; line-height:1.6'>
        Demografische und berufliche Profile der Bundestagsfraktionen im Vergleich.
      </p>
    </div>
    """
)

period_id: int = st.session_state["period_id"]

pols_df = _load_csv(DATA_DIR / str(period_id) / "politicians.csv").copy()

# Ensure detail columns exist (backwards compatible with old CSVs that lack them)
for col in ["occupation", "year_of_birth", "field_title", "sex", "education"]:
    if col not in pols_df.columns:
        pols_df[col] = pd.NA

# Normalize party display labels (strip soft hyphen used in Grünen party name)
pols_df["party_label"] = pols_df["party"].str.replace("\xad", "", regex=False)

# Determine display order for this period
present = set(pols_df["party"].unique())
party_order_present = [p for p in PARTY_ORDER if p in present] + sorted(
    present - set(PARTY_ORDER)
)
party_labels_ordered = [p.replace("\xad", "") for p in party_order_present]
color_map = {
    p.replace("\xad", ""): PARTY_COLORS.get(p, FALLBACK_COLOR)
    for p in party_order_present
}

# ── Chart 1: Occupations heatmap ─────────────────────────────────────────────
with st.container(border=True):
    st.markdown("##### Berufe")
    pivot, z, zmax = compute_occupation_pivot(pols_df, party_labels_ordered)

    fig_occ_heat = go.Figure(
        go.Heatmap(
            z=z,
            x=pivot.columns.tolist(),
            y=pivot.index.tolist(),
            colorscale="Blues",
            showscale=False,
            zmin=0,
            zmax=zmax,
            text=[[str(int(v)) if not np.isnan(v) else "" for v in row] for row in z],
            texttemplate="%{text}",
            textfont={"size": 11},
            hovertemplate=(
                "<b>%{x}</b> – %{y}<br><b>%{z} Abgeordnete</b><extra></extra>"
            ),
            hoverongaps=False,
            xgap=2,
            ygap=2,
        )
    )
    fig_occ_heat.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin={"l": 0, "r": 0, "t": 8, "b": 0},
        height=max(300, len(pivot) * 40 + 60),
        xaxis={"side": "top", "showgrid": False},
        yaxis={"showgrid": False, "autorange": "reversed"},
    )
    st.plotly_chart(fig_occ_heat, width="stretch")

# ── Chart 2: Age distribution ────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("##### Altersverteilung")
    age_df = compute_age_df(pols_df, CURRENT_YEAR)

    # Draw box plot per party. go.Box hover can't be fully customized (plotly
    # renders box stats in its own format), so we disable box hover and overlay
    # invisible scatter points that carry our German tooltip.
    fig_age = go.Figure()
    for party in reversed(party_labels_ordered):
        data = age_df[age_df["party_label"] == party]["alter"].to_numpy()
        if len(data) == 0:
            continue
        q1 = int(np.percentile(data, 25))
        median_val = int(np.median(data))
        q3 = int(np.percentile(data, 75))
        iqr = q3 - q1
        lower = int(max(data.min(), q1 - 1.5 * iqr))
        upper = int(min(data.max(), q3 + 1.5 * iqr))
        color = color_map.get(party, FALLBACK_COLOR)
        tooltip = (
            f"<b>{party}</b><br>"
            f"Median: <b>{median_val} Jahre</b><br>"
            f"<span style='color:#999'>"
            f"Unteres Quartil: {q1} Jahre<br>"
            f"Oberes Quartil: {q3} Jahre<br>"
            f"Min – Max: {lower} – {upper} Jahre"
            f"</span>"
            "<extra></extra>"
        )
        # Visual box — hover disabled
        fig_age.add_trace(
            go.Box(
                x=data,
                name=party,
                orientation="h",
                fillcolor=color,
                line_color="white",
                line_width=1,
                marker_color=color,
                showlegend=False,
                hoverinfo="skip",
            )
        )
        # Invisible scatter covering the box area — carries German tooltip
        fig_age.add_trace(
            go.Scatter(
                x=list(range(lower, upper + 1)),
                y=[party] * (upper - lower + 1),
                mode="markers",
                marker={"opacity": 0, "size": 14},
                showlegend=False,
                hovertemplate=tooltip,
            )
        )
    fig_age.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin={"l": 0, "r": 0, "t": 8, "b": 0},
        height=360,
        showlegend=False,
        xaxis={"showgrid": False, "title": "Alter"},
        yaxis={"showgrid": False, "title": ""},
    )
    st.plotly_chart(fig_age, width="stretch")

# ── Chart 3: Gender breakdown ─────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("##### Geschlecht")
    sex_counts = compute_sex_counts(pols_df)

    fig_sex = px.bar(
        sex_counts,
        x="party_label",
        y="pct",
        color="geschlecht",
        barmode="group",
        custom_data=["count"],
        labels={"party_label": "", "pct": "Anteil (%)", "geschlecht": "Geschlecht"},
        category_orders={"party_label": party_labels_ordered},
        height=360,
    )
    fig_sex.update_traces(
        hovertemplate=(
            "<b>%{x}</b> – %{fullData.name}<br>"
            "<b>%{y:.1f}%</b>"
            "<span style='color:#999'> (%{customdata[0]} Abgeordnete)</span>"
            "<extra></extra>"
        ),
    )
    fig_sex.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin={"l": 0, "r": 0, "t": 8, "b": 0},
        xaxis={"showgrid": False},
        yaxis={"showgrid": False},
    )
    st.plotly_chart(fig_sex, width="stretch")

# ── Chart 4: Academic titles ──────────────────────────────────────────────────
with st.container(border=True):
    st.markdown("##### Akademische Titel")
    title_counts = compute_title_counts(pols_df)

    fig_title = px.bar(
        title_counts,
        x="party_label",
        y="pct",
        color="titel",
        barmode="group",
        custom_data=["count"],
        color_discrete_map={"Mit Titel": "#4A90D9", "Ohne Titel": "#CCCCCC"},
        labels={"party_label": "", "pct": "Anteil (%)", "titel": ""},
        category_orders={"party_label": party_labels_ordered},
        height=360,
    )
    fig_title.update_traces(
        hovertemplate=(
            "<b>%{x}</b> – %{fullData.name}<br>"
            "<b>%{y:.1f}%</b>"
            "<span style='color:#999'> (%{customdata[0]} Abgeordnete)</span>"
            "<extra></extra>"
        ),
    )
    fig_title.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin={"l": 0, "r": 0, "t": 8, "b": 0},
        xaxis={"showgrid": False},
        yaxis={"showgrid": False},
    )
    st.plotly_chart(fig_title, width="stretch")

# Footer
st.html(
    "<p style='text-align:center; color:#ccc; font-size:12px; margin-top:48px'>"
    "von <a href='https://robkuebler.github.io' style='color:#ccc'>Robert Kübler</a>"
    " | Code auf <a href='https://github.com/RobKuebler/politician_embeddings' style='color:#ccc'>GitHub</a>"
    " | Daten von <a href='https://www.abgeordnetenwatch.de' style='color:#ccc'>"
    "abgeordnetenwatch.de</a>"
    "</p>"
)
