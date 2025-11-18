"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type CTMarkers = Record<string, string[]>;

type Row = {
  cellType: string;
  pctOverlap: number;
  oddsRatio: number;
  pValue: number;
  pAdj: number;
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
  return p;
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
  return adj;
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
const STAR_THRESHOLDS: { lt: number; label: string }[] = [
  { lt: 1e-4, label: "****" },
  { lt: 1e-3, label: "***" },
  { lt: 1e-2, label: "**" },
  { lt: 5e-2, label: "*" },
  { lt: Infinity, label: "" },
];
function pToStars(p: number | undefined) {
  if (p === undefined || Number.isNaN(p)) return "";
  for (const t of STAR_THRESHOLDS) if (p < t.lt) return t.label;
  return "";
}

/* ---------------- desired order + palette ---------------- */
// TOP→BOTTOM (plot & table):
const DEFAULT_ORDER = ["Neurons", "Astrocytes", "Microglia", "Oligodendrocytes"];
const PALETTE: Record<string, string> = {
  Neurons: "#e9967a",
  Astrocytes: "#87ceeb",
  Microglia: "#2e8b57",
  Oligodendrocytes: "#f0c36d",
};

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
    const nunexAD = new Set(allExpressed.filter((m) => inAtlas.some((q) => m.includes(q))));
    const nunexNotAD = new Set(allExpressed.filter((m) => !nunexAD.has(m)));

    const out: Row[] = [];
    const pvals: number[] = [];

    for (const ct of cellTypes) {
      const markers = new Set(ctMarkers[ct] || []);
      const overlapCt = new Set([...markers].filter((m) => inAtlas.some((q) => m.includes(q))));
      const ad_not_ct = new Set([...nunexAD].filter((m) => !overlapCt.has(m)));
      const not_ad_not_ct = new Set([...nunexNotAD].filter((m) => !overlapCt.has(m)));
      const ct_not_ad = new Set([...markers].filter((m) => !nunexAD.has(m)));

      const a = overlapCt.size;
      const b = ad_not_ct.size;
      const c = ct_not_ad.size;
      const d = not_ad_not_ct.size;

      const p = fisherExactGreater(a, b, c, d);
      pvals.push(p);

      const pct = (a * 100) / Math.max(1, markers.size);
      const or = (a * d) / Math.max(1e-12, b * c);

      out.push({ cellType: ct, pctOverlap: pct, oddsRatio: or, pValue: p, pAdj: NaN });
    }

    const padj = benjaminiHochberg(pvals);
    return out.map((r, i) => ({ ...r, pAdj: padj[i] }));
  }, [ctMarkers, allExpressed, inAtlas, cellTypes]);

  /* ---------------- Plotly (keep fixed order top→bottom) ---------------- */
  const plot = useMemo(() => {
    if (rows.length === 0) return null;

    const x = rows.map((r) => r.pctOverlap);
    const y = rows.map((r) => r.cellType); // already in DEFAULT_ORDER
    const colors = rows.map((r) => PALETTE[r.cellType] || "#999");
    const texts = rows.map(
      (r) => `${r.pctOverlap.toFixed(1)}%${pToStars(r.pAdj) ? `<br>(${pToStars(r.pAdj)})` : ""}`
    );

    const trace: any = {
      type: "bar",
      orientation: "h",
      y,
      x,
      marker: { color: colors, opacity: 0.88 },
      text: texts,
      textposition: "inside",
      insidetextanchor: "end",
      hovertemplate:
        "%{y}<br>% overlap: %{x:.1f}%<br>p-adj: %{customdata:.3g}<extra></extra>",
      customdata: rows.map((r) => r.pAdj),
    };

    const layout: Partial<import("plotly.js").Layout> = {
      paper_bgcolor: "white",
      plot_bgcolor: "white",
      margin: { l: 170, r: 28, t: 8, b: 56 },
      xaxis: { title: { text: "% of reference miRs" }, ticks: "outside", ticklen: 4, rangemode: "tozero" },
      yaxis: { automargin: true, autorange: "reversed", categoryorder: "array", categoryarray: y },
      showlegend: false,
      height: 410,
    };

    return { data: [trace], layout };
  }, [rows]);

  return (
    // מרכז אמיתי + “זום” עדין מאוד (≈97%)
    <div className="w-full flex justify-center">
      <div
        className="w-full max-w-[1400px] px-6 py-10 mx-auto"
        style={{ transform: "scale(0.97)", transformOrigin: "top center" }}
      >
        {/* Back to main */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ← Back to main
          </Link>
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold text-center mb-4">
          Cell type enrichment in a list of miRs of interest
        </h1>

        {/* Intro text: slightly wide & small; centered */}
        <p className="text-[13px] sm:text-sm text-gray-700 leading-6 max-w-none mx-auto mt-3 text-center">
          This tool infers the cell type enrichment of a microRNA (miR) list using a reference-based
          deconvolution approach. It compares the user-provided miRs to a curated atlas of
          cell-type-specific miR markers and computes the fraction of markers detected for each cell type.
          To determine whether the observed overlap is greater than expected by chance, the tool applies a
          one-sided Fisher’s exact test for each cell type, followed by FDR correction. The output
          highlights the cell types whose marker miRs are significantly enriched in the input list.
        </p>
        <p className="text-[12px] sm:text-xs text-gray-600 mt-2 text-center">
          For more information, please refer to our preprint – Dubnov et al.,{" "}
          <a className="underline" href="https://www.biorxiv.org" target="_blank" rel="noreferrer">
            bioRxiv
          </a>
          , 2026.
        </p>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mt-6">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-2">Insert your list</label>
            <textarea
              className="w-full h-36 border rounded-lg p-3"
              placeholder="Paste miR IDs separated by commas, spaces, or new lines"
              value={textarea}
              onChange={(e) => setTextarea(e.target.value)}
            />
            {!!notInAtlas.length && (
              <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <div className="font-medium">Not expressed in the atlas:</div>
                <div className="break-words">{notInAtlas.join(", ")}</div>
              </div>
            )}
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm text-gray-600 mb-2">Example</label>
            <button
              type="button"
              className="w-full border rounded-lg px-4 py-2"
              onClick={() => setTextarea(exampleList.join("\n"))}
            >
              Load example list
            </button>
            <p className="text-xs text-gray-500 mt-2">
              This example list represents miRs, differentially expressed in Alzheimer&apos;s Disease
              postmortem brain samples (data from{" "}
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

{/* Plot */}
<div className="mt-8 border rounded-lg p-3 max-w-[900px] mx-auto">
  {plot ? (
    <Plot
      data={plot.data as any}
      layout={{
        ...(plot.layout as any),
        height: 320, // smaller height
        margin: { l: 150, r: 20, t: 8, b: 48 }, // slightly tighter margins
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%" }} // takes width from the capped container
      useResizeHandler
    />
  ) : (
    <div className="text-gray-500 p-6">Provide a list or click “Example”.</div>
  )}
</div>


        {/* Table */}
        <div className="mt-8">
          <div className="mb-2 text-gray-700"></div>
          <div className="overflow-x-auto rounded border">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-3 py-2">Cell type</th>
                  <th className="px-3 py-2">% overlap</th>
                  <th className="px-3 py-2">Odds ratio</th>
                  <th className="px-3 py-2">p-value</th>
                  <th className="px-3 py-2">p-adj</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.cellType} className="border-t">
                    <td className="px-3 py-2">{r.cellType}</td>
                    <td className="px-3 py-2">{r.pctOverlap.toFixed(1)}%</td>
                    <td className="px-3 py-2">
                      {Number.isFinite(r.oddsRatio) ? r.oddsRatio.toFixed(3) : "—"}
                    </td>
                    <td className="px-3 py-2">{r.pValue.toExponential(2)}</td>
                    <td className="px-3 py-2">
                      {r.pAdj < 0.001 ? r.pAdj.toExponential(2) : r.pAdj.toFixed(3)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr className="border-t">
                    <td className="px-3 py-4 text-gray-500" colSpan={5}>
                      No data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
