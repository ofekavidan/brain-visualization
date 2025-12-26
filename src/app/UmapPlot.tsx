// src/app/UmapPlot.tsx
"use client";

import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";
import type { PcaRow } from "./types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Props = {
  title: string;
  data: PcaRow[];
  mir: string;
  pc1Var: number;
  pc2Var: number;
};

function pickSampleKey(row: Record<string, unknown>): string | null {
  const keys = Object.keys(row);

  // common candidates (your PCA CSV often uses "Unnamed: 0")
  const candidates = [
    "Sample",
    "sample",
    "Sample ID",
    "sample_id",
    "id",
    "ID",
    "Index",
    "index",
    "Unnamed: 0",
    "unnamed: 0",
    "unnamed:0",
    "Unnamed:0",
  ];

  for (const c of candidates) {
    const exact = keys.find((k) => k === c);
    if (exact) return exact;
  }

  // fallback: any "unnamed" column
  const unnamed = keys.find((k) => k.toLowerCase().startsWith("unnamed"));
  if (unnamed) return unnamed;

  return null;
}

function sampleLabelFromRow(row: Record<string, unknown>): string {
  const k = pickSampleKey(row);
  const raw = k ? String((row as any)[k] ?? "") : "";
  if (!raw) return "";

  // Example: "HU44_GFAP" -> "HU44"
  const short = raw.split("_")[0]?.trim() ?? raw.trim();
  return short || raw.trim();
}

export default function UmapPlot({ title, data, mir, pc1Var, pc2Var }: Props) {
  const sorted = [...data]
    .map((r) => {
      const x = Number(r["PC 1"]);
      const y = Number(r["PC 2"]);
      const cpm = Number((r as any)[mir] ?? 0);

      // ✅ sample id for hover
      const sampleId = sampleLabelFromRow(r as any);

      return { x, y, cpm, sampleId };
    })
    .filter(
      (p) =>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        Number.isFinite(p.cpm)
    )
    .sort((a, b) => a.cpm - b.cpm);

  const x = sorted.map((p) => p.x);
  const y = sorted.map((p) => p.y);
  const z = sorted.map((p) => p.cpm);

  // ✅ shown in hover using %{text}
  const text = sorted.map((p) => p.sampleId || "");

  const trace: Partial<Data> = {
    type: "scattergl",
    mode: "markers",
    x,
    y,
    text,
    marker: {
      size: 10,
      opacity: 0.85,
      color: z,
      colorscale: "YlOrRd",
      reversescale: true,
      showscale: true,
      colorbar: {
        // ✅ turn off built-in title (we draw our own)
        title: { text: "" },

        thickness: 20,
        outlinewidth: 0,
        tickformat: "~s",

        // keep bar and ticks placement stable
        x: 1.02,
        xanchor: "left",
        y: 0.5,
        yanchor: "middle",
        len: 0.9,
      } as any,
    },
    hovertemplate:
      "Sample: %{text}<br>PC1: %{x:.2f}<br>PC2: %{y:.2f}<br>CPM: %{marker.color:.0f}<extra></extra>",
  };

  const layout: Partial<Layout> = {
    title: { text: title },

    // ✅ enough room so CPM label sits to the RIGHT of the tick labels
    margin: { l: 80, r: 150, t: 50, b: 70 },

    paper_bgcolor: "white",
    plot_bgcolor: "white",
    xaxis: {
      title: { text: `PC 1 (${pc1Var}%)` },
      ticks: "",
      showticklabels: false,
      zeroline: false,
      showgrid: false,
      showline: true,
      mirror: false,
      linecolor: "black",
      linewidth: 2,
    },
    yaxis: {
      title: { text: `PC 2 (${pc2Var}%)` },
      ticks: "",
      showticklabels: false,
      zeroline: false,
      showgrid: false,
      showline: true,
      mirror: false,
      linecolor: "black",
      linewidth: 2,
      scaleanchor: "x",
      scaleratio: 1,
    },

    // ✅ custom CPM label — FIXED direction by flipping the angle
    annotations: [
      {
        text: "CPM",
        showarrow: false,
        xref: "paper",
        yref: "paper",
        x: 1.02,
        y: 0.5,
        xanchor: "left",
        yanchor: "middle",

        // 🔥 this line fixes the “flipped CPM”
        textangle: -90,

        font: { size: 14, color: "black" },

        // move beyond tick labels so it won't overlap 20k/10k
        xshift: 70,
      } as any,
    ],

    autosize: true,
    height: 420,
  };

  return (
    <Plot
      data={[trace as any]}
      layout={layout as any}
      style={{ width: "100%", height: 420 }}
      config={{ displayModeBar: false, responsive: true }}
      useResizeHandler
    />
  );
}
