import type { Metadata } from "next";
import PlansView from "./plans-view";

export const metadata: Metadata = {
  title: "Subscription Plans",
  description:
    "Create and manage subscription plans. Configure pricing, limits, and features for each plan tier.",
  robots: { index: false, follow: false },
};

export default function SubscriptionPlansPage() {
  return <PlansView />;
}
