// src/app/page.tsx
import Dashboard from "./Dashboard";

export const metadata = {
  title: "BACTMan - Brain Annotation of Cell-Type-enriched MicroRNAs",
};

export default function Page() {
  return (
    <main className="min-h-screen">
      <Dashboard />
    </main>
  );
}
