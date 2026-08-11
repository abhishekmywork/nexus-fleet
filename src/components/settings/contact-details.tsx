"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export function ContactDetails() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");

  React.useEffect(() => {
    async function load() {
      try {
        const settings = await api.globalSettings.list();
        const contactSettings = settings.filter((s) => s.category === "contact");
        for (const s of contactSettings) {
          if (s.key === "contact.name") setName(s.value);
          if (s.key === "contact.phone") setPhone(s.value);
          if (s.key === "contact.email") setEmail(s.value);
        }
      } catch {
        toast.error("Failed to load contact details");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.globalSettings.bulkSet([
        { key: "contact.name", value: name, category: "contact", description: "Contact person or department name" },
        { key: "contact.phone", value: phone, category: "contact", description: "Contact phone number" },
        { key: "contact.email", value: email, category: "contact", description: "Contact email address" },
      ]);
      toast.success("Contact details saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Contact Details</CardTitle>
        <CardDescription>
          Company contact information displayed on login page, footer, and public pages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 max-w-lg">
          <Label htmlFor="contact-name">Contact Person / Department</Label>
          <Input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="MST-VTS Support"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
          <div className="grid gap-2">
            <Label htmlFor="contact-phone">Phone Number</Label>
            <Input
              id="contact-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-email">Email Address</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="support@mstechind.com"
            />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            <Save className="mr-2 size-4" />
            Save contact details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
