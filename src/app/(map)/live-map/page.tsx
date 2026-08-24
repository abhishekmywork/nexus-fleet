import dynamic from "next/dynamic";

const LiveMapView = dynamic(
  () => import("./live-map-view").then((m) => m.default),
  { ssr: false }
);

export default function LiveMapPage() {
  return <LiveMapView />;
}
