// src/app/PcaPlot.tsx
"use client";

import dynamic from "next/dynamic";
import type { Layout, Data } from "plotly.js";
import type { PcaRow } from "./types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Props = {
  data: PcaRow[];
  pc1Var: number;
  pc2Var: number;
  height?: number;
};

const COLORS = {
  Neurons: "#E64B35",
  Astrocytes: "#4DBBD5",
  Microglia: "#00A087",
} as const;

export default function PcaPlot({ data, pc1Var, pc2Var, height = 420 }: Props) {
  const types = ["Neurons", "Astrocytes", "Microglia"] as const;

  const traces: Partial<Data>[] = types.map((ct) => {
    const subset = data.filter((r) => String(r["Cell type"]) === ct);
    return {
      type: "scattergl",
      mode: "markers",
      name: ct,
      x: subset.map((r) => Number(r["PC 1"])),
      y: subset.map((r) => Number(r["PC 2"])),
      marker: { size: 8, color: COLORS[ct], opacity: 0.9 },
      hovertemplate: "PC1: %{x:.2f}<br>PC2: %{y:.2f}<extra></extra>",
    };
  });

  const layout: Partial<Layout> = {
    // מסגרת ותצוגה זהה לגרף האמצעי
    paper_bgcolor: "white",
    plot_bgcolor: "white",

    // מרווח ימין מוגדל כדי שה-legend לא ייחתך
    margin: { l: 70, r: 140, t: 40, b: 80 },

    // צירים זהים לאמצעי + ריבוע פרופורציונלי
    xaxis: {
      title: { text: `PC 1 (${pc1Var}%)` },
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
      automargin: true,
    },
    yaxis: {
      title: { text: `PC 2 (${pc2Var}%)` },
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
      automargin: true,
      scaleanchor: "x",
      scaleratio: 1,
    },

    // legend מחוץ לפלוט, מיושר לימין – לא נחתך
    legend: {
      x: 1.02,
      y: 1,
      xanchor: "left",
      bgcolor: "rgba(255,255,255,0.7)",
      bordercolor: "rgba(0,0,0,0)",
      font: { size: 14 },
      orientation: "v",
    },

    autosize: true,
    height,
  };

  return (
    <Plot
      data={traces as any}
      layout={layout}
      style={{ width: "100%" }}
      config={{ displayModeBar: false }}
    />
  );
}
