import logging
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st
import umap

log = logging.getLogger(__name__)

EMBEDDINGS_PATH = Path(__file__).parent / "outputs" / "politician_embeddings_161.csv"

# Official German party colors
PARTY_COLORS = {
    "CDU/CSU": "#000000",
    "SPD": "#E3000F",
    "AfD": "#009EE0",
    "BÜNDNIS 90/\xadDIE GRÜNEN": "#46962B",
    "Die Linke": "#BE3075",
    "fraktionslos": "#888888",
}


@st.cache_data
def load_and_reduce() -> pd.DataFrame:
    """Load embeddings CSV and reduce to 2D with UMAP."""
    df = pd.read_csv(EMBEDDINGS_PATH)
    dim_cols = [c for c in df.columns if c.startswith("dim_")]
    reducer = umap.UMAP(n_components=2, random_state=42)
    coords = reducer.fit_transform(df[dim_cols].values)
    df["x"] = coords[:, 0]
    df["y"] = coords[:, 1]
    return df


st.set_page_config(page_title="Politiker-Embeddings", layout="wide")
st.title("Politiker-Embeddings — Bundestag 2025")
st.caption("Abstimmungsverhalten als Vektoren, auf 2D reduziert via UMAP.")

with st.spinner("UMAP läuft..."):
    df = load_and_reduce()

fig = px.scatter(
    df,
    x="x",
    y="y",
    color="party",
    color_discrete_map=PARTY_COLORS,
    hover_data={"name": True, "party": True, "x": False, "y": False},
    labels={"party": "Partei", "name": "Name"},
    height=700,
)
fig.update_traces(marker={"size": 7, "opacity": 0.85})
fig.update_layout(
    xaxis={"showticklabels": False, "title": "", "showgrid": False},
    yaxis={"showticklabels": False, "title": "", "showgrid": False},
    plot_bgcolor="white",
    legend_title_text="Partei",
)

st.plotly_chart(fig, use_container_width=True)
