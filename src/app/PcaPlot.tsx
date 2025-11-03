// src/app/PcaPlot.tsx
"use client";

import dynamic from "next/dynamic";
import type { Layout, Data } from "plotly.js";

type PcaRow = {
  [key: string]: string | number;
  "PC 1": number;
  "PC 2": number;
  "Cell type": "Neurons" | "Astrocytes" | "Microglia" | string;
};

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

  // טווחים ריבועיים (כמו באמצעי)
  const xs = data.map((r) => Number(r["PC 1"]));
  const ys = data.map((r) => Number(r["PC 2"]));
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY);
  const pad = span * 0.08;
  const half = span / 2 + pad;

  // מרווח ייעודי למקרא בצד ימין, שלא יכסה נקודות
  const LEGEND_GUTTER = 0.22; // רוחב “העמודה” למקרא בתוך ה-paper

  const layout: Partial<Layout> = {
    paper_bgcolor: "white",
    plot_bgcolor: "white",

    // לא צריך שול ימין גדול – השאירו את השוליים קטנים, כי שמרנו domain לציר X
    margin: { l: 80, r: 12, t: 50, b: 78 },

    // אזור הציור משמאל, והגוטר למקרא מימין
    xaxis: {
      title: { text: `PC 1 (${pc1Var}%)` },
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
      automargin: true,
      range: [cx - half, cx + half],
      constrain: "range",
      domain: [0, 1 - LEGEND_GUTTER], // ← שומר “מלבן עומד” למקרא
    },
    yaxis: {
      title: { text: `PC 2 (${pc2Var}%)` },
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
      automargin: true,
      range: [cy - half, cy + half],
      scaleanchor: "x",
      scaleratio: 1,
      constrain: "range",
    },

    // מקרא בעמודה הימנית (בתוך ה-paper, לא ייחתך ולא יסתיר)
    legend: {
      orientation: "v",
      // מניחים את המקרא באמצע הגוטר
      x: 1 - LEGEND_GUTTER / 2 + 0.05,
      xanchor: "center",
      y: 1,
      yanchor: "top",
      bgcolor: "rgba(255,255,255,0.9)",
      bordercolor: "rgba(0,0,0,0)",
      font: { size: 15 },
    },

    autosize: true,
    height,
  };

  return (
    <div style={{ width: "100%", overflow: "visible" }}>
      <Plot
        data={traces as any}
        layout={layout}
        style={{ width: "100%", overflow: "visible" }}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler
      />
    </div>
  );
}
