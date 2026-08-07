"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SearchableSelect, SearchableSelectOption } from "@/components/common/searchable-select";
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
import { VehicleTripReport } from "@/components/reports/vehicle-trip-report";
import { DailySummaryReport } from "@/components/reports/daily-summary-report";
import { SpeedViolationReport } from "@/components/reports/speed-violation-report";
import { IdleReport } from "@/components/reports/idle-report";
import { IgnitionReport } from "@/components/reports/ignition-report";
import { GeofenceEntryExitReport } from "@/components/reports/geofence-entry-exit-report";
import { GeofenceSummaryReport } from "@/components/reports/geofence-summary-report";
import { EventLogReport } from "@/components/reports/event-log-report";
import { DriverActivityReport } from "@/components/reports/driver-activity-report";
import { DeviceHealthReport } from "@/components/reports/device-health-report";

const REPORTS = [
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
] as const;

type ReportId = (typeof REPORTS)[number]["id"];

const REPORT_COMPONENTS: Record<ReportId, React.ComponentType> = {
  "vehicle-trips": VehicleTripReport,
  "daily-summary": DailySummaryReport,
  "speed-violations": SpeedViolationReport,
  "idle-stoppages": IdleReport,
  ignition: IgnitionReport,
  "geofence-entry-exit": GeofenceEntryExitReport,
  "geofence-summary": GeofenceSummaryReport,
  "event-log": EventLogReport,
  "driver-activity": DriverActivityReport,
  "device-health": DeviceHealthReport,
};

const REPORT_OPTIONS: SearchableSelectOption[] = REPORTS.map((r) => ({
  value: r.id,
  label: r.label,
}));

export default function ReportsPage() {
  const [selected, setSelected] = useState<ReportId>("vehicle-trips");
  const ReportComponent = REPORT_COMPONENTS[selected];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate and export fleet management reports."
      />

      <div className="space-y-4">
        <SearchableSelect
          options={REPORT_OPTIONS}
          value={selected}
          onChange={(v) => {
            if (v) setSelected(v as ReportId);
          }}
          placeholder="Select a report..."
          className="w-full max-w-sm"
        />
        <ReportComponent />
      </div>
    </div>
  );
}
