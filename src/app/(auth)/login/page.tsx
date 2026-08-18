import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to MST-VTS fleet management dashboard. Access your fleet tracking, vehicle monitoring, and reporting tools.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginForm />;
}
