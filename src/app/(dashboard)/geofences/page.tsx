import type { Metadata } from "next";
import dynamic from "next/dynamic";

const GeofencesView = dynamic(
  () => import("./geofences-view").then((m) => m.default),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Geofences",
  description:
    "Define and manage geofences. Set geographic boundaries for fleet operations and receive alerts on entry/exit.",
  robots: { index: false, follow: false },
};

export default function GeofencesPage() {
  return <GeofencesView />;
}
