import type { Metadata } from "next";
import dynamic from "next/dynamic";

const SubscriptionsView = dynamic(
  () => import("./subscriptions-view").then((m) => m.default),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Subscriptions",
  description:
    "Manage tenant subscriptions, invitations, and billing. Assign plans and track subscription status.",
  robots: { index: false, follow: false },
};

export default function SubscriptionsPage() {
  return <SubscriptionsView />;
}
