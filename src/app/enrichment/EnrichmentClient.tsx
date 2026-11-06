"use client";

import { useMemo, useState } from "react";
import referenceJson from "@/data/bactman_reference.json";
import {
  runEnrichment,
  type BactmanReference,
  type Level,
} from "@/lib/bactmanEnrichment";
import { EnrichmentDotPlot, MarkerStarPlot } from "./EnrichmentPlots";

const reference = referenceJson as BactmanReference;
const EXAMPLE = Object.entries(reference.example_lists);

const TEXT_STYLE: React.CSSProperties = {
  fontSize: "16px",
  lineHeight: "1.5",
  fontWeight: 400,
};

function exampleLists() {
  return [0, 1].map((i) => ({
    label: EXAMPLE[i]?.[0] ?? `List ${i + 1}`,
    text: EXAMPLE[i]?.[1] ?? "",
  }));
}

function fmtP(p: number) {
  if (!Number.isFinite(p)) return "—";
  return p < 0.001 ? p.toExponential(2) : p.toFixed(4);
}

export default function EnrichmentClient() {
  const [lists, setLists] = useState(exampleLists);
  const [level, setLevel] = useState<Level>("mature");

  const result = useMemo(
    () => runEnrichment(reference, lists, level),
    [lists, level]
  );

  const hasStars = result.lists.some((label) => (result.enriched[label] ?? []).length > 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex justify-center mb-4">
        <h1 className="text-4xl sm:text-5xl font-semibold text-center mb-6">
          Cell type enrichment in lists of miRs of interest
        </h1>
      </div>

      <p className="text-gray-700" style={TEXT_STYLE}>
        Each list is tested separately against the BACTMan cell-type markers
        (neurons, astrocytes, microglia, and oligodendrocytes). A one-sided
        Fisher’s exact test asks whether the list contains more markers of a
        cell type than expected from the BACTMan background, and P values are
        adjusted across the four cell types. A cell type is enriched when the
        adjusted P value is below 0.05. The dot plot shows the Haldane–Anscombe
        odds ratio. The star plot shows the miRNAs from each list that are
        markers of a cell type enriched in that list.
      </p>

      <p className="text-gray-700 mt-2" style={TEXT_STYLE}>
        For additional details and citation, please refer to our preprint:{" "}
        <a
          className="underline"
          href="https://www.biorxiv.org/content/10.64898/2026.01.04.697535v1"
          target="_blank"
          rel="noreferrer"
        >
          Dubnov et al., 2026
        </a>
        .
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-gray-700" style={TEXT_STYLE}>
          Level
        </span>
        {(["mature", "precursor"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLevel(option)}
            className={[
              "rounded-full px-4 py-1.5 border",
              level === option ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800",
            ].join(" ")}
            style={TEXT_STYLE}
          >
            {option === "mature" ? "Mature miRNA" : "Precursor"}
          </button>
        ))}
        <button
          type="button"
          className="rounded-lg border px-4 py-1.5 hover:bg-gray-50"
          style={TEXT_STYLE}
          onClick={() => {
            setLists(exampleLists());
            setLevel("mature");
          }}
        >
          Load example
        </button>
      </div>
      <p className="text-gray-600 mt-2" style={TEXT_STYLE}>
        The example is the miRNAs upregulated and downregulated in Alzheimer&apos;s
        disease hippocampus (Lau et al., 2013). Names can be written with or
        without the hsa- prefix and the arm.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {lists.map((list, index) => {
          const unmatched = result.matching.filter((m) => m.list === list.label && !m.matched);
          return (
            <div key={index}>
              <label className="block text-gray-700 mb-2" style={TEXT_STYLE}>
                Label
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 mb-3"
                value={list.label}
                onChange={(e) =>
                  setLists((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, label: e.target.value } : item))
                  )
                }
                style={TEXT_STYLE}
              />
              <label className="block text-gray-700 mb-2" style={TEXT_STYLE}>
                miRNA list
              </label>
              <textarea
                className="w-full h-40 border rounded-lg p-3"
                placeholder="One miRNA per line, or separated by commas"
                value={list.text}
                onChange={(e) =>
                  setLists((prev) =>
                    prev.map((item, i) => (i === index ? { ...item, text: e.target.value } : item))
                  )
                }
                style={TEXT_STYLE}
              />
              {!!unmatched.length && (
                <div className="mt-2 text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
                  <div className="font-medium mb-1" style={TEXT_STYLE}>
                    Not in BACTMan ({unmatched.length})
                  </div>
                  <div className="break-words" style={TEXT_STYLE}>
                    {unmatched.map((m) => m.reported).join(", ")}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded border bg-white p-3">
        {result.lists.length ? (
          <EnrichmentDotPlot result={result} />
        ) : (
          <div className="text-gray-500 p-6" style={TEXT_STYLE}>
            Add a miRNA list to see the enrichment plot.
          </div>
        )}
      </div>

      {!!result.lists.length && (
        <div className="mt-8 overflow-x-auto rounded border bg-white">
          <table className="min-w-full" style={TEXT_STYLE}>
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-3 py-2">List</th>
                <th className="px-3 py-2">Cell type</th>
                <th className="px-3 py-2">Overlap</th>
                <th className="px-3 py-2">% overlap</th>
                <th className="px-3 py-2">Odds ratio</th>
                <th className="px-3 py-2">P value</th>
                <th className="px-3 py-2">Padj</th>
              </tr>
            </thead>
            <tbody>
              {result.table.map((row) => (
                <tr key={`${row.list}-${row.cellType}`} className="border-t">
                  <td className="px-3 py-2">{row.list}</td>
                  <td className="px-3 py-2">{row.cellType}</td>
                  <td className="px-3 py-2">
                    {row.markersInList}/{row.markersK}
                  </td>
                  <td className="px-3 py-2">{row.pctOverlap.toFixed(1)}</td>
                  <td className="px-3 py-2">{row.haldane.toFixed(2)}</td>
                  <td className="px-3 py-2">{fmtP(row.pValue)}</td>
                  <td className="px-3 py-2">
                    {fmtP(row.pAdj)}
                    {row.enriched ? " *" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 rounded border bg-white p-3">
        {hasStars ? (
          <MarkerStarPlot reference={reference} result={result} />
        ) : (
          <div className="text-gray-500 p-6" style={TEXT_STYLE}>
            No cell type is enriched in the current lists, so there is no marker plot.
          </div>
        )}
      </div>
    </div>
  );
}
