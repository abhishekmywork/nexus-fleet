import type { Metadata } from "next";
import SubscriptionsView from "./subscriptions-view";

export const metadata: Metadata = {
  title: "Subscriptions",
  description:
    "Manage tenant subscriptions, invitations, and billing. Assign plans and track subscription status.",
  robots: { index: false, follow: false },
};

export default function SubscriptionsPage() {
  return <SubscriptionsView />;
}
