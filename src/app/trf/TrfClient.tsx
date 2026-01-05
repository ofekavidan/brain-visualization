// src/app/trf/TrfClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Papa from "papaparse";
import type { Data, Layout } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });
const PREPRINT_URL =
  "https://www.biorxiv.org/content/10.64898/2026.01.04.697535v1";

type TrfRow = Record<string, string | number>;
type StatRow = Record<string, string | number>;

const DATA_BASE = "/data";
const TRF_DATA_CSV = `${DATA_BASE}/tRF_data.csv`;
const TRF_STATS_CSV = `${DATA_BASE}/stat_df_tRF_families.csv`;
const TRF_FIG_URL = `${DATA_BASE}/tRF%20families.png`; // "tRF families.png" with space

const PC1_VAR = 14.8;
const PC2_VAR = 9.8;

const CELL_TYPES = ["Neurons", "Astrocytes", "Microglia"] as const;
const COLORS: Record<(typeof CELL_TYPES)[number], string> = {
  Neurons: "#E64B35",
  Astrocytes: "#4DBBD5",
  Microglia: "#00A087",
};

const ORIGINS = ["Nuc", "MT"] as const;

const AMINO_ACIDS = [
  "Ala",
  "Cys",
  "Asp",
  "Glu",
  "Phe",
  "Gly",
  "His",
  "Ile",
  "Lys",
  "Leu",
  "Met",
  "Asn",
  "Pro",
  "Gln",
  "Arg",
  "Ser",
  "Thr",
  "Val",
  "Trp",
  "Tyr",
] as const;

const CLEAVAGE_TYPES = ["5'-tRF", "5'-half", "3'-tRF", "3'-half"] as const;

function loadCSV<T extends Record<string, any>>(csvUrl: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (res) => resolve((res.data as T[]) ?? []),
      error: (err) => reject(err),
    });
  });
}

function finiteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const nf3 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

function fmtCell(value: unknown, key?: string) {
  if (value === null || value === undefined) return "";
  const k = (key ?? "").toLowerCase();

  const n = finiteNumber(value);
  if (n !== null) {
    // p-values formatting
    if (
      k.includes("p") &&
      (k.includes("adj") ||
        k.includes("padj") ||
        k.includes("pvalue") ||
        k.includes("p.value") ||
        k.includes("adj.p.val"))
    ) {
      return n < 0.001 ? n.toExponential(3) : nf3.format(n);
    }
    return nf3.format(n);
  }
  return String(value);
}

function looksLikeBadHeader(h: string) {
  const t = (h ?? "").trim();
  if (!t) return true;
  const low = t.toLowerCase();
  if (low.startsWith("unnamed")) return true;
  if (low === "index") return true;
  return false;
}

