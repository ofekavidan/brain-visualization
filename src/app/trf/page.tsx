// src/app/trf/page.tsx
import TrfClient from "./TrfClient";

export const metadata = {
  title: "tRF atlas • miR Atlas",
};

export default function Page() {
  return (
    <main className="min-h-screen">
      <TrfClient />
    </main>
  );
}
