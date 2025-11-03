// src/app/components/StatsTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

type Row = Record<string, string | number>;

type Props = {
  /** Public URL to the CSV, e.g. "/stat_tables/stats_hsa-let-7a-3p.csv" */
  csvUrl: string;
  /** Optional: explicit columns order. If omitted, uses CSV header order. */
  columnsOrder?: string[];
  /** Optional: columns to force rounding to 3 decimals (defaults to all numeric). */
  roundColumns?: string[];
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

function isFiniteNumber(v: unknown): v is number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n);
}

function formatCell(value: unknown, shouldRound: boolean): string {
  if (!shouldRound) return String(value ?? "");
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return numberFormatter.format(n);
}

export default function StatsTable({ csvUrl, columnsOrder, roundColumns }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      dynamicTyping: true, // parse numbers automatically
      skipEmptyLines: true,
      complete: (res) => {
        const data = (res.data as Row[]) ?? [];
        setRows(data);
        const csvHeaders = res.meta.fields ?? Object.keys(data[0] ?? {});
        setHeaders(columnsOrder && columnsOrder.length ? columnsOrder : csvHeaders);
      },
      error: (err) => setError(err.message || "Failed to load CSV"),
    });
  }, [csvUrl, columnsOrder]);

  const columnsNeedingRounding = useMemo(() => {
    // By default: round ALL numeric columns we detect in the first row.
    if (roundColumns && roundColumns.length) return new Set(roundColumns);
    const s = new Set<string>();
    const sample = rows[0] ?? {};
    headers.forEach((h) => {
      if (isFiniteNumber(sample[h])) s.add(h);
    });
    return s;
  }, [rows, headers, roundColumns]);

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }
  if (!rows.length) {
    return <div>Loading table…</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold text-gray-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className={idx % 2 ? "bg-white" : "bg-gray-50/40"}>
              {headers.map((h) => {
                const val = r[h];
                const shouldRound = columnsNeedingRounding.has(h);
                return (
                  <td key={h} className="px-4 py-2 whitespace-nowrap">
                    {formatCell(val, shouldRound)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
