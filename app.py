from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

OUTPUTS_DIR = Path(__file__).parent / "outputs"

PERIODS = {
    132: "20. Wahlperiode (2021-2025)",
    161: "21. Wahlperiode (2025-2029)",
}

# Official German party colors; unknown parties fall back to gray
PARTY_COLORS = {
    "CDU/CSU": "#000000",
    "SPD": "#E3000F",
    "AfD": "#009EE0",
    "BÜNDNIS 90/\xadDIE GRÜNEN": "#46962B",
    "Die Linke": "#BE3075",
    "BSW": "#722EA5",
    "FDP": "#FFED00",
    "fraktionslos": "#888888",
}
FALLBACK_COLOR = "#888888"

st.set_page_config(page_title="Politiker-Embeddings", layout="wide")

st.markdown(
    "<h1 style='text-align:center; margin-bottom:0'>Politiker-Embeddings</h1>",
    unsafe_allow_html=True,
)
st.markdown(
    "<p style='text-align:center; color:#888; margin-top:4px'>"
    "Abstimmungsverhalten als Vektoren, auf 2D reduziert"
    "</p>",
    unsafe_allow_html=True,
)

period_id = st.radio(
    "Wahlperiode",
    options=list(PERIODS.keys()),
    format_func=lambda p: PERIODS[p],
    index=1,
    horizontal=True,
)

df = pd.read_csv(OUTPUTS_DIR / f"politician_embeddings_{period_id}.csv")

# Legend above the chart — derived from data, known parties in fixed order first
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
present = set(df["party"].unique())
party_order = [p for p in PARTY_ORDER if p in present] + sorted(
    present - set(PARTY_ORDER)
)
pills = []
for party in party_order:
    color = PARTY_COLORS.get(party, FALLBACK_COLOR)
    label = party.replace("\xad", "")  # strip soft hyphen for display
    text_color = "#fff" if color != "#FFED00" else "#000"
    pills.append(
        f"<span style='background:{color}; color:{text_color}; "
        f"padding:5px 14px; border-radius:20px; font-size:13px; font-weight:500'>"
        f"{label}</span>"
    )
pills_html = (
    "<div style='display:flex; flex-wrap:wrap; justify-content:center;"
    " gap:10px; margin:16px 0 8px'>" + "".join(pills) + "</div>"
)
st.markdown(pills_html, unsafe_allow_html=True)

color_map = {p: PARTY_COLORS.get(p, FALLBACK_COLOR) for p in present}

# Centroid per party (mean x/y position)
centroids = df.groupby("party")[["x", "y"]].mean()

is_3d = "z" in df.columns
common = {
    "color": "party",
    "color_discrete_map": color_map,
    "hover_data": {"name": True, "party": True, "x": False, "y": False},
    "labels": {"party": "Partei", "name": "Name"},
    "custom_data": ["party", "name"],
    "height": 820,
}

if is_3d:
    common["hover_data"]["z"] = False
    fig = px.scatter_3d(df, x="x", y="y", z="z", **common)
    fig.update_traces(marker={"size": 4, "opacity": 0.88, "line": {"width": 0}})
    fig.update_layout(
        scene={
            "xaxis": {"showticklabels": False, "title": "", "showgrid": False},
            "yaxis": {"showticklabels": False, "title": "", "showgrid": False},
            "zaxis": {"showticklabels": False, "title": "", "showgrid": False},
        },
        showlegend=False,
        margin={"l": 0, "r": 0, "t": 10, "b": 10},
    )
else:
    fig = px.scatter(df, x="x", y="y", **common)
    fig.update_traces(
        marker={"size": 8, "opacity": 0.88, "line": {"width": 0}},
        hovertemplate="<b>%{customdata[0]}</b><br>%{customdata[1]}<extra></extra>",
    )
    # Centroid overlay: diamond marker + party name label
    for party, row in centroids.iterrows():
        color = color_map.get(party, FALLBACK_COLOR)
        label = str(party).replace("\xad", "")
        fig.add_trace(
            go.Scatter(
                x=[row["x"]],
                y=[row["y"]],
                mode="markers+text",
                marker={
                    "size": 16,
                    "color": color,
                    "symbol": "diamond",
                    "line": {"width": 2, "color": "#fff"},
                },
                text=[label],
                textposition="top center",
                textfont={"size": 11, "color": color},
                hovertemplate=f"<b>{label}</b> (Zentroid)<extra></extra>",
                showlegend=False,
            )
        )
    fig.update_layout(
        xaxis={
            "showticklabels": False,
            "title": "",
            "showgrid": False,
            "zeroline": False,
        },
        yaxis={
            "showticklabels": False,
            "title": "",
            "showgrid": False,
            "zeroline": False,
        },
        plot_bgcolor="#F7F4EF",  # warm off-white — all party colors incl. black pop
        paper_bgcolor="rgba(0,0,0,0)",  # transparent, blends with page
        showlegend=False,
        margin={"l": 0, "r": 0, "t": 10, "b": 10},
    )

event = st.plotly_chart(
    fig, width="stretch", on_select="rerun", selection_mode="points"
)

# Nearest neighbors: shown when the user clicks a point in 2D mode
if not is_3d and event.selection.points:  # ty: ignore[unresolved-attribute]
    sel = event.selection.points[0]  # ty: ignore[unresolved-attribute]
    # Identify clicked politician by proximity (robust across trace ordering)
    dists = (df["x"] - sel["x"]) ** 2 + (df["y"] - sel["y"]) ** 2
    idx = dists.idxmin()
    selected = df.loc[idx]
    coords = df[["x", "y"]].to_numpy()
    all_dists = np.linalg.norm(coords - coords[df.index.get_loc(idx)], axis=1)
    neighbor_idx = df.index[np.argsort(all_dists)[1:6]]
    neighbors = df.loc[neighbor_idx, ["name", "party"]].rename(
        columns={"name": "Name", "party": "Partei"}
    )
    st.markdown(f"**Nächste Nachbarn von {selected['name']}**")
    st.dataframe(neighbors, hide_index=True, use_container_width=True)

st.markdown("---")

# --- Party cohesion: mean distance of each politician from their party centroid ---
st.markdown("#### Partei-Kohäsion")
cx = df["party"].map(centroids["x"])
cy = df["party"].map(centroids["y"])
coh = (
    np.sqrt((df["x"] - cx) ** 2 + (df["y"] - cy) ** 2)
    .groupby(df["party"])
    .mean()
    .reset_index(name="streuung")
)
coh["label"] = coh["party"].str.replace("\xad", "", regex=False)
coh = coh.sort_values("streuung")
fig_coh = px.bar(
    coh,
    x="streuung",
    y="label",
    orientation="h",
    color="party",
    color_discrete_map=color_map,
    labels={"streuung": "Abstand vom Zentroid", "label": ""},
    height=350,
    custom_data=["label", "streuung"],
)
fig_coh.update_traces(
    hovertemplate=(
        "<b>%{customdata[0]}</b><br>Ø Abstand: %{customdata[1]:.3f}<extra></extra>"
    )
)
fig_coh.update_layout(showlegend=False, margin={"l": 0, "r": 0, "t": 0, "b": 0})
st.plotly_chart(fig_coh, width="stretch")
