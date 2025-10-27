// טיפוסים משותפים כדי למנוע import מעגלי

export type PcaRow = {
  [k: string]: string | number;
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
