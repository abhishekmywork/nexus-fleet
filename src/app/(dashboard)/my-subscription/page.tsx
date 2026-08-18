import type { Metadata } from "next";
import MySubscriptionView from "./my-subscription-view";

export const metadata: Metadata = {
  title: "My Subscription",
  description:
    "View your organization's current subscription plan, usage limits, and renewal date.",
  robots: { index: false, follow: false },
};

export default function MySubscriptionPage() {
  return <MySubscriptionView />;
}
