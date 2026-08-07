"use client";

import { useState, useEffect } from "react";
import { loadReportState } from "@/lib/report-persistence";

export function useReportRestore<T = any[]>(reportId: string): T | null {
  const [restored, setRestored] = useState<T | null>(null);

  useEffect(() => {
    const state = loadReportState();
    if (state && state.reportId === reportId) {
      setRestored(state.data as T);
    }
  }, [reportId]);

  return restored;
}
