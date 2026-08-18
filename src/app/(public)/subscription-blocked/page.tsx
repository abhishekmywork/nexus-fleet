import type { Metadata } from "next";
import SubscriptionBlockedView from "./subscription-blocked-view";

export const metadata: Metadata = {
  title: "Subscription Required",
  description:
    "Your organization's subscription is inactive or expired. Contact your administrator to restore access.",
  robots: { index: false, follow: false },
};

export default function SubscriptionBlockedPage() {
  return <SubscriptionBlockedView />;
}
