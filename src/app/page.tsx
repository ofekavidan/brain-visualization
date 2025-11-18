// src/app/page.tsx
import Link from "next/link";
import Dashboard from "./Dashboard";

export const metadata = {
  title: "The Live Human Brain MicroRNA Atlas",
};

export default function Page() {
  return (
    <main className="min-h-screen">
      {/* Top bar with link to enrichment page */}
      <div className="w-full border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">miR Atlas</h1>
          <Link
            href="/enrichment"
            className="inline-block rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cell type enrichment
          </Link>
        </div>
      </div>

      {/* Existing dashboard content */}
      <Dashboard />
    </main>
  );
}
