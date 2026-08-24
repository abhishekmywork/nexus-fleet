"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import type { SearchableSelectOption } from "@/components/common/searchable-select";
import type { ReportMeta } from "@/components/reports/report-shell";
import {
  Car,
  CalendarDays,
  Gauge,
  Clock,
  Power,
  Fence,
  MapPin,
  Activity,
  UserCheck,
  HardDrive,
} from "lucide-react";

const STORAGE_KEY = "nexus-report-state";

export const REPORTS = [
  { id: "vehicle-trips", label: "Vehicle Trips", icon: Car },
  { id: "daily-summary", label: "Daily Summary", icon: CalendarDays },
  { id: "speed-violations", label: "Speed Violations", icon: Gauge },
  { id: "idle-stoppages", label: "Idle & Stoppages", icon: Clock },
  { id: "ignition", label: "Ignition Events", icon: Power },
  { id: "geofence-entry-exit", label: "Geofence Entry/Exit", icon: MapPin },
  { id: "geofence-summary", label: "Geofence Summary", icon: Fence },
  { id: "event-log", label: "Event Log", icon: Activity },
  { id: "driver-activity", label: "Driver Activity", icon: UserCheck },
  { id: "device-health", label: "Device Health", icon: HardDrive },
  { id: "travel-distance", label: "Travel Distance", icon: MapPin },
] as const;

type ReportId = (typeof REPORTS)[number]["id"];

export const REPORT_META: Record<string, ReportMeta> = {
  "vehicle-trips": { label: "Vehicle Trips", needsVehicle: true },
  "daily-summary": { label: "Daily Summary", needsVehicle: true },
  "speed-violations": { label: "Speed Violations", needsVehicle: true, extraFields: ["speedLimit"] },
  "idle-stoppages": { label: "Idle & Stoppages", needsVehicle: true, extraFields: ["minDuration"] },
  ignition: { label: "Ignition Events", needsVehicle: true },
  "geofence-entry-exit": { label: "Geofence Entry/Exit", needsVehicle: true },
  "geofence-summary": { label: "Geofence Summary", needsVehicle: true },
  "event-log": { label: "Event Log", needsVehicle: true, extraFields: ["eventType"] },
  "driver-activity": { label: "Driver Activity", needsVehicle: true },
  "device-health": { label: "Device Health", needsVehicle: true },
  "travel-distance": { label: "Travel Distance", needsVehicle: true },
};

const REPORT_OPTIONS: SearchableSelectOption[] = REPORTS.map((r) => ({
  value: r.id,
  label: r.label,
}));

function loadReportType(): ReportId {
  if (typeof window === "undefined") return "vehicle-trips";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.reportType && REPORTS.some((r) => r.id === parsed.reportType)) {
        return parsed.reportType;
      }
    }
  } catch {}
  return "vehicle-trips";
}

export default function ReportsPage() {
  const [selected, setSelected] = useState<ReportId>(loadReportType);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const state = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, reportType: selected }));
    } catch {}
  }, [selected]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate and export fleet management reports."
      />
      <ReportRouter selected={selected} onReportTypeChange={(id) => setSelected(id as ReportId)} />
    </div>
  );
}

function ReportRouter({ selected, onReportTypeChange }: { selected: ReportId; onReportTypeChange: (id: string) => void }) {
  const [ReportComponent, setReportComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    const load = async () => {
      switch (selected) {
        case "vehicle-trips": {
          const mod = await import("@/components/reports/vehicle-trip-report");
          setReportComponent(() => mod.VehicleTripReport);
          break;
        }
        case "daily-summary": {
          const mod = await import("@/components/reports/daily-summary-report");
          setReportComponent(() => mod.DailySummaryReport);
          break;
        }
        case "speed-violations": {
          const mod = await import("@/components/reports/speed-violation-report");
          setReportComponent(() => mod.SpeedViolationReport);
          break;
        }
        case "idle-stoppages": {
          const mod = await import("@/components/reports/idle-report");
          setReportComponent(() => mod.IdleReport);
          break;
        }
        case "ignition": {
          const mod = await import("@/components/reports/ignition-report");
          setReportComponent(() => mod.IgnitionReport);
          break;
        }
        case "geofence-entry-exit": {
          const mod = await import("@/components/reports/geofence-entry-exit-report");
          setReportComponent(() => mod.GeofenceEntryExitReport);
          break;
        }
        case "geofence-summary": {
          const mod = await import("@/components/reports/geofence-summary-report");
          setReportComponent(() => mod.GeofenceSummaryReport);
          break;
        }
        case "event-log": {
          const mod = await import("@/components/reports/event-log-report");
          setReportComponent(() => mod.EventLogReport);
          break;
        }
        case "driver-activity": {
          const mod = await import("@/components/reports/driver-activity-report");
          setReportComponent(() => mod.DriverActivityReport);
          break;
        }
        case "device-health": {
          const mod = await import("@/components/reports/device-health-report");
          setReportComponent(() => mod.DeviceHealthReport);
          break;
        }
        case "travel-distance": {
          const mod = await import("@/components/reports/travel-distance-report");
          setReportComponent(() => mod.TravelDistanceReport);
          break;
        }
        default:
          setReportComponent(null);
      }
    };
    load();
  }, [selected]);

  if (!ReportComponent) return null;

  return (
    <ReportComponent
      reportType={selected}
      onReportTypeChange={onReportTypeChange}
      reportOptions={REPORT_OPTIONS}
      reportMeta={REPORT_META}
    />
  );
}
