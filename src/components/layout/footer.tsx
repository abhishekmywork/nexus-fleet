"use client";

import * as React from "react";
import { api } from "@/lib/api";

interface ContactInfo {
  name: string;
  phone: string;
  email: string;
}

export function Footer() {
  const [contact, setContact] = React.useState<ContactInfo | null>(null);

  React.useEffect(() => {
    api.publicContact().then(setContact).catch(() => {});
  }, []);

  const contactParts: string[] = [];
  if (contact?.name) contactParts.push(contact.name);
  if (contact?.phone) contactParts.push(contact.phone);
  if (contact?.email) contactParts.push(contact.email);

  return (
    <footer className="border-t px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <p>
          © {new Date().getFullYear()} MST-VTS. Built with Next.js, Tailwind CSS
          and shadcn/ui.
        </p>
        {contactParts.length > 0 && (
          <p className="mt-1 sm:mt-0">
            Contact: {contactParts.join(" · ")}
          </p>
        )}
      </div>
    </footer>
  );
}
