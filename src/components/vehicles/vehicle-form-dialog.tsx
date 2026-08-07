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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/common/searchable-select";
import type { ServingArea, Vehicle } from "@/lib/auth-types";

export interface VehicleFormValues {
  plateNumber: string;
  make: string;
  model: string;
  year: string;
  status: Vehicle["status"];
  notes: string;
  servingAreaIds: string[];
}

interface VehicleFormDialogProps {
  vehicle: Vehicle | null;
  servingAreas: ServingArea[];
  pending?: boolean;
  onClose: () => void;
  onSave: (values: VehicleFormValues) => void;
}

export function VehicleFormDialog({
  vehicle,
  servingAreas,
  pending,
  onClose,
  onSave,
}: VehicleFormDialogProps) {
  const [form, setForm] = React.useState<VehicleFormValues>(() =>
    vehicle
      ? {
          plateNumber: vehicle.plateNumber,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year?.toString() ?? "",
          status: vehicle.status,
          notes: vehicle.notes ?? "",
          servingAreaIds: vehicle.servingAreas.map((a) => a.id),
        }
      : {
          plateNumber: "",
          make: "",
          model: "",
          year: "",
          status: "active",
          notes: "",
          servingAreaIds: [],
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
            {vehicle ? "Edit vehicle" : "Add new vehicle"}
          </DialogTitle>
          <DialogDescription>
            {vehicle
              ? "Update the vehicle details and service areas below."
              : "Register a new vehicle and assign service areas."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="vehicle-plate">Plate number</Label>
            <Input
              id="vehicle-plate"
              required
              value={form.plateNumber}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, plateNumber: e.target.value }))
              }
              placeholder="ABC-1234"
              autoFocus={!vehicle}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="vehicle-make">Make</Label>
              <Input
                id="vehicle-make"
                required
                value={form.make}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, make: e.target.value }))
                }
                placeholder="Toyota"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-model">Model</Label>
              <Input
                id="vehicle-model"
                required
                value={form.model}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, model: e.target.value }))
                }
                placeholder="Hiace"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="vehicle-year">Year</Label>
              <Input
                id="vehicle-year"
                type="number"
                min={1900}
                max={2100}
                value={form.year}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, year: e.target.value }))
                }
                placeholder="2024"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    status: v as Vehicle["status"],
                  }))
                }
              >
                <SelectTrigger id="vehicle-status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vehicle-notes">Notes</Label>
            <Input
              id="vehicle-notes"
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Optional notes about this vehicle"
            />
          </div>

          <div className="grid gap-2">
            <Label>Service Areas</Label>
            {servingAreas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No serving areas available.
              </p>
            ) : (
              <SearchableSelect
                multiple
                options={servingAreas.map((a) => ({
                  value: a.id,
                  label: a.name,
                  description: a.description ?? undefined,
                }))}
                value={form.servingAreaIds}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    servingAreaIds: v as string[],
                  }))
                }
                placeholder="Search serving areas..."
              />
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : vehicle
                  ? "Save changes"
                  : "Create vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
