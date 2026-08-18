import type { Metadata } from "next";
import GeofencesView from "./geofences-view";

export const metadata: Metadata = {
  title: "Geofences",
  description:
    "Define and manage geofences. Set geographic boundaries for fleet operations and receive alerts on entry/exit.",
  robots: { index: false, follow: false },
};

export default function GeofencesPage() {
  return <GeofencesView />;
}
