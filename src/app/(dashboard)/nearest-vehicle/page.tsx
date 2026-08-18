import type { Metadata } from "next";
import NearestVehicleView from "./nearest-vehicle-view";

export const metadata: Metadata = {
  title: "Nearest Vehicle",
  description:
    "Find the closest vehicle to any location. Optimize dispatch and response times with real-time fleet positions.",
  robots: { index: false, follow: false },
};

export default function NearestVehiclePage() {
  return <NearestVehicleView />;
}
