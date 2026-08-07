"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ServingArea } from "@/lib/auth-types";

export interface ServingAreaFormValues {
  name: string;
  description?: string;
}

interface ServingAreaFormDialogProps {
  area: ServingArea | null;
  pending?: boolean;
  onClose: () => void;
  onSave: (values: ServingAreaFormValues) => void;
}

/**
 * Modal for creating or editing a serving area. Name is required;
 * description is optional.
 */
export function ServingAreaFormDialog({
  area,
  pending,
  onClose,
  onSave,
}: ServingAreaFormDialogProps) {
  const [form, setForm] = React.useState<ServingAreaFormValues>(() =>
    area
      ? {
          name: area.name,
          description: area.description ?? "",
        }
      : {
          name: "",
          description: "",
        },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {area ? "Edit serving area" : "Create serving area"}
          </DialogTitle>
          <DialogDescription>
            {area
              ? "Rename the serving area and update its description."
              : "Define a new zone where vehicles can operate."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="area-name">Name</Label>
            <Input
              id="area-name"
              required
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="North Zone"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="area-description">Description</Label>
            <textarea
              id="area-description"
              value={form.description ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Covers the northern part of the city"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <DialogFooter className="pt-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : area ? "Save changes" : "Create serving area"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
