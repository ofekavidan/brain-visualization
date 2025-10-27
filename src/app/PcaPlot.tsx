// src/app/PcaPlot.tsx
"use client";

import dynamic from "next/dynamic";
import type { PcaRow } from "./types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Props = {
  data: PcaRow[];
  pc1Var: number;
  pc2Var: number;
};

const COLORS = {
  Neurons: "#E64B35",
  Astrocytes: "#4DBBD5",
  Microglia: "#00A087",
};

export default function PcaPlot({ data, pc1Var, pc2Var }: Props) {
  // מפרידים ל-traces לפי סוג תא, כמו בסיבּוֹרן
  const types: Array<keyof typeof COLORS> = [
    "Neurons",
    "Astrocytes",
    "Microglia",
  ];

  const traces: Partial<Plotly.Data>[] = types.map((ct) => {
    const subset = data.filter((r) => r["Cell type"] === ct);
    return {
      type: "scattergl",
      mode: "markers",
      name: ct,
      x: subset.map((r) => r["PC 1"]),
      y: subset.map((r) => r["PC 2"]),
      marker: { size: 10, color: (COLORS as any)[ct] },
      hovertemplate: "PC1: %{x:.2f}<br>PC2: %{y:.2f}<extra></extra>",
    };
  });

  const layout: Partial<Plotly.Layout> = {
    margin: { l: 70, r: 10, t: 10, b: 70 },
    showlegend: true,
    legend: {
      x: 1.02,
      y: 1,
      bgcolor: "rgba(0,0,0,0)",
      borderwidth: 0,
      orientation: "v",
    },
    xaxis: {
      title: { text: `PC 1 (${pc1Var}%)` }, // ← לא string ישיר
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
    },
    yaxis: {
      title: { text: `PC 2 (${pc2Var}%)` }, // ← לא string ישיר
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
      scaleanchor: "x", // ריבוע מושלם
      scaleratio: 1,
    },
  };

  return (
    <Plot
      data={traces as any}
      layout={layout}
      style={{ width: "100%", height: 420 }}
      config={{ displayModeBar: false }}
    />
  );
}
