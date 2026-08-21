"use client";

import * as React from "react";
import {
  ArrowLeft,
  Fence,
  LogOut,
  Power,
  Route,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/auth-provider";
import type { LivePosition } from "@/hooks/use-live-map";

interface VehicleSidebarProps {
  positions: LivePosition[];
  visibleVehicles: Set<string>;
  selectedDeviceId: string | null;
  onToggle: (deviceId: string) => void;
  onSelect: (deviceId: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  showGeofences: boolean;
  onToggleGeofences: () => void;
  open: boolean;
  onToggleOpen: () => void;
}

function formatSpeed(speed: number | null): string {
  if (speed == null) return "—";
  return `${parseFloat(speed.toFixed(1))} km/h`;
}

function timeAgo(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function VehicleSidebar({
  positions,
  visibleVehicles,
  selectedDeviceId,
  onToggle,
  onSelect,
  onShowAll,
  onHideAll,
  showGeofences,
  onToggleGeofences,
  open,
  onToggleOpen,
}: VehicleSidebarProps) {
  const [query, setQuery] = React.useState("");
  const { logout, can } = useAuth();
  const effectiveMovement = (p: { movement: string | null; speed: number | null }) => {
    const numSpeed = p.speed != null ? Number(p.speed) : null;
    return (numSpeed != null && numSpeed > 0) ? p.movement : (p.movement === "MOVING" ? "IDLE" : p.movement);
  };
  const movingCount = React.useMemo(
    () => positions.filter((p) => effectiveMovement(p) === "MOVING").length,
    [positions]
  );
  const filtered = React.useMemo(() => {
    if (!query.trim()) return positions;
    const q = query.toLowerCase();
    return positions.filter(
      (p) =>
        (p.plateNumber && p.plateNumber.toLowerCase().includes(q)) ||
        p.deviceId.toLowerCase().includes(q) ||
        (effectiveMovement(p) && effectiveMovement(p)!.toLowerCase().includes(q)) ||
        (p.ignition && `ignition ${p.ignition}`.toLowerCase().includes(q))
    );
  }, [positions, query]);
  if (!open) return null;
  return (
    <div className="flex h-full shrink-0 flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Power className="size-3.5 text-green-500" />
        <span className="text-xs font-semibold">Fleet</span>
        <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0">
          {movingCount}/{positions.length}
        </Badge>
      </div>

          {/* Search */}
          <div className="flex items-center gap-1.5 border-b px-3 py-1.5">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vehicles..."
              className="h-6 border-0 bg-transparent p-0 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="shrink-0 rounded-sm opacity-50 hover:opacity-100">
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Vehicle list */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-1.5">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  {positions.length === 0 ? "No vehicles with GPS data." : "No matches found."}
                </p>
              ) : (
                filtered.map((pos) => {
                  const effMove = effectiveMovement(pos);
                  const isMoving = effMove === "MOVING";
                  const isStopped = effMove === "STOPPED";
                  const isSelected = selectedDeviceId === pos.deviceId;
                  const ago = timeAgo(pos.timestamp);
                  return (
                    <div
                      key={pos.deviceId}
                      className={cn(
                        "flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors",
                        isSelected ? "bg-blue-500/10 ring-1 ring-blue-500/30" : "hover:bg-accent/30"
                      )}
                    >
                      {/* Toggle visibility — separate from selection */}
                      <Switch
                        checked={visibleVehicles.has(pos.deviceId)}
                        onCheckedChange={() => onToggle(pos.deviceId)}
                        size="sm"
                        className="mt-0.5 shrink-0"
                      />
                      {/* Click row to select/show trail */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(pos.deviceId)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(pos.deviceId); } }}
                        className="min-w-0 flex-1 space-y-0.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-block size-1 rounded-full shrink-0",
                              isMoving ? "bg-green-500" : isStopped ? "bg-gray-400" : "bg-emerald-500"
                            )}
                          />
                          <span className="truncate text-xs font-semibold">
                            {pos.plateNumber ?? pos.deviceId.slice(0, 8)}
                          </span>
                          {isSelected && (
                            <Route className="size-3 shrink-0 text-blue-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="font-medium text-foreground/80">{formatSpeed(pos.speed)}</span>
                          <span>·</span>
                          <span className={cn(
                            "font-medium",
                            isMoving ? "text-green-600 dark:text-green-400" : isStopped ? "text-gray-500 dark:text-gray-400" : "text-emerald-600 dark:text-emerald-400"
                          )}>
                            {effMove ?? "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {pos.ignition && (
                            <span className={cn(pos.ignition === "ON" ? "text-green-600 dark:text-green-400" : "")}>
                              IGN {pos.ignition}
                            </span>
                          )}
                          {pos.batteryV != null && (
                            <span>{pos.batteryV.toFixed(1)}V</span>
                          )}
                          {pos.gsmSignal != null && (
                            <span>{pos.gsmSignal}%</span>
                          )}
                          <span className="ml-auto">{ago}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <Separator />

          {/* Actions */}
          <div className="flex gap-1 px-3 py-2">
            <Button variant="outline" size="sm" className="h-6 flex-1 text-[10px]" onClick={onShowAll}>
              Show All
            </Button>
            <Button variant="outline" size="sm" className="h-6 flex-1 text-[10px]" onClick={onHideAll}>
              Hide All
            </Button>
          </div>

          {/* Geofence toggle */}
          <div className="flex items-center gap-2 border-t px-3 py-2">
            <Fence className="size-3.5 text-muted-foreground" />
            <span className="flex-1 text-xs">Geofences</span>
            <Switch
              checked={showGeofences}
              onCheckedChange={onToggleGeofences}
              size="sm"
            />
          </div>

          {/* Dashboard link or Logout */}
          <div className="border-t p-3">
            {can("page:dashboard") ? (
              <a
                href="/"
                className="flex items-center justify-center gap-1.5 w-full h-7 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                Back to Dashboard
              </a>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => logout()}
              >
                <LogOut className="size-3.5 mr-1.5" />
                Logout
              </Button>
            )}
          </div>
    </div>
  );
}
