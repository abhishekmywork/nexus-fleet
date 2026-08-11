"use client";

import * as React from "react";
import { api } from "@/lib/api";

interface ContactInfo {
  name: string;
  phone: string;
  email: string;
}

export function ContactFooter() {
  const [contact, setContact] = React.useState<ContactInfo | null>(null);

  React.useEffect(() => {
    api.publicContact().then(setContact).catch(() => {});
  }, []);

  const parts: string[] = [];
  if (contact?.name) parts.push(contact.name);
  if (contact?.phone) parts.push(contact.phone);
  if (contact?.email) parts.push(contact.email);

  if (parts.length === 0) return null;

  return (
    <div className="text-center text-xs text-muted-foreground mt-4">
      Contact: {parts.join(" · ")}
    </div>
  );
}
