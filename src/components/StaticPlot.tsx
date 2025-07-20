"use client";

import Image from "next/image";

export default function StaticPlot() {
  return (
    <div className="flex justify-center">
      <Image
        src="/plots/UMAP_cell_type.png"
        alt="UMAP Cell Type"
        width={1200}
        height={800}
        className="rounded-lg shadow-md"
      />
    </div>
  );
}