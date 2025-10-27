// src/app/UmapPlot.tsx
"use client";

import dynamic from "next/dynamic";
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
  // וקטורי נתונים
  const x = data.map((r) => r["PC 1"]);
  const y = data.map((r) => r["PC 2"]);
  const z = data.map((r) => Number((r as any)[mir] ?? 0));

  const trace: Partial<Plotly.Data> = {
    type: "scattergl",
    mode: "markers",
    x,
    y,
    marker: {
      size: 10,
      opacity: 0.9,
      color: z,
      colorscale: "Viridis",
      showscale: true,
      colorbar: {
        title: { text: "log(counts)" }, // 👈 כותרת כ־אובייקט
        thickness: 20,
        outlinewidth: 0,
      },
    },
    hovertemplate: "PC1: %{x:.2f}<br>PC2: %{y:.2f}<br>log: %{marker.color:.2f}<extra></extra>",
  };

  const layout: Partial<Plotly.Layout> = {
    title: { text: title },
    margin: { l: 70, r: 20, t: 50, b: 70 },
    xaxis: {
      title: { text: `PC 1 (${pc1Var}%)` }, // 👈 לא string ישיר
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
    },
    yaxis: {
      title: { text: `PC 2 (${pc2Var}%)` }, // 👈 לא string ישיר
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
      // ריבוע מושלם
      scaleanchor: "x",
      scaleratio: 1,
    },
  };

  return <Plot data={[trace as any]} layout={layout} style={{ width: "100%", height: 420 }} />;
}
