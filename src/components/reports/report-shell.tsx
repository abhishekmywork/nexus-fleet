"use client";

import { useState, useEffect } from "react";
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
import { Loader2, Search } from "lucide-react";
import { ExportToolbar } from "./export-toolbar";
import { ReportMapDialog } from "./report-map-dialog";
import { api } from "@/lib/api";
import { SearchableSelect } from "@/components/common/searchable-select";
import type { Vehicle } from "@/lib/auth-types";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export interface Column {
  key: string;
  label: string;
  getValue?: (row: any) => any;
  render?: (val: any, row: any) => React.ReactNode;
}

interface ReportShellProps {
  title: string;
  reportId: string;
  children?: React.ReactNode | ((props: { extraParams: Record<string, any>; setParam: (key: string, value: any) => void }) => React.ReactNode);
  onGenerate: (params: { from: string; to: string; [key: string]: any }) => void;
  loading: boolean;
  data: any[];
  columns: Column[];
  onViewMap?: (row: any) => void;
  exportFileName?: string;
}

export function ReportShell({
  title,
  reportId,
  children,
  onGenerate,
  loading,
  data,
  columns,
  onViewMap,
  exportFileName,
}: ReportShellProps) {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [extraParams, setExtraParams] = useState<Record<string, any>>({});

  useEffect(() => {
    api.vehicles.list().then(setVehicles).catch(() => {});
  }, []);

  const handleGenerate = () => {
    const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
    const deviceId = selectedVehicle?.gpsDevice?.id;
    onGenerate({
      from: `${from}T00:00:00`,
      to: `${to}T23:59:59`,
      ...(deviceId ? { deviceId } : {}),
      ...extraParams,
    });
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
        <div className="flex flex-wrap items-end gap-3 overflow-visible">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              From
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              To
            </label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Vehicle
            </label>
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
              className="w-48"
            />
          </div>
          {typeof children === "function"
            ? children({ extraParams, setParam })
            : children}
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Generate
          </Button>
        </div>

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
                {onViewMap && <TableHead className="w-24">Map</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (onViewMap ? 1 : 0)}
                    className="h-32 text-center"
                  >
                    <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (onViewMap ? 1 : 0)}
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
                    {onViewMap && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewMap(row)}
                        >
                          View
                        </Button>
                      </TableCell>
                    )}
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
