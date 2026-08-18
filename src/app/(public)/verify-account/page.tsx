import type { Metadata } from "next";
import VerifyAccountView from "./verify-account-view";

export const metadata: Metadata = {
  title: "Verify Account",
  description:
    "Activate your MST-VTS account. Enter your tenant ID and activation code to get started with fleet management.",
  robots: { index: false, follow: false },
};

export default function VerifyAccountPage() {
  return <VerifyAccountView />;
}
