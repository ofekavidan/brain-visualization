"use client";

import { useState } from "react";
import { Select, SelectItem } from "@nextui-org/react";
import mirListRaw from "@/data/mir_list.json";
import Image from "next/image";

const mirList = mirListRaw.map((mir) => ({
  key: mir.key,
  label: mir.label,
}));

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function UmapPlot({ value, onChange }: Props) {
  const [search, setSearch] = useState("");

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
            className="w-full text-xl"
            classNames={{
              trigger: "bg-white py-2 text-xl pr-12",
              selectorIcon: "right-2",
              popoverContent: "bg-white",
            }}
            disallowEmptySelection
            selectedKeys={[value]}
            onChange={(e) => onChange(e.target.value)}
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
          src={`/plots/interactive_umap/UMAP_${value}.png`}
          alt={`UMAP Plot for ${value}`}
          width={1024}
          height={768}
          className="mx-auto"
        />
      </div>
    </div>
  );
}
