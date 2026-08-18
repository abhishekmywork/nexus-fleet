import { SettingsPanel } from "@/components/settings/settings-panel";

export const metadata = {
  title: "Settings",
  description:
    "Platform settings and configuration. Manage notification preferences, integrations, and system options.",
  openGraph: { title: "Settings — MST-VTS", description: "Platform settings and configuration." },
};

export default function SettingsPage() {
  return <SettingsPanel />;
}