function normalizeKey(k: string) {
  return (k ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .replace(/-/g, "")
    .replace(/\./g, "");
}

function findKey(keys: string[], candidates: string[]) {
  const normCands = candidates.map(normalizeKey);
  return keys.find((k) => normCands.includes(normalizeKey(k))) ?? null;
}

/** ✅ added: sample-id helpers (only for hover) */
function pickSampleKey(row: Record<string, unknown>): string | null {
  const keys = Object.keys(row);
  const candidates = [
    "Unnamed: 0",
    "Unnamed:0",
    "Sample",
    "sample",
    "Sample ID",
    "sample_id",
    "id",
    "ID",
    "Index",
    "index",
  ];

  for (const c of candidates) {
    const exact = keys.find((k) => k === c);
    if (exact) return exact;
  }

  const unnamed = keys.find((k) => k.toLowerCase().startsWith("unnamed"));
  if (unnamed) return unnamed;

  return null;
}

function sampleLabelFromRow(row: Record<string, unknown>): string {
  const k = pickSampleKey(row);
  const raw = k ? String((row as any)[k] ?? "") : "";
  if (!raw) return "";

  // Example: "HU44_GFAP" -> "HU44"
  const short = raw.split("_")[0]?.trim() ?? raw.trim();
  return short || raw.trim();
}

export default function TrfClient() {
  const [trfData, setTrfData] = useState<TrfRow[] | null>(null);
  const [statTable, setStatTable] = useState<StatRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // defaults
  const [origin, setOrigin] = useState<(typeof ORIGINS)[number]>("Nuc");
  const [aminoAcid, setAminoAcid] =
    useState<(typeof AMINO_ACIDS)[number]>("Lys");
  const [cleavageType, setCleavageType] =
    useState<(typeof CLEAVAGE_TYPES)[number]>("5'-half");

  useEffect(() => {
    setError(null);
    (async () => {
      const [d, s] = await Promise.all([
        loadCSV<TrfRow>(TRF_DATA_CSV),
        loadCSV<StatRow>(TRF_STATS_CSV),
      ]);
      setTrfData(d);
      setStatTable(s);
    })().catch((e) => {
      console.error(e);
      setError("Failed to load tRF data.");
    });
  }, []);

  const AMINO_ACIDS_SORTED = useMemo(() => {
    return [...AMINO_ACIDS].slice().sort((a, b) => a.localeCompare(b));
  }, []);

  const trfOfInterest = useMemo(
    () => `${origin}-${aminoAcid}-${cleavageType}`,
    [origin, aminoAcid, cleavageType]
  );

  const readmeTop =
    "We analyzed tRFs at the family level, defined by their genome of origin (nuclear or mitochondrial), the amino acid identity of the parent tRNA, and the cleavage type. Specifically, 5′ (3′) tRNA halves span the parent tRNA from the 5′ (3′) end to the anticodon loop, whereas 5′ (3′) tRFs originate at the 5′ (3′) end and terminate elsewhere.";

  const readmeNearPlots = useMemo(
    () =>
      "Select the tRNA fragment (tRF) family of interest by choosing the genome origin (Nuc - Nuclear; MT - Mitochondrial), the amino acid associated with the tRNA-of-origin, and the cleavage type.",
    []
  );

  const readmeAboveStats = useMemo(
    () =>
      `The table below summarizes the statistical comparison of cell-type–specific profiles of ${trfOfInterest} across all pairwise combinations.`,
    [trfOfInterest]
  );

  const availableFamilyColumns = useMemo(() => {
    if (!trfData || trfData.length === 0) return [];
    const sample = trfData[0];
    const keys = Object.keys(sample);
    return keys.filter(
      (k) =>
        k.includes("-") &&
        k !== "PC 1" &&
        k !== "PC 2" &&
        k !== "Cell Type" &&
        k !== "Cell type"
    );
  }, [trfData]);

  const familyExists = useMemo(
    () => availableFamilyColumns.includes(trfOfInterest),
    [availableFamilyColumns, trfOfInterest]
  );

  const squareRanges = useMemo(() => {
    if (!trfData || trfData.length === 0) return null;
    const xs = trfData.map((r) => Number(r["PC 1"]));
    const ys = trfData.map((r) => Number(r["PC 2"]));
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const span = Math.max(maxX - minX, maxY - minY);
    const pad = span * 0.08;
    const half = span / 2 + pad;
    return {
      xRange: [cx - half, cx + half] as [number, number],
      yRange: [cy - half, cy + half] as [number, number],
    };
  }, [trfData]);

  const cellTypePlot = useMemo(() => {
    if (!trfData || trfData.length === 0 || !squareRanges) return null;

    const LEGEND_GUTTER = 0.29;

    const traces: Partial<Data>[] = CELL_TYPES.map((ct) => {
      const subset = trfData.filter(
        (r) => String(r["Cell Type"] ?? r["Cell type"]) === ct
      );
      return {
        type: "scattergl",
        mode: "markers",
        name: ct,
        x: subset.map((r) => Number(r["PC 1"])),
        y: subset.map((r) => Number(r["PC 2"])),

        // ✅ added: sample id for hover
        text: subset.map((r) => sampleLabelFromRow(r as any)),

        marker: { size: 10, color: COLORS[ct], opacity: 0.9 },

        // ✅ updated only: hover now includes sample id
        hovertemplate:
          "Sample: %{text}<br>PC1: %{x:.2f}<br>PC2: %{y:.2f}<extra></extra>",
      };
    });

    const layout: Partial<Layout> = {
      paper_bgcolor: "white",
      plot_bgcolor: "white",
      margin: { l: 70, r: 48, t: 40, b: 70 },
      xaxis: {
        title: { text: `PC 1 (${PC1_VAR}%)` },
        zeroline: false,
        showline: true,
        mirror: true,
        ticks: "outside",
        ticklen: 5,
        range: squareRanges.xRange,
        constrain: "range",
        domain: [0, 1 - LEGEND_GUTTER],
      },
      yaxis: {
        title: { text: `PC 2 (${PC2_VAR}%)` },
        zeroline: false,
        showline: true,
        mirror: true,
        ticks: "outside",
        ticklen: 5,
        range: squareRanges.yRange,
        scaleanchor: "x",
        scaleratio: 1,
        constrain: "range",
      },
      legend: {
        orientation: "v",
        x: 1 - LEGEND_GUTTER / 2 + 0.05,
        xanchor: "center",
        y: 1,
        yanchor: "top",
        bgcolor: "rgba(255,255,255,0.9)",
        bordercolor: "rgba(0,0,0,0)",
        font: { size: 15 },
      },
      height: 360,
    };

    return { data: traces, layout };
  }, [trfData, squareRanges]);

  const intensityPlot = useMemo(() => {
    if (!trfData || trfData.length === 0 || !squareRanges) return null;

    const x = trfData.map((r) => Number(r["PC 1"]));
    const y = trfData.map((r) => Number(r["PC 2"]));
    const z = trfData.map((r) => Number((r as any)[trfOfInterest] ?? 0));

    // ✅ added: sample id for hover
    const text = trfData.map((r) => sampleLabelFromRow(r as any));

    const trace: Partial<Data> = {
      type: "scattergl",
      mode: "markers",
      x,
      y,

      // ✅ added
      text,

      marker: {
        size: 10,
        opacity: 0.85,
        color: z,
        colorscale: "RdBu",
        reversescale: false,
        showscale: true,
        colorbar: {
          title: { text: "log(counts)" },
          thickness: 18,
          outlinewidth: 0,
        },
      },

      // ✅ updated only: hover now includes sample id
      hovertemplate:
        "Sample: %{text}<br>PC1: %{x:.2f}<br>PC2: %{y:.2f}<br>log: %{marker.color:.2f}<extra></extra>",
    };

    const layout: Partial<Layout> = {
      paper_bgcolor: "white",
      plot_bgcolor: "white",
      margin: { l: 70, r: 50, t: 40, b: 70 },
      title: { text: trfOfInterest },
      xaxis: {
        title: { text: `PC 1 (${PC1_VAR}%)` },
        zeroline: false,
        showline: true,
        mirror: true,
        ticks: "outside",
        ticklen: 5,
        range: squareRanges.xRange,
        constrain: "range",
      },
      yaxis: {
        title: { text: `PC 2 (${PC2_VAR}%)` },
        zeroline: false,
        showline: true,
        mirror: true,
        ticks: "outside",
        ticklen: 5,
        range: squareRanges.yRange,
        scaleanchor: "x",
        scaleratio: 1,
        constrain: "range",
      },
      height: 360,
    };

    return { data: [trace], layout };
  }, [trfData, squareRanges, trfOfInterest]);

  const boxPlot = useMemo(() => {
    if (!trfData || trfData.length === 0) return null;

    const groupVals: Record<string, number[]> = {
      Neurons: [],
      Astrocytes: [],
      Microglia: [],
    };

    // ✅ added: parallel texts per group (sample id for hover)
    const groupTexts: Record<string, string[]> = {
      Neurons: [],
      Astrocytes: [],
      Microglia: [],
    };

    for (const r of trfData) {
      const ct = String(r["Cell Type"] ?? r["Cell type"]);
      const v = finiteNumber((r as any)[trfOfInterest]);
      if (v === null) continue;

      if (ct in groupVals) {
        groupVals[ct].push(v);

        // ✅ added
        groupTexts[ct].push(sampleLabelFromRow(r as any));
      }
    }

    const traces: Partial<Data>[] = CELL_TYPES.map((ct) => ({
      type: "box",
      name: ct,
      y: groupVals[ct],

      // ✅ added
      text: groupTexts[ct],

      marker: { color: COLORS[ct], size: 6 },
      line: { color: COLORS[ct], width: 3 },
      fillcolor: "rgba(0,0,0,0)",
      boxpoints: "all",
      jitter: 0.25,
      pointpos: 0,
      showlegend: false,

      // ✅ updated only: hover now includes sample id
      hovertemplate:
        "Sample: %{text}<br>log(CPM): %{y:.2f}<extra></extra>",
    }));

    const layout: Partial<Layout> = {
      paper_bgcolor: "white",
      plot_bgcolor: "white",
      title: { text: trfOfInterest },
      margin: { l: 70, r: 20, t: 50, b: 120 },
      xaxis: { automargin: true, tickangle: -30 },
      yaxis: {
        title: { text: "log(CPM)" },
        zeroline: false,
        showline: true,
        mirror: true,
        ticks: "outside",
        ticklen: 5,
      },
      height: 360,
    };

    return { data: traces, layout };
  }, [trfData, trfOfInterest]);

  const statsForFamily = useMemo(() => {
    if (!statTable) return [];

    const first = statTable[0];
    if (!first) return [];
    const keys = Object.keys(first);

    const familyKey =
      keys.find((k) => k.toLowerCase() === "family") ??
      keys.find((k) => k.toLowerCase().includes("family")) ??
      "Family";

    const filtered = statTable.filter(
      (r) => String(r[familyKey] ?? "") === trfOfInterest
    );

    const padjKey =
      keys.find((k) => k.toLowerCase() === "padj") ??
      keys.find((k) => k.toLowerCase().includes("adj")) ??
      "Padj";

    filtered.sort((a, b) => {
      const pa = finiteNumber(a[padjKey]) ?? Infinity;
      const pb = finiteNumber(b[padjKey]) ?? Infinity;
      return pa - pb;
    });

    return filtered;
  }, [statTable, trfOfInterest]);

  // ✅ columns: order + aliasing exactly as requested
  const statsColumns = useMemo(() => {
    const first = statsForFamily[0];
    const keys = first
      ? Object.keys(first).filter((k) => !looksLikeBadHeader(k))
      : [];

    const comparisonKey =
      keys.find((k) => normalizeKey(k) === "comparison") ?? "Comparison";

    const statKey =
      keys.find((k) => normalizeKey(k) === "stat") ??
      keys.find((k) => normalizeKey(k) === "t") ??
      "Stat";

    const logfcKey =
      keys.find((k) => normalizeKey(k) === "logfc") ??
      keys.find((k) => normalizeKey(k) === "log2foldchange") ?? // <- your CSV
      "log2FoldChange";

    const pvalueKey =
      keys.find((k) => normalizeKey(k) === "pvalue") ?? // <- your CSV
      keys.find((k) => normalizeKey(k) === "pvalue") ??
      "Pvalue";

    const padjKey =
      keys.find((k) => normalizeKey(k) === "adjpval") ??
      keys.find((k) => normalizeKey(k) === "padj") ?? // <- your CSV
      "Padj";

    // display labels are EXACTLY what you asked for
    return [
      { label: "Comparison", key: comparisonKey },
      { label: "Stat", key: statKey },
      { label: "logFC", key: logfcKey },
      { label: "P.Value", key: pvalueKey },
      { label: "adj.P.Val", key: padjKey },
    ] as const;
  }, [statsForFamily]);

  if (error) {
    return (
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[1400px] px-6 py-10 mx-auto">
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  if (!trfData || !statTable) {
    return (
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[1400px] px-6 py-10 mx-auto text-gray-500">
          Loading tRF atlas…
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[1400px] px-6 py-10 mx-auto">
        {/* Title */}
        <h1 className="text-4xl sm:text-5xl font-semibold text-center mb-6">
          The Human Brain Atlas of tRNA fragments (tRFs)
        </h1>

        {/* Figure + README */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 flex flex-col items-center">
            <img
              src={TRF_FIG_URL}
              alt="tRF families"
              className="max-w-full h-auto rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-2">Created with BioRender.com</p>
          </div>

          <div className="lg:col-span-6">
  <p className="text-base sm:text-lg text-gray-700 leading-7">
    {readmeTop}
  </p>

  <p className="text-base sm:text-lg text-gray-700 leading-7 mt-2">
    For additional details and citation, please refer to our preprint:{" "}
    <a
      className="underline"
      href={PREPRINT_URL}
      target="_blank"
      rel="noreferrer"
    >
      Dubnov et al., 2026
    </a>
    .
  </p>
</div>

        </div>

        {/* Selector README */}
        <p className="text-base sm:text-lg text-gray-700 leading-7 max-w-[1100px] mx-auto mt-10 text-center">
          {readmeNearPlots}
        </p>

        {/* 3 selection boxes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 max-w-[1100px] mx-auto">
          <div className="w-full">
            <label className="block text-sm text-gray-600 mb-2">
              Select the origin
            </label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={origin}
              onChange={(e) => setOrigin(e.target.value as any)}
            >
              {ORIGINS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full">
            <label className="block text-sm text-gray-600 mb-2">
              Select the amino acid
            </label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={aminoAcid}
              onChange={(e) => setAminoAcid(e.target.value as any)}
            >
              {AMINO_ACIDS_SORTED.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full">
            <label className="block text-sm text-gray-600 mb-2">
              Select the cleavage type
            </label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={cleavageType}
              onChange={(e) => setCleavageType(e.target.value as any)}
            >
              {CLEAVAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!familyExists && (
          <div className="mt-4 max-w-[1100px] mx-auto text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
            The selected family was not expressed in our dataset
          </div>
        )}

        {/* 3 plots row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-10">
          <div className="rounded-xl border bg-white p-3">
            {cellTypePlot ? (
              <Plot
                data={cellTypePlot.data as any}
                layout={cellTypePlot.layout as any}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%" }}
                useResizeHandler
              />
            ) : (
              <div className="text-gray-500 p-6">Loading plot…</div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-3">
            {intensityPlot ? (
              <Plot
                data={intensityPlot.data as any}
                layout={intensityPlot.layout as any}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%" }}
                useResizeHandler
              />
            ) : (
              <div className="text-gray-500 p-6">Loading plot…</div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-3">
            {boxPlot ? (
              <Plot
                data={boxPlot.data as any}
                layout={boxPlot.layout as any}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: "100%" }}
                useResizeHandler
              />
            ) : (
              <div className="text-gray-500 p-6">Loading plot…</div>
            )}
          </div>
        </div>

        {/* README above stats */}
        <p className="text-base sm:text-lg text-gray-700 leading-7 max-w-[1100px] mx-auto mt-12 text-center">
          {readmeAboveStats}
        </p>

        {/* Stats table */}
<div className="mt-6 overflow-x-auto rounded border">
  <table className="min-w-full !text-xl">
            <thead className="bg-gray-50">
              <tr className="text-left">
                {statsColumns.map((c) => (
                  <th key={c.label} className="px-3 py-2">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {statsForFamily.map((r, idx) => (
                <tr key={idx} className="border-t">
                  {statsColumns.map((c) => (
                    <td key={c.label} className="px-3 py-2 whitespace-nowrap">
                      {fmtCell((r as any)[c.key], c.label)}
                    </td>
                  ))}
                </tr>
              ))}

              {statsForFamily.length === 0 && (
                <tr className="border-t">
                  <td
                    className="px-3 py-4 text-gray-500"
                    colSpan={statsColumns.length}
                  >
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
