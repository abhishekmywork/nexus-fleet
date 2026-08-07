"use client";

import * as React from "react";
import { api } from "@/lib/api";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function RedisStatusIndicator() {
  const [connected, setConnected] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await api.telemetry.status();
        if (!cancelled) setConnected(res.connected);
      } catch {
        if (!cancelled) setConnected(false);
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const color =
    connected === null
      ? "bg-yellow-500"
      : connected
        ? "bg-green-500"
        : "bg-red-500";

  const label =
    connected === null
      ? "Checking Redis..."
      : connected
        ? "Redis connected"
        : "Redis disconnected";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`size-2 rounded-full ${color} ${connected ? "animate-pulse" : ""}`}
            aria-label={label}
          />
          <span className="hidden sm:inline">Redis</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
