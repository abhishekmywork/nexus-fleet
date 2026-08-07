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
import type { GPSDevice, Vehicle } from "@/lib/auth-types";

export interface GPSDeviceFormValues {
  imei: string;
  model: string;
  serialNumber: string;
  simNo: string;
  vehicleId: string;
}

interface GPSDeviceFormDialogProps {
  /** The GPS device being edited, or null when creating a new device. */
  device: GPSDevice | null;
  /** Available vehicles for assignment. */
  vehicles: Vehicle[];
  /** Whether the parent is awaiting the save request. */
  pending?: boolean;
  onClose: () => void;
  onSave: (values: GPSDeviceFormValues) => void;
}

/**
 * Modal form for creating or editing a GPS device against the API. Vehicle
 * assignment is optional and selected from a dropdown of available vehicles.
 */
export function GPSDeviceFormDialog({
  device,
  vehicles,
  pending,
  onClose,
  onSave,
}: GPSDeviceFormDialogProps) {
  const [form, setForm] = React.useState<GPSDeviceFormValues>(() =>
    device
      ? {
          imei: device.imei,
          model: device.model,
          serialNumber: device.serialNumber ?? "",
          simNo: device.simNo ?? "",
          vehicleId: device.vehicleId ?? "",
        }
      : {
          imei: "",
          model: "",
          serialNumber: "",
          simNo: "",
          vehicleId: "",
        }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.imei || !form.model) return;
    onSave(form);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{device ? "Edit GPS device" : "Add new GPS device"}</DialogTitle>
          <DialogDescription>
            {device
              ? "Update the device details and vehicle assignment below."
              : "Register a new GPS device and optionally assign it to a vehicle."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="device-imei">IMEI</Label>
            <Input
              id="device-imei"
              required
              value={form.imei}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, imei: e.target.value }))
              }
              placeholder="e.g. 860012345678901"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="device-model">Model</Label>
            <Input
              id="device-model"
              required
              value={form.model}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, model: e.target.value }))
              }
              placeholder="e.g. GT06N"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="device-serial">Serial Number</Label>
            <Input
              id="device-serial"
              value={form.serialNumber}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, serialNumber: e.target.value }))
              }
              placeholder="Optional"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="device-sim">SIM No.</Label>
            <Input
              id="device-sim"
              value={form.simNo}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, simNo: e.target.value }))
              }
              placeholder="Optional"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="device-vehicle">Vehicle</Label>
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
                : device
                  ? "Save changes"
                  : "Create device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
