"use client";

import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";
import type { PcaRow } from "./types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type Props = {
  title: string;
  data: PcaRow[];
  mir: string;
  colors?: { neurons: string; astro: string; micro: string };
  height?: number;
};

export default function BoxPlot({
  title,
  data,
  mir,
  colors = { neurons: "#E64B35", astro: "#4DBBD5", micro: "#00A087" },
  height = 420,
}: Props) {
  // שליפת הערכים לכל תא-סוג
  const getY = (cell: string) =>
    data
      .filter((r) => String(r["Cell type"]).toLowerCase().includes(cell))
      .map((r) => Number(r[mir]));

  const neurons = getY("neuron");
  const astro = getY("astro");
  const micro = getY("micro");

  const trace = (
    name: string,
    y: number[],
    lineColor: string,
    markerColor: string
  ): Partial<Data> => ({
    type: "box",
    name,
    y,
    boxpoints: "all",
    jitter: 0.4,
    pointpos: 0,
    marker: { color: markerColor, opacity: 0.9, size: 6 },
    line: { color: lineColor, width: 3 },
    fillcolor: "rgba(0,0,0,0)",
    hovertemplate: "%{y:.2f}<extra></extra>",
  });

  const dataTraces = [
    trace("Neurons", neurons, colors.neurons, colors.neurons),
    trace("Astrocytes", astro, colors.astro, colors.astro),
    trace("Microglia", micro, colors.micro, colors.micro),
  ];

  const layout: Partial<Layout> = {
    title: { text: title },
    margin: { l: 70, r: 20, t: 60, b: 80 },
    xaxis: { tickangle: 30 },
    yaxis: {
      title: { text: "Log(CPM)" },
      zeroline: false,
      showline: true,
      mirror: true,
      ticks: "outside",
    },
    showlegend: false,
    width: undefined,
    height,
  };

  return (
    <Plot data={dataTraces as any} layout={layout} style={{ width: "100%" }} />
  );
}
