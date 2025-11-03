// src/app/Dashboard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

import PcaPlot from "./PcaPlot";
import UmapPlot from "./UmapPlot";
import BoxPlot from "./BoxPlot";
import MiniBoxWithStats from "./MiniBoxWithStats";

import mirListRaw from "../data/mir_list.json";

/* ---------- Public data files (public/data) ---------- */
const PCA_CSV = "/data/mirs_pca_counts_df.csv";

/* DE for the 3 pairwise comparisons (table #1) */
const DE_N_A = "/data/DE_dream_miRs_N_A.csv"; // Neurons vs Astrocytes
const DE_N_M = "/data/DE_dream_miRs_N_M.csv"; // Neurons vs Microglia
const DE_M_A = "/data/DE_dream_miRs_M_A.csv"; // Microglia vs Astrocytes

/* DE for Oligodendrocyte vs All (box+stats section #2) */
const DE_OLIGO_VS_ALL = "/data/DE_dream_miRs_O_vs_all.csv";

/* Counts per sample for the mini-boxplot */
const OLIGO_COUNTS = "/data/mirs_oligos_counts.csv";

/* ---------- Types ---------- */
export type PcaRow = {
  [key: string]: string | number;
  "PC 1": number;
  "PC 2": number;
  "Cell type": "Neurons" | "Astrocytes" | "Microglia" | string;
};

export type DeRow = {
  miR: string;
  logFC: number;
  AveExpr: number;
  t: number;
  "P.Value": number;
  "adj.P.Val": number;
  [k: string]: string | number;
};

/* ---------- Helpers ---------- */
const nf3 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const fmt3 = (v: number | string) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? nf3.format(n) : String(v ?? "");
};

function normalizeMirList(raw: any): string[] {
  if (Array.isArray(raw)) {
    if (raw.length > 0 && typeof raw[0] === "object") {
      return (raw as any[]).map((x) =>
        String((x as any).miR ?? (x as any).value ?? (x as any).label ?? x)
      );
    }
    return raw.map(String);
  }
  if (raw && Array.isArray((raw as any).mirs)) {
    return (raw as any).mirs.map(String);
  }
  return [];
}

function loadCsv<T = any>(path: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(path, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data as T[]),
      error: (err) => reject(err),
    });
  });
}

function normalizeDeRows(rows: any[]): DeRow[] {
  return rows.map((r: any) => {
    if (r.miR) return r as DeRow;
    const k =
      Object.keys(r).find((x) => x.toLowerCase().includes("mir")) ??
      Object.keys(r)[0];
    return { ...r, miR: String(r[k]) } as DeRow;
  });
}

/* ========================================================= */

