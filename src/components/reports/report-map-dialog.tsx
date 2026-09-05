"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Map } from "lucide-react";
import { saveReportState } from "@/lib/report-persistence";
import type { Column } from "./report-shell";

const MAP_STORAGE_KEY = "report-map-data";

interface ReportMapDialogProps {
  data: any[];
  columns: Column[];
  title: string;
  reportId: string;
}

export function ReportMapDialog({ data, columns, title, reportId }: ReportMapDialogProps) {
  const router = useRouter();

  const hasGeoData = data.some(
    (row) =>
      (row.latitude != null && row.longitude != null) ||
      (row.startLat != null && row.startLon != null) ||
      (row.endLat != null && row.endLon != null) ||
      (Array.isArray(row.points) && row.points.length > 0)
  );

  if (!hasGeoData) return null;

  const handleOpen = () => {
    saveReportState({ reportId, data });

    // Store only lightweight geo data for the map
    const lightweight = data.map((row) => {
      const base: any = { plateNumber: row.plateNumber };
      if (row.latitude != null) { base.latitude = row.latitude; base.longitude = row.longitude; }
      if (row.startLat != null) { base.startLat = row.startLat; base.startLon = row.startLon; }
      if (row.endLat != null) { base.endLat = row.endLat; base.endLon = row.endLon; }
      if (row.speed != null) base.speed = row.speed;
      if (row.eventType) base.eventType = row.eventType;
      if (row.timestamp) base.timestamp = row.timestamp;
      if (row.startedAt) base.startedAt = row.startedAt;
      if (row.endedAt) base.endedAt = row.endedAt;
      if (row.geofenceName) base.geofenceName = row.geofenceName;
      if (row.startTime) base.startTime = row.startTime;
      if (row.endTime) base.endTime = row.endTime;
      if (row.distanceKm) base.distanceKm = row.distanceKm;
      // Store trail points but limit to every 10th point for large trails
      if (Array.isArray(row.points) && row.points.length > 0) {
        const step = row.points.length > 200 ? Math.ceil(row.points.length / 200) : 1;
        base.points = row.points.filter((_: any, i: number) => i % step === 0 || i === row.points.length - 1);
      }
      if (Array.isArray(row.routeGeometry) && row.routeGeometry.length > 0) {
        base.routeGeometry = row.routeGeometry;
      }
      return base;
    });

    try {
      sessionStorage.setItem(MAP_STORAGE_KEY, JSON.stringify({ title, data: lightweight, columns }));
    } catch {
      // If still too large, store without points
      const noPoints = lightweight.map(({ points, ...rest }) => rest);
      sessionStorage.setItem(MAP_STORAGE_KEY, JSON.stringify({ title, data: noPoints, columns }));
    }

    router.push("/report-map");
  };

  return (
    <Button variant="outline" size="sm" onClick={handleOpen} className="gap-1.5">
      <Map className="size-3.5" />
      View in Map
    </Button>
  );
}
