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

export default function UmapPlot({ title, data, mir, pc1Var, pc2Var }: Props) {
  const sorted = [...data]
    .map((r) => {
      const x = Number(r["PC 1"]);
      const y = Number(r["PC 2"]);
      const cpm = Number((r as any)[mir] ?? 0);
      return { x, y, cpm };
    })
    .filter(
      (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.cpm)
    )
    .sort((a, b) => a.cpm - b.cpm);

  const x = sorted.map((p) => p.x);
  const y = sorted.map((p) => p.y);
  const z = sorted.map((p) => p.cpm);

  const trace: Partial<Data> = {
    type: "scattergl",
    mode: "markers",
    x,
    y,
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
      "PC1: %{x:.2f}<br>PC2: %{y:.2f}<br>CPM: %{marker.color:.0f}<extra></extra>",
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
