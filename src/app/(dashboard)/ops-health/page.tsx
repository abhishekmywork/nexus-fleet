import type { Metadata } from "next";
import { OpsHealthView } from "./ops-health-view";

export const metadata: Metadata = {
  title: "System Health",
  description:
    "Telemetry pipeline state, device coverage and data-quality signals for the fleet.",
  openGraph: {
    title: "System Health — MST-VTS",
    description:
      "Telemetry pipeline state, device coverage and data-quality signals for the fleet.",
  },
};

export default function OpsHealthPage() {
  return <OpsHealthView />;
}
