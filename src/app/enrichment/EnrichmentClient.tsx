// src/app/enrichment/EnrichmentClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Data, Layout, Shape } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type CTMarkers = Record<string, string[]>;

type Row = {
  cellType: string;
  pctOverlap: number; // % overlap out of reference marker list
  oddsRatio: number;
  pValue: number;
  pAdj: number;
  log10Padj: number; // -log10(pAdj)
};

const DATA_BASE = "/data";

async function loadJSON<T>(path: string): Promise<T> {
  const r = await fetch(path, { cache: "force-cache" });
  if (!r.ok) throw new Error(`Failed to fetch ${path}`);
  return r.json();
}

/* ---------------- Fisher exact (one-sided “greater”) + BH ---------------- */

function logFactorial(n: number) {
  if (n < 2) return 0;
  let s = 0;
  for (let k = 2; k <= n; k++) s += Math.log(k);
  return s;
}
function logChoose(n: number, k: number) {
  if (k < 0 || k > n) return -Infinity;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}
function hypergeomPMF(x: number, K: number, N: number, n: number) {
  if (x < 0 || x > K || x > n || n > N) return 0;
  const logp = logChoose(K, x) + logChoose(N - K, n - x) - logChoose(N, n);
  return Math.exp(logp);
}
function fisherExactGreater(a: number, b: number, c: number, d: number) {
  const n = a + b + c + d;
  const row1 = a + b;
  const col1 = a + c;
  let p = 0;

  const xMax = Math.min(row1, col1);
  for (let x = a; x <= xMax; x++) p += hypergeomPMF(x, col1, n, row1);

  return Math.min(1, Math.max(0, p));
}
function benjaminiHochberg(pvals: number[]) {
  const m = pvals.length;
  const idx = pvals.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const adj = new Array(m).fill(0);
  let prev = Infinity;

  for (let i = m - 1; i >= 0; i--) {
    const [p, orig] = idx[i];
    const val = Math.min(prev, (p * m) / (i + 1));
    adj[orig] = val;
    prev = val;
  }

  return adj.map((x) => Math.min(1, Math.max(0, x)));
}

/* ---------------- utils ---------------- */

