type Props = {
  mir: string
}

export default function PlotDisplay({ mir }: Props) {
  return (
    <div className="flex flex-col items-center gap-6">
      <img
        src={`/plots/interactive_umap/UMAP_${mir}.png`}
        alt={`UMAP of ${mir}`}
        className="w-full max-w-3xl rounded shadow"
      />
      <img
        src={`/plots/interactive_boxplot/Boxplot_${mir}.png`}
        alt={`Boxplot of ${mir}`}
        className="w-full max-w-3xl rounded shadow"
      />
    </div>
  )
}
