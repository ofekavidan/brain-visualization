// src/app/enrichment/page.tsx
import EnrichmentClient from "./EnrichmentClient";

export const metadata = {
  title: "Cell type enrichment • BACTMan",
};

export default function Page() {
  return (
    <main className="min-h-screen">
      <EnrichmentClient />
    </main>
  );
}
