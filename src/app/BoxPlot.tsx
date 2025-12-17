// src/app/BoxPlot.tsx
"use client";

import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";
import type { PcaRow } from "./types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Props = {
  title: string;
  data: PcaRow[];
  mir: string;
  colors?: { neurons: string; astro: string; micro: string };
  height?: number;
};

function chooseDtick(maxY: number) {
  if (maxY >= 50000) return 10000;
  if (maxY >= 20000) return 5000;
  if (maxY >= 8000) return 2000;
  if (maxY >= 3000) return 1000;
  if (maxY >= 1200) return 200;
  return 100;
}

export default function BoxPlot({
  title,
  data,
  mir,
  colors = { neurons: "#E64B35", astro: "#4DBBD5", micro: "#00A087" },
  height = 520,
}: Props) {
  const getY = (cell: string) =>
    data
      .filter((r) => String(r["Cell type"]).toLowerCase().includes(cell))
      .map((r) => Number((r as any)[mir]))
      .filter((v) => Number.isFinite(v));

  const neurons = getY("neuron");
  const astro = getY("astro");
  const micro = getY("micro");

  const allVals = [...neurons, ...astro, ...micro];
  const minY = allVals.length ? Math.min(...allVals) : 0;
  const maxY = allVals.length ? Math.max(...allVals) : 0;

  // ✅ padding that is actually visible on large CPM scales:
  //    at least 10, but also ~5% of max (capped a bit so it doesn't get crazy)
  const PAD = Math.max(5, Math.min(500, maxY * 0.00001));
  const yPadPoint = minY - PAD; // we'll force autorange to include this

  const trace = (name: string, y: number[], color: string): Partial<Data> => ({
    type: "box",
    name,
    y,
    boxpoints: "all",
    jitter: 0.35,
    pointpos: 0,
    marker: { color, opacity: 0.85, size: 7 },
    line: { color, width: 3 },
    fillcolor: "rgba(0,0,0,0)",
    hovertemplate: "CPM: %{y:.0f}<extra></extra>",
  });

  // ✅ invisible trace that only exists to expand y-range below the min
  const padTrace: Partial<Data> = {
    type: "scatter",
    mode: "markers",
    x: ["Neurons"], // any x-category that exists
    y: [yPadPoint],
    marker: { opacity: 0, size: 1 },
    hoverinfo: "skip",
    showlegend: false,
  };

  const dataTraces: Partial<Data>[] = [
    trace("Neurons", neurons, colors.neurons),
    trace("Astrocytes", astro, colors.astro),
    trace("Microglia", micro, colors.micro),
    padTrace,
  ];

  const dtick = chooseDtick(maxY);

  const layout: Partial<Layout> = {
    title: { text: title },
    margin: { l: 100, r: 20, t: 60, b: 130 },
    xaxis: {
      title: { text: "" },
      tickangle: 30,
      automargin: true,
    },
    yaxis: {
      title: { text: "CPM", standoff: 20 },
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
      automargin: true,

      // ✅ crucial: do NOT force "tozero"
      rangemode: "normal",

      // ✅ keep ticks starting at 0 (so you don't see negative labels),
      // but still have blank space below 0 thanks to padTrace.
      tick0: 0,
      dtick,
      tickformat: "~s",
    },
    showlegend: false,
    height,
    paper_bgcolor: "white",
    plot_bgcolor: "white",
  };

  return (
    <Plot
      key={`${mir}-${title}`} // remount when mir changes
      data={dataTraces as any}
      layout={layout as any}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%", height }}
      useResizeHandler
    />
  );
}