export default function Dashboard() {
  const mirs = useMemo(() => normalizeMirList(mirListRaw), []);
  const [query, setQuery] = useState("");
  const [selectedMir, setSelectedMir] = useState<string>(mirs[0] ?? "");

  const [pcaRows, setPcaRows] = useState<PcaRow[]>([]);
  const [deNA, setDeNA] = useState<DeRow[]>([]);
  const [deNM, setDeNM] = useState<DeRow[]>([]);
  const [deMA, setDeMA] = useState<DeRow[]>([]);
  const [deOligoAll, setDeOligoAll] = useState<DeRow[]>([]);
  const [oligoRows, setOligoRows] = useState<any[]>([]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* --- Load CSVs --- */
  useEffect(() => {
    loadCsv<PcaRow>(PCA_CSV).then(setPcaRows).catch(console.error);

    Promise.all([
      loadCsv<DeRow>(DE_N_A),
      loadCsv<DeRow>(DE_N_M),
      loadCsv<DeRow>(DE_M_A),
      loadCsv<DeRow>(DE_OLIGO_VS_ALL),
    ])
      .then(([na, nm, ma, oo]) => {
        setDeNA(normalizeDeRows(na));
        setDeNM(normalizeDeRows(nm));
        setDeMA(normalizeDeRows(ma));
        setDeOligoAll(normalizeDeRows(oo));
      })
      .catch(console.error);

    loadCsv<any>(OLIGO_COUNTS).then(setOligoRows).catch(console.error);
  }, []);

  /* --- Filter options by search --- */
  const filteredOptions = useMemo(() => {
    if (!query.trim()) return mirs;
    const q = query.toLowerCase();
    return mirs.filter((m) => m.toLowerCase().includes(q));
  }, [mirs, query]);

  /* --- Step 1: keep selected in-sync with filtered options --- */
  useEffect(() => {
    if (!filteredOptions.length) return;
    if (!filteredOptions.includes(selectedMir)) {
      setSelectedMir(filteredOptions[0]);
    } else if (filteredOptions.length === 1 && selectedMir !== filteredOptions[0]) {
      setSelectedMir(filteredOptions[0]);
    }
  }, [filteredOptions, selectedMir]);

  /* --- Threshold check for TOP (3-cell) dataset: CPM>1 in ≥50% --- */
  const cpmOkTop = useMemo(() => {
    if (!pcaRows.length || !selectedMir) return false;
    const hasCol =
      pcaRows.length > 0 &&
      Object.prototype.hasOwnProperty.call(pcaRows[0], selectedMir);
    if (!hasCol) return false;
    const n = pcaRows.length;
    let cnt = 0;
    for (const r of pcaRows) {
      const v = Number((r as any)[selectedMir]);
      if (!Number.isNaN(v) && v > 1) cnt++;
    }
    return cnt / n >= 0.5;
  }, [pcaRows, selectedMir]);

  /* --- Table #1 rows: three pairwise comparisons --- */
  const pairRows = useMemo(() => {
    const find = (rows: DeRow[], mir: string) => rows.find((r) => r.miR === mir);
    return [
      { cmp: "Neurons vs Astrocytes", row: find(deNA, selectedMir) },
      { cmp: "Neurons vs Microglia", row: find(deNM, selectedMir) },
      { cmp: "Astrocytes vs Microglia", row: find(deMA, selectedMir) },
    ] as Array<{ cmp: string; row?: DeRow }>;
  }, [deNA, deNM, deMA, selectedMir]);

  /* --- Box+stats section: Oligodendrocyte vs All --- */
  const deOligoRow = useMemo(
    () => deOligoAll.find((r) => r.miR === selectedMir),
    [deOligoAll, selectedMir]
  );

  const oligoRow = useMemo(() => {
    if (!oligoRows.length) return undefined;
    const nameKey =
      Object.keys(oligoRows[0]).find((k) => k.toLowerCase().includes("mir")) ??
      Object.keys(oligoRows[0])[0];
    return oligoRows.find((r) => String(r[nameKey]) === selectedMir);
  }, [oligoRows, selectedMir]);

  /* --- Render --- */
  return (
    <div className="app-text zoom-80 mx-auto max-w-[1400px] px-6 py-8">
      {/* Top header text only */}
      <header className="flex justify-center mb-4">
        <h1 className="font-bold"> The Live Human Brain MicroRNA&nbsp;Atlas </h1>
      </header>

      {/* Search + combo */}
      <div className="flex gap-4 items-center mb-6">
        <input
          className="border rounded px-3 py-2 w-[420px]"
          placeholder="Search a miRNA"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          suppressHydrationWarning
        />
        <select
          className="border rounded px-3 py-2 w-[420px]"
          value={selectedMir}
          onChange={(e) => {
            setSelectedMir(e.target.value);
            setQuery("");
          }}
          suppressHydrationWarning
        >
          {filteredOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Top 3 charts */}
      {cpmOkTop ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="border rounded-lg p-3">
            <PcaPlot data={pcaRows} pc1Var={56.2} pc2Var={34.2} />
          </div>

          <div className="border rounded-lg p-3">
            <UmapPlot
              title={selectedMir}
              data={pcaRows}
              mir={selectedMir}
              pc1Var={56.2}
              pc2Var={34.2}
            />
          </div>

          <div className="border rounded-lg p-3">
            <BoxPlot
              title={selectedMir}
              data={pcaRows}
              mir={selectedMir}
              colors={{
                neurons: "#E64B35",
                astro: "#4DBBD5",
                micro: "#00A087",
              }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded border bg-amber-50 text-amber-900 px-4 py-3">
          {`${selectedMir} did not meet the expression threshold required for this statistical comparison (CPM > 1 in ≥ 50% of samples).`}
        </div>
      )}

      {/* ===== Table #1: THREE pairwise comparisons (N↔A, N↔M, A↔M) ===== */}
      <div className="mt-8">
        <p className="mb-3 text-gray-700">
          {`The table below summarizes the statistical comparison of cell type–specific profiles of ${selectedMir} across the three pairwise combinations.`}
        </p>
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-3 py-2">Comparison</th>
                <th className="px-3 py-2">logFC</th>
                <th className="px-3 py-2">AveExpr</th>
                <th className="px-3 py-2">t</th>
                <th className="px-3 py-2">P.Value</th>
                <th className="px-3 py-2">adj.P.Val</th>
              </tr>
            </thead>
            <tbody>
              {pairRows.map(({ cmp, row }) =>
                row ? (
                  <tr key={cmp} className="border-t">
                    <td className="px-3 py-2">{cmp}</td>
                    <td className="px-3 py-2">{fmt3(row.logFC)}</td>
                    <td className="px-3 py-2">{fmt3(row.AveExpr)}</td>
                    <td className="px-3 py-2">{fmt3(row.t)}</td>
                    <td className="px-3 py-2">{fmt3(row["P.Value"])}</td>
                    <td className="px-3 py-2">{fmt3(row["adj.P.Val"])}</td>
                  </tr>
                ) : (
                  <tr key={cmp} className="border-t">
                    <td className="px-3 py-3 bg-amber-50 text-amber-900" colSpan={6}>
                      {`${cmp}: ${selectedMir} did not meet the expression threshold required for this comparison (CPM > 1 in ≥ 50% of samples).`}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Boxplot + stats: Oligodendrocyte vs All ===== */}
      <div className="mt-10">
        <p className="mb-3 text-gray-700">
          {`The table below summarizes the statistical comparison of the oligodendrocyte profile of ${selectedMir} against all other cell types.`}
        </p>

        {oligoRows.length === 0 ? (
          <div className="rounded border p-4 text-gray-500">
            Loading oligodendrocyte counts…
          </div>
        ) : !oligoRow ? (
          <div className="rounded border p-4 bg-amber-50 text-amber-900">
            {`${selectedMir} did not meet the expression threshold required for this statistical comparison (CPM > 1 in ≥ 50% of samples).`}
          </div>
        ) : (
          <MiniBoxWithStats mir={selectedMir} countsRow={oligoRow} stat={deOligoRow} />
        )}
      </div>

      {/* Bottom "Main Page (1)" button */}
      {mounted && (
  <div className="flex justify-center mt-8 mb-2">
    <button
      type="button"
      className="px-4 py-1 rounded-full border shadow-sm bg-white"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Go to top"
      suppressHydrationWarning
    >
      Main Page (1)
    </button>
  </div>
)}

    </div>
  );
}
