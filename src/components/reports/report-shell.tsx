"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Search } from "lucide-react";
import { ExportToolbar } from "./export-toolbar";
import { ReportMapDialog } from "./report-map-dialog";
import { api } from "@/lib/api";
import { SearchableSelect, SearchableSelectOption } from "@/components/common/searchable-select";
import type { Vehicle } from "@/lib/auth-types";

const STORAGE_KEY = "nexus-report-state";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function loadPersistedState(): Record<string, any> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistState(state: Record<string, any>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export interface Column {
  key: string;
  label: string;
  getValue?: (row: any) => any;
  render?: (val: any, row: any) => React.ReactNode;
  formatExport?: (val: any, row: any) => string;
}

export interface ReportMeta {
  label: string;
  needsVehicle: boolean;
  extraFields?: string[];
}

interface ReportShellProps {
  title: string;
  reportId: string;
  reportType: string;
  onReportTypeChange: (id: string) => void;
  reportOptions: SearchableSelectOption[];
  reportMeta: Record<string, ReportMeta>;
  children?: React.ReactNode | ((props: { extraParams: Record<string, any>; setParam: (key: string, value: any) => void }) => React.ReactNode);
  onGenerate: (params: { from: string; to: string; [key: string]: any }) => void;
  loading: boolean;
  data: any[];
  columns: Column[];
  exportFileName?: string;
}

export function ReportShell({
  title,
  reportId,
  reportType,
  onReportTypeChange,
  reportOptions,
  reportMeta,
  children,
  onGenerate,
  loading,
  data,
  columns,
  exportFileName,
}: ReportShellProps) {
  const persisted = loadPersistedState();
  const meta = reportMeta[reportType] ?? { label: title, needsVehicle: false };

  const [from, setFrom] = useState(persisted.from ?? todayStr());
  const [to, setTo] = useState(persisted.to ?? todayStr());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(persisted.vehicleId ?? "all");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [extraParams, setExtraParams] = useState<Record<string, any>>(persisted.extraParams ?? {});
  const [speedLimit, setSpeedLimit] = useState(persisted.speedLimit ?? "120");
  const [minDuration, setMinDuration] = useState(persisted.minDuration ?? "5");
  const [eventType, setEventType] = useState(persisted.eventType ?? "all");

  useEffect(() => {
    api.vehicles.list().then(setVehicles).catch(() => {});
  }, []);

  // Persist state on every change
  useEffect(() => {
    persistState({ from, to, vehicleId: selectedVehicleId, extraParams, speedLimit, minDuration, eventType, reportType });
  }, [from, to, selectedVehicleId, extraParams, speedLimit, minDuration, eventType, reportType]);

  const handleGenerate = () => {
    const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
    const deviceId = selectedVehicle?.gpsDevice?.id;
    const params: Record<string, any> = {
      from: `${from}T00:00:00`,
      to: `${to}T23:59:59`,
    };
    if (selectedVehicleId && selectedVehicleId !== "all" && meta.needsVehicle) {
      params.vehicleId = selectedVehicleId;
    }
    if (deviceId && meta.needsVehicle) {
      params.deviceId = deviceId;
    }
    // Inject built-in extra fields
    if (meta.extraFields?.includes("speedLimit")) {
      params.speedLimit = Number(speedLimit) || 120;
    }
    if (meta.extraFields?.includes("minDuration")) {
      params.minDuration = Number(minDuration) || 0;
    }
    if (meta.extraFields?.includes("eventType") && eventType !== "all") {
      params.eventType = eventType;
    }
    onGenerate(params as { from: string; to: string; [key: string]: any });
  };

  const setParam = (key: string, value: any) => {
    setExtraParams((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Row 1: Report Type + Date Range + Vehicle */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label>Report Type</Label>
            <SearchableSelect
              options={reportOptions}
              value={reportType}
              onChange={(v) => { if (v) onReportTypeChange(v as string); }}
              placeholder="Select report..."
            />
          </div>
          <div className="grid gap-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {meta.needsVehicle ? (
            <div className="grid gap-1.5">
              <Label>Vehicle</Label>
              <SearchableSelect
                options={[
                  { value: "all", label: "All Vehicles" },
                  ...vehicles.map((v) => ({
                    value: v.id,
                    label: v.plateNumber,
                    description: `${v.make} ${v.model}`,
                  })),
                ]}
                value={selectedVehicleId}
                onChange={(val) => setSelectedVehicleId(val as string)}
                placeholder="All Vehicles"
              />
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label className="invisible">.</Label>
              <Button onClick={handleGenerate} disabled={loading} className="w-full">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Generate
              </Button>
            </div>
          )}
        </div>

        {/* Row 2: Extra fields + Generate (only when vehicle is needed or extra fields exist) */}
        {(meta.needsVehicle || meta.extraFields?.length) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {meta.extraFields?.includes("speedLimit") && (
              <div className="grid gap-1.5">
                <Label>Speed Limit (km/h)</Label>
                <Input type="number" value={speedLimit} onChange={(e) => setSpeedLimit(e.target.value)} min={1} />
              </div>
            )}
            {meta.extraFields?.includes("minDuration") && (
              <div className="grid gap-1.5">
                <Label>Min Duration (min)</Label>
                <Input type="number" value={minDuration} onChange={(e) => setMinDuration(e.target.value)} min={0} />
              </div>
            )}
            {meta.extraFields?.includes("eventType") && (
              <div className="grid gap-1.5">
                <Label>Event Type</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="SPEED">Speed</SelectItem>
                    <SelectItem value="IDLE">Idle</SelectItem>
                    <SelectItem value="GEOFENCE">Geofence</SelectItem>
                    <SelectItem value="IGNITION">Ignition</SelectItem>
                    <SelectItem value="MOVEMENT">Movement</SelectItem>
                    <SelectItem value="SOS">SOS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {typeof children === "function"
              ? children({ extraParams, setParam })
              : children}
            <div className="grid gap-1.5">
              <Label className="invisible">.</Label>
              <Button onClick={handleGenerate} disabled={loading} className="w-full">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Generate
              </Button>
            </div>
          </div>
        )}

        {data.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            <ReportMapDialog data={data} columns={columns} title={title} reportId={reportId} />
            <ExportToolbar
              data={data}
              columns={columns}
              fileName={exportFileName ?? title.toLowerCase().replace(/\s+/g, "-")}
            />
          </div>
        )}

        <div className="h-[500px] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center"
                  >
                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No data. Set filters and click Generate.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, i) => (
                  <TableRow key={row.id ?? i}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        {col.render
                          ? col.render(col.getValue ? col.getValue(row) : row[col.key], row)
                          : (col.getValue ? col.getValue(row) : row[col.key]) ?? "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
