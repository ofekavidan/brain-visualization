// src/app/enrichment/page.tsx
import EnrichmentClient from "./EnrichmentClient";

export const metadata = {
  title: "Cell type enrichment • miR Atlas",
};

export default function Page() {
  return <EnrichmentClient />;
}
