"use client";

import dynamic from "next/dynamic";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const UmapPlot = dynamic(() => import("@/components/UmapPlot"), {
  ssr: false,
});
const BoxPlot = dynamic(() => import("@/components/BoxPlot"), {
  ssr: false,
});

export default function ClientPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4">
      <h1 className="text-4xl font-bold mb-4">
        Cell-Type-Specific Expression of Small Non-Coding RNAs in the Human Brain
      </h1>
      <p className="mb-6 text-center max-w-xl">
        Interactive viewer based on the data from the study
      </p>

      <Tabs defaultValue="umap" className="w-full max-w-5xl">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger
            value="umap"
            className="data-[state=active]:bg-black data-[state=active]:text-white"
          >
            UMAP
          </TabsTrigger>
          <TabsTrigger
            value="boxplot"
            className="data-[state=active]:bg-black data-[state=active]:text-white"
          >
            Boxplot
          </TabsTrigger>
        </TabsList>

        <TabsContent value="umap">
          <UmapPlot />
        </TabsContent>
        <TabsContent value="boxplot">
          <BoxPlot />
        </TabsContent>
      </Tabs>
    </main>
  );
}
