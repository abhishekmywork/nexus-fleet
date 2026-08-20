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

export default function ReportMapPage() {
  const router = useRouter();
  const [payload, setPayload] = React.useState<ReportMapData | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [pdfTitle, setPdfTitle] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

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

      if (payload.data.length > 0 && mapContainerRef.current) {
        try {
          await new Promise((r) => setTimeout(r, 500));
          mapImgData = await domToPng(mapContainerRef.current, {
            scale: 2,
            backgroundColor: "#ffffff",
          });
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
          <div ref={mapContainerRef} className="h-[calc(100dvh-220px)]">
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
