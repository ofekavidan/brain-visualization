"use client";

import { useState, useEffect } from "react";
import { Select, SelectItem } from "@nextui-org/react";
import mirListRaw from "@/data/mir_list.json";
import Image from "next/image";
import Papa from "papaparse";

const mirList = mirListRaw.map((mir) => ({
  key: mir.key,
  label: mir.label,
}));

export default function BoxPlot() {
  const [mirna, setMirna] = useState("hsa-miR-500a-3p");
  const [search, setSearch] = useState("");
  const [tableData, setTableData] = useState<string[][]>([]);

  useEffect(() => {
    const filePath = `/plots/stat_tables/stats_${mirna}.csv`;
    fetch(filePath)
      .then((response) => {
        if (!response.ok) throw new Error("CSV not found");
        return response.text();
      })
      .then((csvText) => {
        const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
        setTableData(parsed.data);
      })
      .catch((error) => {
        console.error("Failed to load stats table:", error);
        setTableData([]);
      });
  }, [mirna]);

  const filteredItems = mirList.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="w-full max-w-sm">
          <input
            type="text"
            placeholder="Search a miRNA"
            className="w-full p-3 text-xl mb-2 border rounded"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            variant="bordered"
            className="w-full bg-white text-xl"
            classNames={{
              trigger: "bg-white py-2 text-xl",
              popoverContent: "bg-white",
            }}
            disallowEmptySelection
            selectedKeys={[mirna]}
            onChange={(e) => setMirna(e.target.value)}
            aria-label="miRNA Selector"
            items={filteredItems}
            listboxProps={{
              emptyContent: "No options found",
            }}
          >
            {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
          </Select>
        </div>
      </div>

      <div className="flex justify-center">
        <Image
          src={`/plots/interactive_boxplot/Boxplot_${mirna}.png`}
          alt={`Boxplot for ${mirna}`}
          width={800}
          height={600}
          className="mx-auto"
        />
      </div>

      <div className="flex justify-center">
        {tableData.length > 0 ? (
          <div className="overflow-x-auto w-full max-w-6xl mt-4">
            <table className="w-full table-auto border-collapse text-lg text-center border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  {tableData[0].map((cell, idx) => (
                    <th
                      key={idx}
                      className="px-4 py-2 border border-gray-300 whitespace-nowrap"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.slice(1).map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-gray-50">
                    {row.map((cell, colIdx) => {
                      const value = parseFloat(cell);
                      const isPadj =
                        tableData[0][colIdx].toLowerCase().includes("padj");
                      const highlight = isPadj && value < 0.05;
                      return (
                        <td
                          key={colIdx}
                          className={`px-4 py-2 border border-gray-200 whitespace-nowrap ${
                            highlight ? "bg-yellow-100 font-semibold" : ""
                          }`}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-gray-500 text-lg">
            No statistics available for {mirna}.
          </p>
        )}
      </div>
    </div>
  );
}
