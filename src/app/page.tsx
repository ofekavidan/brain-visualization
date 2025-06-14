import Image from "next/image";
// import {
//   Tabs,
//   TabsContent,
//   TabsList,
//   TabsTrigger,
// } from "C:/Users/DELL/projects/brain-visualization/components/ui/tabs";
// import {
//   Card,
//   CardContent,
// } from "C:/Users/DELL/projects/brain-visualization/components/ui/card";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";


export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4">
      <h1 className="text-4xl font-bold mb-4">
        Klotho KO Brain Visualization
      </h1>
      <p className="mb-6 text-center max-w-xl">
        Interactive viewer based on the data from the study
        <br />
        <span className="italic">
          “Knockout of the longevity gene Klotho perturbs aging and Alzheimer’s
          disease-linked brain microRNAs and tRNA fragments”
        </span>
      </p>

      <Tabs defaultValue="fig1" className="w-full max-w-5xl">
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger
            value="fig1"
            className="data-[state=active]:bg-black data-[state=active]:text-white"
          >
            Figure 1
          </TabsTrigger>
          <TabsTrigger
            value="fig3"
            className="data-[state=active]:bg-black data-[state=active]:text-white"
          >
            Figure 3
          </TabsTrigger>
          <TabsTrigger
            value="fig4"
            className="data-[state=active]:bg-black data-[state=active]:text-white"
          >
            Figure 4
          </TabsTrigger>
          <TabsTrigger
            value="fig5"
            className="data-[state=active]:bg-black data-[state=active]:text-white"
          >
            Figure 5
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fig1">
          <Card>
            <CardContent className="p-4">
              <Image
                src="/fig1.webp"
                alt="Figure 1"
                width={1200}
                height={800}
                className="mx-auto"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fig3">
          <Card>
            <CardContent className="p-4">
              <Image
                src="/fig3.webp"
                alt="Figure 3"
                width={1200}
                height={800}
                className="mx-auto"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fig4">
          <Card>
            <CardContent className="p-4">
              <Image
                src="/fig4.webp"
                alt="Figure 4"
                width={1200}
                height={800}
                className="mx-auto"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fig5">
          <Card>
            <CardContent className="p-4">
              <Image
                src="/fig5.webp"
                alt="Figure 5"
                width={1200}
                height={800}
                className="mx-auto"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
