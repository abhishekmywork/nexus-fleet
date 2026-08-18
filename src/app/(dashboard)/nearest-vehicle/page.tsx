import type { Metadata } from "next";
import dynamic from "next/dynamic";

const NearestVehicleView = dynamic(
  () => import("./nearest-vehicle-view").then((m) => m.default),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Nearest Vehicle",
  description:
    "Find the closest vehicle to any location. Optimize dispatch and response times with real-time fleet positions.",
  robots: { index: false, follow: false },
};

export default function NearestVehiclePage() {
  return <NearestVehicleView />;
}
