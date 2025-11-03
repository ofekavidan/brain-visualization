// src/app/PcaTwoSubplots.tsx
"use client";

import dynamic from "next/dynamic";
import type { Layout, Data } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type PcaRow = {
  [k: string]: string | number;
  "PC 1": number;
  "PC 2": number;
  "Cell type": "Neurons" | "Astrocytes" | "Microglia" | string;
};

type Props = {
  data: PcaRow[];
  mir: string;
  pc1Var: number;
  pc2Var: number;
  height?: number; // כל הדמות; כל סאב-פלוט יקבל חצי רוחב
};

const COLORS = {
  Neurons: "#E64B35",
  Astrocytes: "#4DBBD5",
  Microglia: "#00A087",
} as const;

export default function PcaTwoSubplots({
  data,
  mir,
  pc1Var,
  pc2Var,
  height = 420,
}: Props) {
  // --- חישוב טווח משותף ריבועי לשני הסאב-פלוטים ---
  const xs = data.map((r) => Number(r["PC 1"]));
  const ys = data.map((r) => Number(r["PC 2"]));
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY);
  const pad = span * 0.08;
  const half = span / 2 + pad;
  const rangeX: [number, number] = [cx - half, cx + half];
  const rangeY: [number, number] = [cy - half, cy + half];

  // --- Traces: שמאלי (צבע לפי תא), ימני (עוצמה לפי mir) ---
  const types = ["Neurons", "Astrocytes", "Microglia"] as const;

  const leftTraces: Partial<Data>[] = types.map((ct) => {
    const subset = data.filter((r) => String(r["Cell type"]) === ct);
    return {
      type: "scattergl",
      mode: "markers",
      name: ct,
      x: subset.map((r) => Number(r["PC 1"])),
      y: subset.map((r) => Number(r["PC 2"])),
      marker: { size: 8, color: COLORS[ct], opacity: 0.9 },
      hovertemplate: "PC1: %{x:.2f}<br>PC2: %{y:.2f}<extra></extra>",
      xaxis: "x1",
      yaxis: "y1",
    };
  });

  const rightTrace: Partial<Data> = {
    type: "scattergl",
    mode: "markers",
    name: mir,
    x: xs,
    y: ys,
    marker: {
      size: 8,
      opacity: 0.9,
      color: data.map((r) => Number((r as any)[mir] ?? NaN)),
      colorscale: "Viridis",
      colorbar: { title: { text: "log(counts)" } }
    },
    hovertemplate:
      `PC1: %{x:.2f}<br>PC2: %{y:.2f}<br>${mir}: %{marker.color:.2f}<extra></extra>`,
    xaxis: "x2",
    yaxis: "y2",
    showlegend: false,
  };

  const layout: Partial<Layout> = {
    paper_bgcolor: "white",
    plot_bgcolor: "white",

    grid: { rows: 1, columns: 2, pattern: "independent" },

    // שוליים נדיבים כדי שלא ייחתכו לייבלים
    margin: { l: 80, r: 40, t: 60, b: 78 },

    // ציר שמאלי
    xaxis: {
      title: { text: `PC 1 (${pc1Var}%)` },
      range: rangeX,
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
      automargin: true,
    },
    yaxis: {
      title: { text: `PC 2 (${pc2Var}%)` },
      range: rangeY,
      scaleanchor: "x",
      scaleratio: 1,
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
      automargin: true,
    },

    // ציר ימני
    xaxis2: {
      title: { text: `PC 1 (${pc1Var}%)` },
      range: rangeX,
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
      automargin: true,
      anchor: "y2",
    },
    yaxis2: {
      title: { text: `PC 2 (${pc2Var}%)` },
      range: rangeY,
      scaleanchor: "x2",
      scaleratio: 1,
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
      automargin: true,
      anchor: "x2",
    },

    // מקרא בתוך הסאב-פלוט השמאלי
    legend: {
      orientation: "v",
      x: 0.47, // בתוך תחום הסאב-פלוט השמאלי
      y: 0.98,
      xanchor: "right",
      yanchor: "top",
      bgcolor: "rgba(255,255,255,0.85)",
      bordercolor: "rgba(0,0,0,0)",
      font: { size: 14 },
      tracegroupgap: 6,
    },

    height,
  };

  return (
    <div style={{ width: "100%", overflow: "visible" }}>
      <Plot
        data={[...leftTraces, rightTrace] as any}
        layout={layout}
        style={{ width: "100%", overflow: "visible" }}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler
      />
    </div>
  );
}
