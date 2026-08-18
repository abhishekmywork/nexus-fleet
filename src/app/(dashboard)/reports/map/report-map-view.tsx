"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ReportMap } from "@/components/reports/report-map";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogOverlay,
} from "@/components/ui/dialog";
import { ArrowLeft, FileText } from "lucide-react";
import { domToPng } from "modern-screenshot";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Column } from "@/components/reports/report-shell";

const STORAGE_KEY = "report-map-data";

export interface ReportMapData {
  title: string;
  data: any[];
  columns: Column[];
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return `${val.length} items`;
  return String(val);
}

function extractLatLng(row: any): { lat: number; lng: number } | null {
  if (row.latitude != null && row.longitude != null) {
    return { lat: Number(row.latitude), lng: Number(row.longitude) };
  }
  if (row.lat != null && row.lng != null) {
    return { lat: Number(row.lat), lng: Number(row.lng) };
  }
  if (Array.isArray(row.points) && row.points.length > 0) {
    const p = row.points[0];
    if (p.latitude != null && p.longitude != null) {
      return { lat: Number(p.latitude), lng: Number(p.longitude) };
    }
  }
  return null;
}

async function captureMapForPDF(data: any[]): Promise<string> {
  const L = (await import("leaflet")).default;

  const points: { lat: number; lng: number }[] = [];
  const trails: { lat: number; lng: number }[][] = [];
  const rowMeta: { point: { lat: number; lng: number }; color: string; label: string }[] = [];

  for (const row of data) {
    const pt = extractLatLng(row);
    if (pt && isFinite(pt.lat) && isFinite(pt.lng)) {
      points.push(pt);
      const label = row.plateNumber || row.deviceId || row.name || "";
      rowMeta.push({ point: pt, color: "#2563eb", label: String(label) });

      if (Array.isArray(row.points) && row.points.length > 1) {
        const trail = row.points
          .map((p: any) => ({
            lat: Number(p.latitude ?? p.lat),
            lng: Number(p.longitude ?? p.lng),
          }))
          .filter((p: any) => isFinite(p.lat) && isFinite(p.lng));
        if (trail.length > 1) trails.push(trail);
      }
    }
  }

  if (points.length === 0) throw new Error("No valid coordinates");

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "-9999px";
  container.style.left = "-9999px";
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);

  const map = L.map(container, {
    center: [points[0].lat, points[0].lng],
    zoom: 13,
    zoomControl: false,
    attributionControl: false,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);

  const blueIcon = L.divIcon({
    className: "",
    html: `<div style="width:10px;height:10px;background:#2563eb;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

  for (const rm of rowMeta) {
    L.marker([rm.point.lat, rm.point.lng], { icon: blueIcon })
      .addTo(map)
      .bindTooltip(rm.label, { permanent: true, direction: "top", offset: [0, -6], className: "" });
  }

  for (const trail of trails) {
    L.polyline(trail, { color: "#2563eb", weight: 3, opacity: 0.7 }).addTo(map);
  }

  map.fitBounds(L.latLngBounds(points).pad(0.1));

  // Wait for tiles to load
  await new Promise<void>((resolve) => {
    let done = false;
    map.whenReady(() => {
      setTimeout(() => {
        if (!done) { done = true; resolve(); }
      }, 1500);
    });
    setTimeout(() => { if (!done) { done = true; resolve(); } }, 4000);
  });

  const imgData = await domToPng(container, { scale: 2, backgroundColor: "#ffffff" });

  map.remove();
  document.body.removeChild(container);

  return imgData;
}

export default function ReportMapPage() {
  const router = useRouter();
  const [payload, setPayload] = React.useState<ReportMapData | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [pdfTitle, setPdfTitle] = React.useState("");
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        setPayload(JSON.parse(raw));
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
    setLoaded(true);
  }, []);

  const handleExportPDF = async () => {
    if (!payload || !pdfTitle.trim()) return;
    setExporting(true);

    try {
      let mapImgData: string | null = null;

      if (payload.data.length > 0) {
        try {
          mapImgData = await captureMapForPDF(payload.data);
        } catch {
          // Map capture failed, continue without map image
        }
      }

      const doc = new jsPDF({ orientation: "landscape" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(pdfTitle.trim(), 14, 20);

      // Subtitle
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`${payload.data.length} data points | Generated ${new Date().toLocaleString()}`, 14, 28);
      doc.setTextColor(0);

      let tableStartY = 34;

      // Map image
      if (mapImgData) {
        const margin = 14;
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (800 / 1200) * imgWidth;
        const maxMapHeight = pageHeight * 0.45;
        const finalHeight = Math.min(imgHeight, maxMapHeight);
        doc.addImage(mapImgData, "PNG", margin, 34, imgWidth, finalHeight);
        tableStartY = 34 + finalHeight + 8;
      }

      // Check if table fits
      if (tableStartY > pageHeight - 40) {
        doc.addPage();
        tableStartY = 16;
      }

      // Data table
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${pdfTitle.trim()} — Data`, 14, tableStartY);

      const visibleCols = payload.columns.filter(
        (c) => !Array.isArray(payload.data[0]?.[c.key]) || c.key === "points"
      );

      autoTable(doc, {
        startY: tableStartY + 6,
        head: [visibleCols.map((c) => c.label)],
        body: payload.data.map((row) =>
          visibleCols.map((col) =>
            formatValue(col.getValue ? col.getValue(row) : row[col.key])
          )
        ),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { left: 14, right: 14 },
      });

      doc.save(`${pdfTitle.trim().toLowerCase().replace(/\s+/g, "-")}.pdf`);
    } finally {
      setExporting(false);
      setExportOpen(false);
      setPdfTitle("");
    }
  };

  if (!loaded) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="space-y-6">
        <PageHeader title="Report Map" description="No report data to display." />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground mb-4">No report data found. Generate a report first.</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/reports")} className="gap-1.5">
              <ArrowLeft className="size-4" />
              Go to Reports
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${payload.title} — Map View`}
        description={`${payload.data.length} data points plotted on map.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} className="gap-1.5" disabled={exporting}>
              <FileText className="size-3.5" />
              {exporting ? "Exporting..." : "Export PDF"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/reports")} className="gap-1.5">
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </div>
        }
      />
      <Card>
        <CardContent className="p-0">
          <div className="h-[calc(100dvh-220px)]">
            <ReportMap data={payload.data} columns={payload.columns} />
          </div>
        </CardContent>
      </Card>

      {/* PDF Title Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogOverlay className="z-[9998]" />
        <DialogContent className="sm:max-w-md z-[9999]">
          <DialogHeader>
            <DialogTitle>Export PDF</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Report Title
            </label>
            <Input
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder="e.g. Vehicle Trip Report - August 2026"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleExportPDF();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleExportPDF} disabled={!pdfTitle.trim() || exporting}>
              {exporting ? "Exporting..." : "Export"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
