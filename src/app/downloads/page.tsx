// src/app/downloads/page.tsx
import DownloadsClient from "./DownloadsClient";

export const metadata = {
  title: "Downloads • miR Atlas",
};

export default function Page() {
  return (
    <main className="min-h-screen">
      <DownloadsClient />
    </main>
  );
}
