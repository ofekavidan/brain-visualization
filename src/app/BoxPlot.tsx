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

// build at most `maxTicks` y-ticks (starting at 0) so labels don't overlap
function buildTickVals(maxY: number, maxTicks = 6): number[] {
  if (!Number.isFinite(maxY) || maxY <= 0) return [0];

  let dt = chooseDtick(maxY);

  // if too many ticks, enlarge step by an integer factor
  const baseCount = Math.floor(maxY / dt) + 1; // includes 0
  if (baseCount > maxTicks) {
    const factor = Math.ceil((baseCount - 1) / (maxTicks - 1));
    dt *= factor;
  }

  // generate ticks 0..maxY by dt
  const ticks: number[] = [];
  for (let v = 0; v <= maxY + 1e-9; v += dt) ticks.push(v);

  // ensure we include maxY as last tick (helps when maxY is not aligned to dt)
  if (ticks[ticks.length - 1] < maxY) ticks.push(maxY);

  // if still too many, subsample evenly down to maxTicks
  if (ticks.length > maxTicks) {
    const out: number[] = [];
    const last = ticks.length - 1;
    for (let i = 0; i < maxTicks; i++) {
      const idx = Math.round((i * last) / (maxTicks - 1));
      out.push(ticks[idx]);
    }
    // de-dup (rounding can collide)
    return Array.from(new Set(out)).sort((a, b) => a - b);
  }

  return ticks;
}

function pickSampleKey(row: Record<string, unknown>): string | null {
  const keys = Object.keys(row);

  // common candidates (your PCA CSV uses "Unnamed: 0" as the sample name column)
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

  // Example: "HU44_GFAP" -> want "HU44" (what you asked: Hu17 / hu29)
  const short = raw.split("_")[0]?.trim() ?? raw.trim();
  return short || raw.trim();
}

export default function BoxPlot({
  title,
  data,
  mir,
  colors = { neurons: "#E64B35", astro: "#4DBBD5", micro: "#00A087" },
  height = 520,
}: Props) {
  type Point = { y: number; text: string };

  const getPoints = (cell: string): Point[] =>
    data
      .filter((r) => String(r["Cell type"]).toLowerCase().includes(cell))
      .map((r) => {
        const y = Number((r as any)[mir]);
        const text = sampleLabelFromRow(r as any);
        return { y, text };
      })
      .filter((p) => Number.isFinite(p.y));

  const neuronsPts = getPoints("neuron");
  const astroPts = getPoints("astro");
  const microPts = getPoints("micro");

  const neurons = neuronsPts.map((p) => p.y);
  const astro = astroPts.map((p) => p.y);
  const micro = microPts.map((p) => p.y);

  const allVals = [...neurons, ...astro, ...micro];
  const minY = allVals.length ? Math.min(...allVals) : 0;
  const maxY = allVals.length ? Math.max(...allVals) : 0;

  // padding that is actually visible on large CPM scales
  const PAD = Math.max(5, Math.min(500, maxY * 0.00001));
  const yPadPoint = minY - PAD;

  const trace = (
    name: string,
    pts: Point[],
    color: string
  ): Partial<Data> => ({
    type: "box",
    name,
    y: pts.map((p) => p.y),
    text: pts.map((p) => p.text), // <-- per-point sample id
    boxpoints: "all",
    jitter: 0.35,
    pointpos: 0,
    marker: { color, opacity: 0.85, size: 7 },
    line: { color, width: 3 },
    fillcolor: "rgba(0,0,0,0)",
    hovertemplate:
      "Sample: %{text}<br>CPM: %{y:.0f}<extra></extra>",
  });

  // invisible trace that only exists to expand y-range below the min
  const padTrace: Partial<Data> = {
    type: "scatter",
    mode: "markers",
    x: ["Neurons"],
    y: [yPadPoint],
    marker: { opacity: 0, size: 1 },
    hoverinfo: "skip",
    showlegend: false,
  };

  const dataTraces: Partial<Data>[] = [
    trace("Neurons", neuronsPts, colors.neurons),
    trace("Astrocytes", astroPts, colors.astro),
    trace("Microglia", microPts, colors.micro),
    padTrace,
  ];

  const tickvals = buildTickVals(maxY, 6);

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
      rangemode: "normal",
      tickmode: "array",
      tickvals,
      tickformat: "~s",
    },
    showlegend: false,
    height,
    paper_bgcolor: "white",
    plot_bgcolor: "white",
  };

  return (
    <Plot
      key={`${mir}-${title}`}
      data={dataTraces as any}
      layout={layout as any}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%", height }}
      useResizeHandler
    />
  );
}
