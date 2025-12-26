// src/app/MiniBoxWithStats.tsx
"use client";

import dynamic from "next/dynamic";
import type { Layout, Data } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Stat = {
  miR: string;
  logFC: number;
  AveExpr: number;
  t: number;
  "P.Value": number;
  "adj.P.Val": number;
};

type Props = {
  mir: string;
  countsRow?: Record<string, number | string>;
  stat?: Stat;
};

const palette = {
  Neurons: "#E64B35",
  Astrocytes: "#4DBBD5",
  Microglia: "#00A087",
  Oligodendrocytes: "orange",
} as const;

const order: Array<keyof typeof palette> = [
  "Neurons",
  "Astrocytes",
  "Microglia",
  "Oligodendrocytes",
];

const abToFull: Record<string, keyof typeof palette> = {
  NEUN: "Neurons",
  GFAP: "Astrocytes",
  IBA1: "Microglia",
  OLIG2: "Oligodendrocytes",
};

function fmtNum(v: unknown, digits = 2) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  return n.toFixed(digits);
}

export default function MiniBoxWithStats({ mir, countsRow, stat }: Props) {
  if (!countsRow) {
    return (
      <div className="rounded border bg-white/50 p-8 text-gray-500">
        Loading oligodendrocyte counts…
      </div>
    );
  }

  const nameKey =
    Object.keys(countsRow).find((k) => k.toLowerCase().includes("mir")) ??
    Object.keys(countsRow)[0];

  const groupVals: Record<keyof typeof palette, number[]> = {
    Neurons: [],
    Astrocytes: [],
    Microglia: [],
    Oligodendrocytes: [],
  };

  // ✅ added: parallel sample-id arrays per group (for hover text)
  const groupTexts: Record<keyof typeof palette, string[]> = {
    Neurons: [],
    Astrocytes: [],
    Microglia: [],
    Oligodendrocytes: [],
  };

  for (const [sample, val] of Object.entries(countsRow)) {
    if (sample === nameKey) continue;

    const num = typeof val === "number" ? val : Number(val);
    if (!Number.isFinite(num)) continue;

    const parts = sample.split("_");
    const abbr = parts[1]?.toUpperCase();
    const full = abToFull[abbr || ""];
    if (full) {
      groupVals[full].push(num);

      // ✅ added: HU17 from "HU17_GFAP" etc.
      const sampleId = (parts[0] ?? "").trim();
      groupTexts[full].push(sampleId);
    }
  }

  const allVals = order.flatMap((ct) => groupVals[ct]);

  const maxY = allVals.length ? Math.max(...allVals) : 0;
  const minY = allVals.length ? Math.min(...allVals) : 0;

  // Top padding (nice spacing above)
  const yTop = maxY > 0 ? maxY * 1.05 : 1;

  // ✅ Bottom padding (THIS is the "distance from minimum" you can play with)
  const PAD = Math.max(5, Math.min(500, maxY * 0.00001));
  const yPadPoint = minY - PAD; // we'll force autorange to include this

  const boxTraces: Partial<Data>[] = order.map((ct) => ({
    type: "box",
    name: ct,
    y: groupVals[ct],

    // ✅ added: per-point sample id for hover
    text: groupTexts[ct],

    boxpoints: "all",
    jitter: 0.25,
    pointpos: 0,
    fillcolor: "rgba(0,0,0,0)",
    marker: { color: palette[ct], size: 6, opacity: 0.9 },
    line: { color: palette[ct], width: 3 },
    showlegend: false,

    // ✅ updated only: hover now includes sample id
    hovertemplate:
      "Sample: %{text}<br>CPM: %{y:.0f}<extra></extra>",
  }));

  // ✅ Invisible points to control autorange (bottom + top)
  const padBottomTrace: Partial<Data> = {
    type: "scatter",
    mode: "markers",
    x: [order[0]], // any category is fine
    y: [yPadPoint],
    marker: { opacity: 0, size: 0 },
    hoverinfo: "skip",
    showlegend: false,
  };

  const padTopTrace: Partial<Data> = {
    type: "scatter",
    mode: "markers",
    x: [order[0]],
    y: [yTop],
    marker: { opacity: 0, size: 0 },
    hoverinfo: "skip",
    showlegend: false,
  };

  const traces: Partial<Data>[] = [...boxTraces, padBottomTrace, padTopTrace];

  const layout: Partial<Layout> = {
    title: { text: mir },
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    margin: { l: 100, r: 20, t: 60, b: 150 },
    xaxis: {
      automargin: true,
      tickangle: -25,
      ticklabelposition: "outside",
      ticks: "outside",
    },
    yaxis: {
      title: { text: "CPM", standoff: 20 },
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
      ticklen: 5,

      // ✅ Let plotly autorange, and our invisible points will extend it
      autorange: true,
      rangemode: "normal",
    },
    autosize: true,
    height: 520,
  };

  return (
    <div className="grid grid-cols-12 gap-4 items-start">
      <div className="col-span-12 lg:col-span-8 rounded border bg-white p-3">
        <Plot
          data={traces as any}
          layout={layout as any}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%" }}
          useResizeHandler
        />
      </div>

      <div className="col-span-12 lg:col-span-4 rounded border bg-white p-4">
        <h4 className="font-semibold mb-2">Statistics</h4>

        {stat ? (
          <div className="space-y-1">
            <div>
              <span className="font-semibold">logFC:</span>{" "}
              {fmtNum(stat.logFC, 2)}
            </div>
            <div>
              <span className="font-semibold">P-val:</span>{" "}
              {fmtNum(stat["P.Value"], 2)}
            </div>
            <div>
              <span className="font-semibold">Adj.P-val:</span>{" "}
              {fmtNum(stat["adj.P.Val"], 2)}
            </div>
          </div>
        ) : (
          <div className="text-gray-500">No stats row found.</div>
        )}
      </div>
    </div>
  );
}
