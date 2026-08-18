import type { Metadata } from "next";
import dynamic from "next/dynamic";

const PlansView = dynamic(
  () => import("./plans-view").then((m) => m.default),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Subscription Plans",
  description:
    "Create and manage subscription plans. Configure pricing, limits, and features for each plan tier.",
  robots: { index: false, follow: false },
};

export default function SubscriptionPlansPage() {
  return <PlansView />;
}
