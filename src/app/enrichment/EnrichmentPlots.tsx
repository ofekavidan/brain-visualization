"use client";

import dynamic from "next/dynamic";
import type { Data, Layout, Shape } from "plotly.js";
import {
  ALPHA,
  BLOCK_COLOURS,
  CELL_TYPES,
  LIST_COLOURS,
  LOGP_MAX,
  markerStars,
  starRows,
  type BactmanReference,
  type EnrichmentResult,
} from "@/lib/bactmanEnrichment";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const LOGP_MIN = -Math.log10(ALPHA);
const FONT = "DejaVu Sans, Arial, sans-serif";

function autumn(logp: number) {
  const t = Math.min(1, Math.max(0, (logp - LOGP_MIN) / (LOGP_MAX - LOGP_MIN)));
  return `rgb(255,${Math.round(255 * (1 - t))},0)`;
}

function axisMax(values: number[]) {
  const finite = values.filter((v) => Number.isFinite(v));
  const max = finite.length ? Math.max(...finite) : 0;
  return Math.max(max * 1.45, 2.5);
}

export function EnrichmentDotPlot({ result }: { result: EnrichmentResult }) {
  const labels = result.lists;
  if (!labels.length) return null;

  const traces: Data[] = [];
  const shapes: Partial<Shape>[] = [];
  const annotations: NonNullable<Layout["annotations"]> = [];
  const layout: Partial<Layout> = {
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    showlegend: false,
    height: 520,
    margin: { l: 168, r: 28, t: 78, b: 150 },
    font: { family: FONT, color: "#222" },
    annotations,
  };

  labels.forEach((label, index) => {
    const rows = CELL_TYPES.map((ct) => result.table.find((r) => r.list === label && r.cellType === ct)!);
    const axis = index === 0 ? "" : String(index + 1);
    const xKey = index === 0 ? "x" : "x2";
    const yKey = index === 0 ? "y" : "y2";
    const gap = 0.06;
    const width = (1 - gap * (labels.length - 1)) / labels.length;
    const x0 = index * (width + gap);
    const x1 = x0 + width;
    const y = rows.map((_, i) => rows.length - 1 - i);
    const x = rows.map((r) => r.haldane);
    const xmax = axisMax(x);
    const summary = result.summary[label];
    const matched = summary?.matched ?? 0;

    (layout as Record<string, unknown>)[`xaxis${axis}`] = {
      domain: [x0, x1],
      anchor: yKey,
      title: { text: "Odds ratio", font: { size: 13 } },
      range: [0, xmax],
      zeroline: false,
      showline: true,
      mirror: false,
      linecolor: "black",
      linewidth: 1,
      ticks: "outside",
      ticklen: 5,
      tickfont: { size: 12 },
      gridcolor: "rgba(0,0,0,0)",
    };
    (layout as Record<string, unknown>)[`yaxis${axis}`] = {
      domain: [0.18, 1],
      anchor: xKey,
      range: [-0.6, rows.length - 0.4],
      tickmode: "array",
      tickvals: y,
      ticktext: index === 0 ? rows.map((r) => r.cellType) : rows.map(() => ""),
      zeroline: false,
      showline: true,
      mirror: false,
      linecolor: "black",
      linewidth: 1,
      ticks: "",
      tickfont: { size: 13 },
      gridcolor: "rgba(0,0,0,0)",
      automargin: index === 0,
    };

    annotations.push({
      text: `${label}<br>(n = ${matched}/${summary?.reported ?? 0} in BACTMan)`,
      xref: "paper",
      yref: "paper",
      x: (x0 + x1) / 2,
      y: 1.14,
      yanchor: "bottom",
      showarrow: false,
      font: { size: 14, color: "#222" },
    });

    shapes.push({
      type: "line",
      xref: xKey,
      yref: yKey,
      x0: 1,
      x1: 1,
      y0: -0.6,
      y1: rows.length - 0.4,
      line: { color: "grey", width: 1, dash: "dash" },
    });

    if (matched === 0) {
      annotations.push({
        text: "no miRNA<br>found in BACTMan",
        xref: xKey,
        yref: yKey,
        x: xmax / 2,
        y: (rows.length - 1) / 2,
        showarrow: false,
        font: { size: 13, color: "grey" },
      });
      return;
    }

    traces.push({
      type: "scatter",
      mode: "markers",
      x,
      y,
      xaxis: xKey,
      yaxis: yKey,
      hovertemplate: rows.map(
        (r) =>
          `${r.cellType}<br>Odds ratio: ${r.haldane.toFixed(2)}<br>` +
          `Overlap: ${r.markersInList}/${r.markersK}<br>` +
          `Padj: ${r.pAdj < 0.001 ? r.pAdj.toExponential(2) : r.pAdj.toFixed(3)}<extra></extra>`
      ),
      marker: {
        size: 16,
        color: rows.map((r) => (r.enriched ? autumn(r.log10Padj) : "#D3D3D3")),
        line: { color: "black", width: 0.6 },
      },
      showlegend: false,
    } as Data);
    traces.push({
      type: "scatter",
      mode: "text",
      x: x.map((v) => v + Math.max(xmax * 0.04, 0.9)),
      y,
      xaxis: xKey,
      yaxis: yKey,
      text: rows.map((r) => `${r.markersInList}/${r.markersK}`),
      textposition: "middle right",
      textfont: { size: 12, color: "#333", family: FONT },
      cliponaxis: false,
      hoverinfo: "skip",
      showlegend: false,
    } as Data);
  });

  traces.push({
    type: "scatter",
    x: [null],
    y: [null],
    mode: "markers",
    hoverinfo: "skip",
    showlegend: false,
    marker: {
      size: 0,
      opacity: 0,
      color: [LOGP_MIN],
      cmin: LOGP_MIN,
      cmax: LOGP_MAX,
      colorscale: [
        [0, "rgb(255,255,0)"],
        [1, "rgb(255,0,0)"],
      ],
      showscale: true,
      colorbar: {
        orientation: "h",
        x: 0.58,
        xref: "paper",
        xanchor: "center",
        y: -0.36,
        yref: "paper",
        len: 0.46,
        thickness: 14,
        outlinewidth: 0,
        tickvals: [LOGP_MIN, 2, 4, 6, LOGP_MAX],
        ticktext: ["1.3", "2", "4", "6", "≥8"],
        tickfont: { size: 11 },
        title: {
          text: "−log10(Padj)   (grey: Padj ≥ 0.05)",
          side: "bottom",
          font: { size: 12 },
        },
      },
    },
  } as Data);

  annotations.push({
    text: `${result.level[0].toUpperCase()}${result.level.slice(1)} level`,
    xref: "paper",
    yref: "paper",
    x: 0,
    y: -0.52,
    xanchor: "left",
    showarrow: false,
    font: { size: 12, color: "#555" },
  });

  layout.shapes = shapes as Layout["shapes"];

  return (
    <Plot
      data={traces}
      layout={layout}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}

export function MarkerStarPlot({
  reference,
  result,
}: {
  reference: BactmanReference;
  result: EnrichmentResult;
}) {
  const { cols, points } = markerStars(reference, result);
  const families = starRows(points);
  if (!points.length || !cols.length) return null;

  const labels = result.lists.filter((label) => cols.some((c) => c.list === label));
  const xpos = new Map<string, number>();
  const blocks: Array<{ label: string; x0: number; x1: number; color: string }> = [];
  let cursor = 0;
  labels.forEach((label) => {
    const start = cursor;
    for (const col of cols) {
      if (col.list !== label) continue;
      xpos.set(`${label}|${col.cellType}`, cursor);
      cursor += 1;
    }
    blocks.push({
      label,
      x0: start - 0.5,
      x1: cursor - 0.5,
      color: BLOCK_COLOURS[result.lists.indexOf(label) % BLOCK_COLOURS.length],
    });
    cursor += 0.6;
  });

  const yOf = new Map(families.map((f, i) => [f, i]));
  const listColor = new Map(
    result.lists.map((label, i) => [label, LIST_COLOURS[i % LIST_COLOURS.length]])
  );

  const shapes: Partial<Shape>[] = blocks.map((b) => ({
    type: "rect",
    xref: "x",
    yref: "y",
    x0: b.x0,
    x1: b.x1,
    y0: -0.5,
    y1: families.length - 0.5,
    fillcolor: b.color,
    line: { width: 0 },
    layer: "below",
  }));
  for (let i = 1; i < families.length; i++) {
    shapes.push({
      type: "line",
      xref: "x",
      yref: "y",
      x0: -0.6,
      x1: cursor - 1,
      y0: i - 0.5,
      y1: i - 0.5,
      line: { color: "white", width: 1.2 },
      layer: "below",
    });
  }

  const annotations: NonNullable<Layout["annotations"]> = [
    {
      text: `BACTMan markers of the<br>enriched cell types (${result.level} level)`,
      xref: "paper",
      yref: "paper",
      x: 0.5,
      y: 1.16,
      showarrow: false,
      font: { size: 14, color: "#555", family: FONT },
    },
    ...blocks.map((b) => ({
      x: (b.x0 + b.x1) / 2,
      y: -1.02,
      xref: "x" as const,
      yref: "y" as const,
      text: `<b>${b.label}</b>`,
      showarrow: false,
      font: { size: 14, color: "#222", family: FONT },
      yanchor: "bottom" as const,
    })),
  ];

  const trace: Data = {
    type: "scatter",
    mode: "text+markers",
    x: points.map((p) => xpos.get(`${p.list}|${p.cellType}`) ?? 0),
    y: points.map((p) => yOf.get(p.family) ?? 0),
    text: points.map((p) => p.arms),
    textposition: "middle right",
    textfont: { size: 11, color: "#555", family: FONT },
    cliponaxis: false,
    hovertemplate: points.map(
      (p) => `${p.family}${p.arms ? "-" + p.arms : ""}<br>${p.list}<br>${p.cellType}<extra></extra>`
    ),
    marker: {
      symbol: "star",
      size: 16,
      color: points.map((p) => listColor.get(p.list) ?? "#333"),
      line: { color: "black", width: 0.6 },
    },
    showlegend: false,
  };

  const layout: Partial<Layout> = {
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    height: Math.max(520, 28 * families.length + 230),
    margin: { l: 110, r: 80, t: 96, b: 120 },
    font: { family: FONT, color: "#222" },
    shapes: shapes as Layout["shapes"],
    annotations,
    xaxis: {
      range: [-0.7, cursor - 1.15],
      tickmode: "array",
      tickvals: cols.map((c) => xpos.get(`${c.list}|${c.cellType}`) ?? 0),
      ticktext: cols.map((c) => c.cellType),
      tickangle: -45,
      automargin: true,
      side: "bottom",
      showline: false,
      zeroline: false,
      showgrid: false,
      ticks: "",
      tickfont: { size: 13 },
    },
    yaxis: {
      range: [families.length - 0.5, -1.45],
      tickmode: "array",
      tickvals: families.map((_, i) => i),
      ticktext: families,
      showline: false,
      zeroline: false,
      showgrid: false,
      ticks: "",
      tickfont: { size: 13 },
      autorange: false,
    },
  };

  return (
    <Plot
      data={[trace]}
      layout={layout}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}
