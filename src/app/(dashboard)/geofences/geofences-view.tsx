"use client";

import { GeofencesTable } from "@/components/geofences/geofences-table";

export default function GeofencesPage() {
  return (
    <div className="flex flex-col gap-6">
      <GeofencesTable />
    </div>
  );
}
