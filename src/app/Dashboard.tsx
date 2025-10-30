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
const DE_FILE = "/data/DE_dream_miRs_O_vs_all.csv";
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

/* ========================================================= */

export default function Dashboard() {
  const mirs = useMemo(() => normalizeMirList(mirListRaw), []);
  const [query, setQuery] = useState("");
  const [selectedMir, setSelectedMir] = useState<string>(mirs[0] ?? "");

  const [pcaRows, setPcaRows] = useState<PcaRow[]>([]);
  const [deRows, setDeRows] = useState<DeRow[]>([]);
  const [oligoRows, setOligoRows] = useState<any[]>([]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* --- Load CSVs --- */
  useEffect(() => {
    loadCsv<PcaRow>(PCA_CSV).then(setPcaRows).catch(console.error);

    loadCsv<DeRow>(DE_FILE)
      .then((rows) => {
        const fixed = rows.map((r: any) => {
          if (!r.miR) {
            const k =
              Object.keys(r).find((x) => x.toLowerCase().includes("mir")) ??
              Object.keys(r)[0];
            return { ...r, miR: String(r[k]) };
          }
          return r;
        }) as DeRow[];
        setDeRows(fixed);
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
    // If current selection isn't in filtered list → pick first
    if (!filteredOptions.includes(selectedMir)) {
      setSelectedMir(filteredOptions[0]);
      // If only one option remains and it's different → force it
    } else if (
      filteredOptions.length === 1 &&
      selectedMir !== filteredOptions[0]
    ) {
      setSelectedMir(filteredOptions[0]);
    }
  }, [filteredOptions, selectedMir]);

  /* --- Threshold check for TOP (3-cell) dataset: CPM>1 in ≥50% --- */
  const cpmOkTop = useMemo(() => {
    if (!pcaRows.length) return false;

    // בעמודת ה-PCA לכל דגימה יש עמודת CPM בשם ה-miR; אם אין – לא עומד בסף
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

  /* --- Stats + oligodendrocyte row for selected miR --- */
  const deRow = useMemo(
    () => deRows.find((r) => r.miR === selectedMir),
    [deRows, selectedMir]
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
        <h1 className="font-bold">Main Page (1)</h1>
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
            // Step 2: choosing from dropdown always sets selection and clears search
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

      {/* Top 3 charts (only if selected miR passes CPM threshold in 3-cell dataset) */}
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

      {/* First table + heading text */}
      <div className="mt-8">
        <p className="mb-3 text-gray-700">
          {`The table below summarizes the statistical comparison of cell type–specific profiles of ${selectedMir} across all pairwise combinations.`}
        </p>
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-3 py-2">miR</th>
                <th className="px-3 py-2">logFC</th>
                <th className="px-3 py-2">AveExpr</th>
                <th className="px-3 py-2">t</th>
                <th className="px-3 py-2">P.Value</th>
                <th className="px-3 py-2">adj.P.Val</th>
              </tr>
            </thead>
            <tbody>
              {deRow ? (
                <tr className="border-t">
                  <td className="px-3 py-2">{deRow.miR}</td>
                  <td className="px-3 py-2">{deRow.logFC}</td>
                  <td className="px-3 py-2">{deRow.AveExpr}</td>
                  <td className="px-3 py-2">{deRow.t}</td>
                  <td className="px-3 py-2">{deRow["P.Value"]}</td>
                  <td className="px-3 py-2">{deRow["adj.P.Val"]}</td>
                </tr>
              ) : (
                /* Informative message when miR didn't pass expression threshold for this comparison */
                <tr className="border-t">
                  <td className="px-3 py-3 bg-amber-50 text-amber-900" colSpan={6}>
                    {`${selectedMir} did not meet the expression threshold required for this statistical comparison (CPM > 1 in ≥ 50% of samples).`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Boxplot + stats section */}
      <div className="mt-10">
        <p className="mb-3 text-gray-700">
          {`The table below summarizes the statistical comparison of the oligodendrocyte profile of ${selectedMir} against all other cell types.`}
        </p>

        {oligoRows.length === 0 ? (
          <div className="rounded border p-4 text-gray-500">
            Loading oligodendrocyte counts…
          </div>
        ) : !oligoRow ? (
          /* Informative message when miR didn't pass expression threshold for this comparison */
          <div className="rounded border p-4 bg-amber-50 text-amber-900">
            {`${selectedMir} did not meet the expression threshold required for this statistical comparison (CPM > 1 in ≥ 50% of samples).`}
          </div>
        ) : (
          <MiniBoxWithStats mir={selectedMir} countsRow={oligoRow} stat={deRow} />
        )}
      </div>

      {/* Bottom "Main Page (1)" button */}
      {mounted && (
        <div className="flex justify-center mt-8 mb-2">
          <button
            type="button"
            className="px-4 py-1 rounded-full border shadow-sm bg-white"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Go to Main Page"
            suppressHydrationWarning
          >
            Main Page (1)
          </button>
        </div>
      )}
    </div>
  );
}