function parseMirList(text: string) {
  return Array.from(
    new Set(
      text
        .split(/[\s,;]+/g)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

function safeLog10(x: number) {
  if (!Number.isFinite(x) || x <= 0) return 0;
  return Math.log(x) / Math.log(10);
}

/* ---------------- desired order ---------------- */
const DEFAULT_ORDER = ["Neurons", "Astrocytes", "Microglia", "Oligodendrocytes"];

// unified text style requested (same as main paragraph)
const BASE_TEXT = "text-gray-700 leading-6";

export default function EnrichmentClient() {
  const [ctMarkers, setCtMarkers] = useState<CTMarkers | null>(null);
  const [allExpressed, setAllExpressed] = useState<string[]>([]);
  const [exampleList, setExampleList] = useState<string[]>([]);
  const [textarea, setTextarea] = useState<string>("");

  const mirList = useMemo(() => parseMirList(textarea), [textarea]);

  useEffect(() => {
    (async () => {
      const [ctm, allM, ex] = await Promise.all([
        loadJSON<CTMarkers>(`${DATA_BASE}/cell_type_markers.json`),
        loadJSON<string[]>(`${DATA_BASE}/all_expressed_mirs.json`),
        loadJSON<string[]>(`${DATA_BASE}/AD_example_list.json`),
      ]);
      setCtMarkers(ctm);
      setAllExpressed(allM);
      setExampleList(ex);
    })().catch(console.error);
  }, []);

  const cellTypes = useMemo(() => {
    if (!ctMarkers) return [];
    const keys = Object.keys(ctMarkers);

    const ordered = DEFAULT_ORDER.filter((ct) => keys.includes(ct));
    const rest = keys.filter((k) => !ordered.includes(k));
    return [...ordered, ...rest];
  }, [ctMarkers]);

  const notInAtlas = useMemo(
    () => mirList.filter((m) => !allExpressed.some((x) => x.includes(m))),
    [mirList, allExpressed]
  );

  const inAtlas = useMemo(
    () => mirList.filter((m) => allExpressed.some((x) => x.includes(m))),
    [mirList, allExpressed]
  );

  const rows: Row[] = useMemo(() => {
    if (!ctMarkers || cellTypes.length === 0) return [];

    const nunexAD = new Set(
      allExpressed.filter((m) => inAtlas.some((q) => m.includes(q)))
    );
    const nunexNotAD = new Set(allExpressed.filter((m) => !nunexAD.has(m)));

    const out: Omit<Row, "pAdj" | "log10Padj">[] = [];
    const pvals: number[] = [];

    for (const ct of cellTypes) {
      const markersArr = ctMarkers[ct] || [];
      const markers = new Set(markersArr);

      const overlapCt = new Set(
        [...markers].filter((m) => inAtlas.some((q) => m.includes(q)))
      );

      const ad_not_ct = new Set([...nunexAD].filter((m) => !overlapCt.has(m)));
      const not_ad_not_ct = new Set(
        [...nunexNotAD].filter((m) => !overlapCt.has(m))
      );
      const ct_not_ad = new Set([...markers].filter((m) => !nunexAD.has(m)));

      const a = overlapCt.size;
      const b = ad_not_ct.size;
      const c = ct_not_ad.size;
      const d = not_ad_not_ct.size;

      const p = fisherExactGreater(a, b, c, d);
      pvals.push(p);

      const pct = (a * 100) / Math.max(1, markers.size);
      const or = (a * d) / Math.max(1e-12, b * c);

      out.push({
        cellType: ct,
        pctOverlap: pct,
        oddsRatio: or,
        pValue: p,
      });
    }

    const padj = benjaminiHochberg(pvals);

    return out.map((r, i) => {
      const q = padj[i];
      const log10Padj = q > 0 ? -safeLog10(q) : 0;
      return { ...r, pAdj: q, log10Padj };
    });
  }, [ctMarkers, cellTypes, allExpressed, inAtlas]);

  /* ---------------- Dotplot (like python) ---------------- */
  const dotPlot = useMemo(() => {
    if (!rows.length) return null;

    const yCats = [...rows.map((r) => r.cellType)].reverse();

    const xMap = new Map(rows.map((r) => [r.cellType, r.oddsRatio]));
    const cMap = new Map(rows.map((r) => [r.cellType, r.log10Padj]));
    const pAdjMap = new Map(rows.map((r) => [r.cellType, r.pAdj]));

    const y = yCats;
    const x = y.map((ct) => xMap.get(ct) ?? 0);
    const col = y.map((ct) => cMap.get(ct) ?? 0);
    const padj = y.map((ct) => pAdjMap.get(ct) ?? 1);

    // ✅ start x-axis slightly below 0 so markers at 0 are fully visible
    const maxX = Math.max(1, ...x.filter((v) => Number.isFinite(v)));
    const xMax = Math.max(1, maxX * 1.05);
    const xMin = -0.1;

    const shapes: Partial<Shape>[] = y.map((ct, i) => ({
      type: "line",
      x0: 0,
      x1: x[i] ?? 0,
      y0: ct,
      y1: ct,
      xref: "x",
      yref: "y",
      line: { color: "lightgrey", width: 1 },
      opacity: 1,
      layer: "below",
    }));

    const trace: Partial<Data> = {
      type: "scatter",
      mode: "markers",
      x,
      y,
      marker: {
        size: 26,
        opacity: 0.85,
        color: col,
        colorscale: "Viridis",
        showscale: true,
        line: { color: "black", width: 0.5 },
        colorbar: {
          title: { text: "-log10(Padj)" },
          thickness: 18,
          outlinewidth: 0,
        },
      },
      customdata: padj,
      hovertemplate:
        "Cell type: %{y}<br>Odd ratio: %{x:.3g}<br>Padj: %{customdata:.3g}<br>-log10(Padj): %{marker.color:.2f}<extra></extra>",
      showlegend: false,
    };

    const height = Math.max(420, 120 + y.length * 55);

    const layout: Partial<Layout> = {
      paper_bgcolor: "white",
      plot_bgcolor: "white",
      margin: { l: 180, r: 60, t: 10, b: 60 },
      xaxis: {
        title: { text: "Odd ratio" },
        zeroline: false,
        showline: true,
        mirror: true, // ✅ top line
        linecolor: "black",
        linewidth: 1,
        ticks: "outside",
        ticklen: 5,
        range: [xMin, xMax],
      },
      yaxis: {
        title: { text: "" },
        automargin: true,
        categoryorder: "array",
        categoryarray: y,

        // ✅ add LEFT + RIGHT frame lines (to match top/bottom)
        zeroline: false,
        showline: true,
        mirror: true, // ✅ right line
        linecolor: "black",
        linewidth: 1,
        ticks: "outside",
        ticklen: 5,
      },
      shapes: shapes as any,
      height,
    };

    return (
      <div className="rounded border bg-white p-3">
        <Plot
          data={[trace as any]}
          layout={layout as any}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%" }}
          useResizeHandler
        />
      </div>
    );
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Title */}
      <div className="flex justify-center mb-4">
        <h1 className="text-4xl sm:text-5xl font-semibold text-center mb-6">
          Cell type enrichment in a list of miRs of interest
        </h1>
      </div>

      {/* Description */}
      <p className={BASE_TEXT}>
        This tool infers the cell type enrichment of a microRNA (miR) list using a
        reference-based deconvolution approach. It compares the user-provided miRs to a
        curated atlas of cell-type-specific miR markers and computes the fraction of
        markers detected for each cell type. To determine whether the observed overlap is
        greater than expected by chance, the tool applies a one-sided Fisher’s exact test
        for each cell type, followed by FDR correction. The output highlights the cell
        types whose marker miRs are significantly enriched in the input list.
      </p>

      {/* Preprint line (same font/size, left-aligned) */}
      <div className="mt-2 flex justify-start">
        <p className={`${BASE_TEXT} text-left`}>
          For more information, please refer to our preprint – Dubnov et al.,{" "}
          <a
            className="underline"
            href="https://www.biorxiv.org"
            target="_blank"
            rel="noreferrer"
          >
            bioRxiv
          </a>
          , 2026.
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mt-6">
        <div className="md:col-span-2">
          <label className={`block ${BASE_TEXT} mb-2`}>Insert your list</label>
          <textarea
            className="w-full h-36 border rounded-lg p-3"
            placeholder="Paste miR IDs separated by commas, spaces, or new lines"
            value={textarea}
            onChange={(e) => setTextarea(e.target.value)}
          />

          {!!notInAtlas.length && (
            <div className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
              <div className="font-medium mb-1">Not expressed in the atlas:</div>
              <div className="break-words">{notInAtlas.join(", ")}</div>
              <div className="mt-2 text-gray-700">
                The analysis is performed on the subset of expressed miRs.
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-1">
          <label className={`block ${BASE_TEXT} mb-2`}>Example</label>
          <button
            type="button"
            className="w-full border rounded-lg px-4 py-2 hover:bg-gray-50"
            onClick={() => setTextarea(exampleList.join("\n"))}
          >
            Load example list
          </button>

          <p className={`${BASE_TEXT} mt-2`}>
            This example list represents miRs, differentially expressed in Alzheimer&apos;s
            Disease postmortem brain samples (data from{" "}
            <a
              href="https://doi.org/10.1016/j.neurobiolaging.2025.03.014"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Liu et al., 2025
            </a>
            ).
          </p>
        </div>
      </div>

      {/* Dotplot */}
      <div className="mt-8">
        {dotPlot ? (
          dotPlot
        ) : (
          <div className="text-gray-500 p-6">
            Provide a list or click “Load example list”.
          </div>
        )}
      </div>

      {/* Table */}
      <div className="mt-8">
        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-3 py-2">Cell type</th>
                <th className="px-3 py-2">% overlap</th>
                <th className="px-3 py-2">Odd ratio</th>
                <th className="px-3 py-2">Pvalue</th>
                <th className="px-3 py-2">Padj</th>
                <th className="px-3 py-2">-log10(Padj)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.cellType} className="border-t">
                  <td className="px-3 py-2">{r.cellType}</td>
                  <td className="px-3 py-2">{r.pctOverlap.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {Number.isFinite(r.oddsRatio) ? r.oddsRatio.toFixed(4) : "—"}
                  </td>
                  <td className="px-3 py-2">{r.pValue.toExponential(3)}</td>
                  <td className="px-3 py-2">
                    {r.pAdj < 0.001 ? r.pAdj.toExponential(3) : r.pAdj.toFixed(4)}
                  </td>
                  <td className="px-3 py-2">{r.log10Padj.toFixed(3)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr className="border-t">
                  <td className="px-3 py-4 text-gray-500" colSpan={6}>
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
