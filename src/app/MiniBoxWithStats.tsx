"use client";

import dynamic from "next/dynamic";
import type { Layout } from "plotly.js";

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
  // counts row for the miR from mirs_oligos_counts.csv
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
  "Microglia",
  "Neurons",
  "Astrocytes",
  "Oligodendrocytes",
];

const abToFull: Record<string, keyof typeof palette> = {
  NEUN: "Neurons",
  GFAP: "Astrocytes",
  IBA1: "Microglia",
  OLIG2: "Oligodendrocytes",
};

export default function MiniBoxWithStats({ mir, countsRow, stat }: Props) {
  if (!countsRow) {
    return (
      <div className="rounded border bg-white/50 p-8 text-gray-500">
        Loading oligodendrocyte counts…
      </div>
    );
  }

  // detect miR key (usually first col)
  const nameKey =
    Object.keys(countsRow).find((k) => k.toLowerCase().includes("mir")) ??
    Object.keys(countsRow)[0];

  // group by sample suffix
  const groupVals: Record<string, number[]> = {};
  order.forEach((k) => (groupVals[k] = []));

  for (const [sample, val] of Object.entries(countsRow)) {
    if (sample === nameKey) continue;
    if (typeof val !== "number") continue;

    const parts = sample.split("_");
    const abbr = parts[1]?.toUpperCase();
    const full = abToFull[abbr || ""] ?? undefined;
    if (full) groupVals[full].push(val);
  }

  // box + all points (transparent fill)
  const traces = order.map((ct) => ({
    type: "box" as const,
    name: ct,
    y: groupVals[ct],
    marker: { color: (palette as any)[ct], size: 6 },
    line: { color: (palette as any)[ct], width: 3 },
    fillcolor: "rgba(0,0,0,0)",
    boxpoints: "all" as const,
    jitter: 0.2,
    pointpos: 0,
    hoverinfo: "y+name",
    showlegend: false,
  }));

  const layout: Partial<Layout> = {
    title: { text: mir },
    // extra bottom room for long label "Oligodendrocytes"
    margin: { l: 60, r: 10, t: 40, b: 190 },
    xaxis: {
      automargin: true,
      tickangle: -25,
      tickpadding: 8,
    },
    yaxis: {
      title: { text: "Log(CPM)" },
      zeroline: false,
      mirror: true,
      ticks: "outside",
      ticklen: 5,
    },
    autosize: true,
    height: 520,
  };

  return (
    <div className="grid grid-cols-12 gap-4 items-start">
      {/* Plot */}
      <div className="col-span-12 lg:col-span-8 rounded border bg-white">
        <Plot data={traces as any} layout={layout} style={{ width: "100%" }} />
      </div>

      {/* Stats box */}
      <div className="col-span-12 lg:col-span-4 rounded border bg-white p-4">
        <h4 className="font-semibold mb-2">Statistics</h4>
        {stat ? (
          <div className="space-y-1 text-[15px]">
            <div>
              <span className="font-semibold">logFC:</span>{" "}
              {Number(stat.logFC).toFixed(2)}
            </div>
            <div>
              <span className="font-semibold">P-val:</span>{" "}
              {Number(stat["P.Value"]).toFixed(2)}
            </div>
            <div>
              <span className="font-semibold">Adj.P-val:</span>{" "}
              {Number(stat["adj.P.Val"]).toFixed(2)}
            </div>
          </div>
        ) : (
          <div className="text-gray-500">No stats row found.</div>
        )}
      </div>
    </div>
  );
}
