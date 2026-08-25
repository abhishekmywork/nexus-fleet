"use client";

import * as React from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: Date;
  to: Date;
}

type PresetKey =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "last-7-days"
  | "last-30-days"
  | "all-time"
  | "custom";

interface Preset {
  label: string;
  key: PresetKey;
  getRange: () => DateRange;
}

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function getMonday(d: Date) {
  const r = new Date(d);
  const day = r.getDay();
  const diff = r.getDate() - day + (day === 0 ? -6 : 1);
  r.setDate(diff);
  return startOfDay(r);
}

function getSunday(d: Date) {
  const mon = getMonday(d);
  const r = new Date(mon);
  r.setDate(r.getDate() + 6);
  return endOfDay(r);
}

const PRESETS: Preset[] = [
  {
    label: "Today",
    key: "today",
    getRange: () => {
      const now = new Date();
      return { from: startOfDay(now), to: endOfDay(now) };
    },
  },
  {
    label: "Yesterday",
    key: "yesterday",
    getRange: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return { from: startOfDay(d), to: endOfDay(d) };
    },
  },
  {
    label: "This Week",
    key: "this-week",
    getRange: () => {
      const now = new Date();
      return { from: getMonday(now), to: endOfDay(now) };
    },
  },
  {
    label: "Last Week",
    key: "last-week",
    getRange: () => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { from: getMonday(d), to: getSunday(d) };
    },
  },
  {
    label: "This Month",
    key: "this-month",
    getRange: () => {
      const now = new Date();
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: endOfDay(now),
      };
    },
  },
  {
    label: "Last Month",
    key: "last-month",
    getRange: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(first), to: endOfDay(last) };
    },
  },
  {
    label: "Last 7 Days",
    key: "last-7-days",
    getRange: () => {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    },
  },
  {
    label: "Last 30 Days",
    key: "last-30-days",
    getRange: () => {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: startOfDay(from), to: endOfDay(now) };
    },
  },
  {
    label: "All Time",
    key: "all-time",
    getRange: () => ({
      from: new Date(2020, 0, 1),
      to: endOfDay(new Date()),
    }),
  },
];

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = React.useState<PresetKey>("this-week");
  const [customFrom, setCustomFrom] = React.useState(toInputDate(value.from));
  const [customTo, setCustomTo] = React.useState(toInputDate(value.to));

  const handlePreset = (preset: Preset) => {
    setActivePreset(preset.key);
    onChange(preset.getRange());
  };

  const handleCustomApply = () => {
    const from = new Date(customFrom + "T00:00:00");
    const to = new Date(customTo + "T23:59:59");
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return;
    setActivePreset("custom");
    onChange({ from: startOfDay(from), to: endOfDay(to) });
  };

  const label =
    activePreset === "custom"
      ? `${formatDate(value.from)} – ${formatDate(value.to)}`
      : PRESETS.find((p) => p.key === activePreset)?.label ?? "Select range";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 gap-2 text-xs font-medium",
            className,
          )}
        >
          <CalendarDays className="size-3.5 text-muted-foreground" />
          <span>{label}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1">
        {PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.key}
            onClick={() => handlePreset(preset)}
            className={cn(
              "text-xs cursor-pointer",
              activePreset === preset.key && "bg-accent font-medium",
            )}
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <Button
            size="sm"
            className="h-7 w-full text-xs"
            onClick={handleCustomApply}
          >
            Apply Custom Range
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
