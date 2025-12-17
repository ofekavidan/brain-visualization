"use client";

import { useState } from "react";

const DATA_BASE = "/data";

const FILES = [
  {
    title: "Raw_mir_counts.csv",
    filename: "Raw_mir_counts.csv",
    href: `${DATA_BASE}/Raw_mir_counts.csv`,
    description: "Raw aligned read counts for microRNAs (miRs).",
  },
  {
    title: "raw_counts_tRF_families.csv",
    filename: "raw_counts_tRF_families.csv",
    href: `${DATA_BASE}/raw_counts_tRF_families.csv`,
    description: "Raw aligned read counts for tRF families.",
  },
  {
    title: "Sample_metadata.csv",
    filename: "Sample_metadata.csv",
    href: `${DATA_BASE}/Sample_metadata.csv`,
    description: "Sample metadata table for the atlas datasets.",
  },
] as const;

async function downloadAsFile(url: string, filename: string) {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`File not found (${res.status}).`);
  }

  const contentType = res.headers.get("content-type") || "";
  // If Next/Vercel returns an HTML page (404/app shell), prevent saving it as a "csv"
  if (contentType.includes("text/html")) {
    throw new Error(
      "The server returned HTML instead of a CSV. This usually means the file is missing (or the filename casing doesn't match)."
    );
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename; // force .csv name
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.URL.revokeObjectURL(blobUrl);
}

export default function DownloadsClient() {
  const [downloading, setDownloading] = useState<string | null>(null);

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-[1400px] px-6 py-10 mx-auto">
        <h1 className="text-4xl sm:text-5xl font-semibold text-center mb-4">
          Downloads
        </h1>

        <p className="text-base sm:text-lg text-gray-700 leading-7 max-w-[1100px] mx-auto mt-3 text-center">
          Here we provide the raw aligned reads for microRNAs and for tRF families,
          along with the sample metadata table.
        </p>

        <div className="mt-10 max-w-[900px] mx-auto grid grid-cols-1 gap-4">
          {FILES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border bg-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div>
                <div className="font-semibold text-gray-900">{f.title}</div>
                <div className="text-sm text-gray-600">{f.description}</div>
              </div>

              <button
                type="button"
                className="inline-flex justify-center rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                disabled={downloading === f.title}
                onClick={async () => {
                  try {
                    setDownloading(f.title);
                    await downloadAsFile(f.href, f.filename);
                  } catch (e: any) {
                    console.error(e);
                    alert(
                      `Download failed for ${f.filename}.\n\n${e?.message ?? "Unknown error"}`
                    );
                  } finally {
                    setDownloading(null);
                  }
                }}
              >
                {downloading === f.title ? "Downloading…" : "Download"}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-[900px] mx-auto text-xs text-gray-500">
          If a download opens in the browser instead of saving, right-click → “Save link as…”.
        </div>
      </div>
    </div>
  );
}
