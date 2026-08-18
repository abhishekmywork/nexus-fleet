import type { Metadata } from "next";
import dynamic from "next/dynamic";

const MySubscriptionView = dynamic(
  () => import("./my-subscription-view").then((m) => m.default),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "My Subscription",
  description:
    "View your organization's current subscription plan, usage limits, and renewal date.",
  robots: { index: false, follow: false },
};

export default function MySubscriptionPage() {
  return <MySubscriptionView />;
}
