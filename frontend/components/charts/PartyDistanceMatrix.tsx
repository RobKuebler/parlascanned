"use client";
import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import {
  sortParties,
  PARTY_COLORS,
  CHART_FONT_FAMILY,
  CHART_AXIS_FONT_SIZE,
} from "@/lib/constants";
import { ChartTooltip, positionTooltip } from "@/lib/chart-utils";

export interface Centroid {
  party: string;
  cx: number;
  cy: number;
}

const CELL_H = 36; // cell size — also used as cell width so cells are square
const PILL_GAP = 6; // gap between pill edge and matrix edge (both axes)

export function PartyDistanceMatrix({ centroids }: { centroids: Centroid[] }) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!width || !svgRef.current || centroids.length === 0) return;

    const parties = sortParties(centroids.map((c) => c.party));
    const centroidMap = new Map(centroids.map((c) => [c.party, c]));
    const n = parties.length;

    // Pairwise Euclidean distances between party centroids
    const dist: number[][] = parties.map((pa) =>
      parties.map((pb) => {
        const a = centroidMap.get(pa)!;
        const b = centroidMap.get(pb)!;
        return Math.sqrt((a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2);
      }),
    );
    const maxDist = d3.max(dist.flat().filter((d) => d > 0)) ?? 1;

    // Inverted: dark/warm (similar, small distance) → light (different, large distance)
    const colorScale = d3
      .scaleSequential()
      .domain([0, maxDist])
      .interpolator(d3.interpolate("#1E1B5E", "#EEF0FF"));

    // Both pills share the same length — derived from the longest party name.
    // ML = headerH = pillLen + PILL_GAP, which makes cells perfectly square (cellW = CELL_H).
    const pillLen = Math.max(...parties.map((p) => p.length * 6.5)) + 16;
    const ML = pillLen + PILL_GAP;
    const headerH = pillLen + PILL_GAP;
    const MR = 8;
    const iW = CELL_H * n; // cellW = CELL_H → square cells
    const iH = CELL_H * n;
    const totalW = ML + iW + MR;
    const totalH = headerH + iH;

    const xScale = d3.scaleBand().domain(parties).range([0, iW]).padding(0.05);
    const yScale = d3.scaleBand().domain(parties).range([0, iH]).padding(0.05);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", totalW).attr("height", totalH);

    const tooltip = d3.select(tooltipRef.current!);

    const PILL_MARGIN = 4; // how much thinner each pill is than its cell

    // Column headers — rotated colored badges, same length as row badges
    const colHeaders = svg.append("g").attr("transform", `translate(${ML}, 0)`);

    parties.forEach((p) => {
      const x = xScale(p) ?? 0;
      const bw = xScale.bandwidth();
      const pillThickness = bw - PILL_MARGIN;
      // Center pill vertically so its bottom sits PILL_GAP above the matrix
      const cy = headerH - PILL_GAP - pillLen / 2;

      const g = colHeaders
        .append("g")
        .attr("transform", `translate(${x + bw / 2}, ${cy}) rotate(-90)`);

      g.append("rect")
        .attr("x", -pillLen / 2)
        .attr("y", -pillThickness / 2)
        .attr("width", pillLen)
        .attr("height", pillThickness)
        .attr("fill", PARTY_COLORS[p] ?? "#888")
        .attr("rx", 4);

      g.append("text")
        .attr("x", 0)
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .style("font-size", CHART_AXIS_FONT_SIZE)
        .style("font-family", CHART_FONT_FAMILY)
        .style("font-weight", "600")
        .style("fill", "#fff")
        .style("pointer-events", "none")
        .text(p);
    });

    // Row labels — colored badges with white party name, same length as column badges
    const rowLabels = svg
      .append("g")
      .attr("transform", `translate(0, ${headerH})`);

    parties.forEach((p) => {
      const y = yScale(p) ?? 0;
      const bh = yScale.bandwidth();
      const pillThickness = bh - PILL_MARGIN;
      const pillY = y + PILL_MARGIN / 2;

      rowLabels
        .append("rect")
        .attr("x", 0)
        .attr("y", pillY)
        .attr("width", pillLen)
        .attr("height", pillThickness)
        .attr("fill", PARTY_COLORS[p] ?? "#888")
        .attr("rx", 4);

      rowLabels
        .append("text")
        .attr("x", pillLen / 2)
        .attr("y", pillY + pillThickness / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .style("font-size", CHART_AXIS_FONT_SIZE)
        .style("font-family", CHART_FONT_FAMILY)
        .style("font-weight", "600")
        .style("fill", "#fff")
        .style("pointer-events", "none")
        .text(p);
    });

    // Full matrix — all n×n cells
    const g = svg.append("g").attr("transform", `translate(${ML}, ${headerH})`);

    parties.forEach((pa, ri) => {
      parties.forEach((pb, ci) => {
        if (ci === ri) return; // diagonal stays transparent

        const d = dist[ri][ci];
        const x = xScale(pb) ?? 0;
        const y = yScale(pa) ?? 0;
        const bw = xScale.bandwidth();
        const bh = yScale.bandwidth();

        g.append("rect")
          .attr("x", x)
          .attr("y", y)
          .attr("width", bw)
          .attr("height", bh)
          .attr("fill", colorScale(d))
          .attr("rx", 3)
          .on("mousemove", (event) => {
            const [px, py] = d3.pointer(event, containerRef.current!);
            positionTooltip(
              tooltip,
              containerRef.current!,
              px,
              py,
              `<b>${pa}</b> ↔ <b>${pb}</b><br/>Abstand: ${d.toFixed(3)}`,
            );
          })
          .on("mouseleave", () => tooltip.style("opacity", "0"));
      });
    });
  }, [centroids, width]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ overflowX: "auto" }}>
        <svg ref={svgRef} style={{ display: "block", overflow: "visible" }} />
      </div>
      <ChartTooltip tooltipRef={tooltipRef} />
    </div>
  );
}
