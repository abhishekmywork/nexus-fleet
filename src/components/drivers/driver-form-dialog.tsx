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
import { SearchableSelect } from "@/components/common/searchable-select";
import type { Driver, Vehicle } from "@/lib/auth-types";

export interface DriverFormValues {
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phone: string;
  vehicleId: string;
}

interface DriverFormDialogProps {
  /** The driver being edited, or null when creating a new driver. */
  driver: Driver | null;
  /** Available vehicles for assignment. */
  vehicles: Vehicle[];
  /** Whether the parent is awaiting the save request. */
  pending?: boolean;
  onClose: () => void;
  onSave: (values: DriverFormValues) => void;
}

/**
 * Modal form for creating or editing a driver against the API.
 */
export function DriverFormDialog({
  driver,
  vehicles,
  pending,
  onClose,
  onSave,
}: DriverFormDialogProps) {
  const [form, setForm] = React.useState<DriverFormValues>(() =>
    driver
      ? {
          firstName: driver.firstName,
          lastName: driver.lastName,
          licenseNumber: driver.licenseNumber,
          phone: driver.phone ?? "",
          vehicleId: driver.vehicleId ?? "",
        }
      : {
          firstName: "",
          lastName: "",
          licenseNumber: "",
          phone: "",
          vehicleId: "",
        }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {driver ? "Edit driver" : "Add new driver"}
          </DialogTitle>
          <DialogDescription>
            {driver
              ? "Update the driver profile and vehicle assignment below."
              : "Create a new driver profile and optionally assign a vehicle."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="driver-first-name">First name</Label>
              <Input
                id="driver-first-name"
                required
                value={form.firstName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, firstName: e.target.value }))
                }
                placeholder="Jane"
                autoFocus={!driver}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="driver-last-name">Last name</Label>
              <Input
                id="driver-last-name"
                required
                value={form.lastName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, lastName: e.target.value }))
                }
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="driver-license">License number</Label>
            <Input
              id="driver-license"
              required
              value={form.licenseNumber}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  licenseNumber: e.target.value,
                }))
              }
              placeholder="DL-12345678"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="driver-phone">Phone</Label>
            <Input
              id="driver-phone"
              type="tel"
              value={form.phone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="driver-vehicle">Vehicle</Label>
            <SearchableSelect
              options={vehicles.map((v) => ({
                value: v.id,
                label: `${v.plateNumber} — ${v.make} ${v.model}`,
              }))}
              value={form.vehicleId}
              onChange={(v) =>
                setForm((prev) => ({ ...prev, vehicleId: v as string }))
              }
              placeholder="Unassigned"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : driver
                  ? "Save changes"
                  : "Create driver"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
