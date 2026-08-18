import type { Metadata } from "next";
import dynamic from "next/dynamic";

const SubscriptionBlockedView = dynamic(
  () => import("./subscription-blocked-view").then((m) => m.default),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "Subscription Required",
  description:
    "Your organization's subscription is inactive or expired. Contact your administrator to restore access.",
  robots: { index: false, follow: false },
};

export default function SubscriptionBlockedPage() {
  return <SubscriptionBlockedView />;
}
