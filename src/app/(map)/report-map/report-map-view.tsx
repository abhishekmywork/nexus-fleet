"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Map, useMap } from "@vis.gl/react-google-maps";
import { ArrowLeft, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogOverlay,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const MAP_STORAGE_KEY = "report-map-data";
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const MAP_STYLE: React.CSSProperties = { width: "100%", height: "100%" };

interface ReportMapData {
  title: string;
  data: any[];
  columns: { key: string; label: string; getValue?: (row: any) => any; render?: (val: any, row: any) => React.ReactNode }[];
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return `${val.length} points`;
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function fmtCoord(val: any): number | null {
  const n = Number(val);
  if (n === 0 || !isFinite(n)) return null;
  return n;
}

function fmtTimestamp(val?: string): string {
  return val ? new Date(val).toLocaleString() : "—";
}

function makeMarker(color: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45);cursor:pointer;`;
  return el;
}

function makeInfo(parts: string[]): string {
  return `<div style="font-size:12px;line-height:1.5;color:#1f2937;font-family:system-ui,sans-serif;max-width:220px;">${parts.join("<br/>")}</div>`;
}

const MapRenderer = React.memo(function MapRenderer({ data }: { data: any[] }) {
  const map = useMap();
  const refs = React.useRef({
    markers: [] as google.maps.marker.AdvancedMarkerElement[],
    lines: [] as google.maps.Polyline[],
    info: null as google.maps.InfoWindow | null,
  });

  React.useEffect(() => {
    if (!map || !data.length) return;
    const r = refs.current;

    r.markers.forEach((m) => (m.map = null));
    r.markers = [];
    r.lines.forEach((l) => l.setMap(null));
    r.lines = [];
    r.info?.close();
    r.info = null;

    const allPts: google.maps.LatLngLiteral[] = [];

    for (const row of data) {
      const plate = row.plateNumber ?? "Unknown";

      if (Array.isArray(row.points) && row.points.length >= 2) {
        const rawTrail = row.points
          .map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lon) }))
          .filter((p: google.maps.LatLngLiteral) => isFinite(p.lat) && isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0));

        // Prefer OSRM road-snapped geometry when available
        const trail = (Array.isArray(row.routeGeometry) && row.routeGeometry.length >= 2)
          ? row.routeGeometry.filter((p: any) => isFinite(p.lat) && isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0))
          : rawTrail;

        if (trail.length >= 2) {
          r.lines.push(
            new google.maps.Polyline({ path: trail, map, strokeColor: "#f97316", strokeWeight: 10, strokeOpacity: 0.2, clickable: false }),
            new google.maps.Polyline({ path: trail, map, strokeColor: "#f97316", strokeWeight: 4, strokeOpacity: 1, clickable: false })
          );
          allPts.push(...trail);

          const sM = new google.maps.marker.AdvancedMarkerElement({ position: trail[0], content: makeMarker("#22c55e"), map });
          sM.addListener("click", () => { r.info?.close(); r.info = new google.maps.InfoWindow({ content: makeInfo([`<b>${plate}</b>`, `Start: ${fmtTimestamp(row.startTime)}`, `Distance: ${row.distanceKm ?? "—"} km`]) }); r.info.open({ anchor: sM, map }); });
          r.markers.push(sM);

          const eM = new google.maps.marker.AdvancedMarkerElement({ position: trail[trail.length - 1], content: makeMarker("#ef4444"), map });
          eM.addListener("click", () => { r.info?.close(); r.info = new google.maps.InfoWindow({ content: makeInfo([`<b>${plate}</b>`, `End: ${fmtTimestamp(row.endTime)}`]) }); r.info.open({ anchor: eM, map }); });
          r.markers.push(eM);
        }
        continue;
      }

      const lat = fmtCoord(row.latitude ?? row.startLat);
      const lon = fmtCoord(row.longitude ?? row.startLon);
      if (lat == null || lon == null) continue;

      const pos = { lat, lng: lon };
      allPts.push(pos);

      const parts: string[] = [`<b>${plate}</b>`];
      if (row.eventType) parts.push(`Event: ${row.eventType}`);
      if (row.speed != null) parts.push(`Speed: ${Number(row.speed).toFixed(1)} km/h`);
      if (row.timestamp) parts.push(`Time: ${fmtTimestamp(row.timestamp)}`);
      if (row.startedAt) parts.push(`Start: ${fmtTimestamp(row.startedAt)}`);
      if (row.geofenceName) parts.push(`Geofence: ${row.geofenceName}`);

      const m = new google.maps.marker.AdvancedMarkerElement({ position: pos, content: makeMarker("#3b82f6"), map });
      m.addListener("click", () => { r.info?.close(); r.info = new google.maps.InfoWindow({ content: makeInfo(parts) }); r.info.open({ anchor: m, map }); });
      r.markers.push(m);
    }

    if (allPts.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      for (const pt of allPts) bounds.extend(pt);
      map.fitBounds(bounds, 50);
    }

    return () => {
      r.markers.forEach((m) => (m.map = null));
      r.markers = [];
      r.lines.forEach((l) => l.setMap(null));
      r.lines = [];
      r.info?.close();
      r.info = null;
    };
  }, [map, data]);

  return null;
});

export default function ReportMapView() {
  const router = useRouter();
  const [payload, setPayload] = React.useState<ReportMapData | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [pdfTitle, setPdfTitle] = React.useState("");
  const [exporting, setExporting] = React.useState(false);

  function buildStaticMapUrl(): string | null {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey || !payload?.data.length) return null;

    const allPts: { lat: number; lng: number }[] = [];
    const markers: string[] = [];
    const paths: string[] = [];

    for (const row of payload.data) {
      if (Array.isArray(row.points) && row.points.length >= 2) {
        const rawTrail = row.points
          .map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lon) }))
          .filter((p: any) => isFinite(p.lat) && isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0));

        const trail = (Array.isArray(row.routeGeometry) && row.routeGeometry.length >= 2)
          ? row.routeGeometry.filter((p: any) => isFinite(p.lat) && isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0))
          : rawTrail;

        if (trail.length >= 2) {
          allPts.push(...trail);
          paths.push(`path=color:0xFF6600CC|weight:3|enc:` + encodePolyline(trail));
          markers.push(`markers=color:0x22C55E|label:S|${trail[0].lat},${trail[0].lng}`);
          markers.push(`markers=color:0xEF4444|label:E|${trail[trail.length - 1].lat},${trail[trail.length - 1].lng}`);
        }
        continue;
      }

      const lat = fmtCoord(row.latitude ?? row.startLat);
      const lon = fmtCoord(row.longitude ?? row.startLon);
      if (lat == null || lon == null) continue;
      allPts.push({ lat, lng: lon });
      markers.push(`markers=color:0x3B82F6|label:V|${lat},${lon}`);
    }

    if (!allPts.length) return null;

    let center: string;
    if (allPts.length === 1) {
      center = `${allPts[0].lat},${allPts[0].lng}`;
    } else {
      const minLat = Math.min(...allPts.map((p) => p.lat));
      const maxLat = Math.max(...allPts.map((p) => p.lat));
      const minLng = Math.min(...allPts.map((p) => p.lng));
      const maxLng = Math.max(...allPts.map((p) => p.lng));
      center = `${(minLat + maxLat) / 2},${(minLng + maxLng) / 2}`;
    }

    const size = "800x500";
    const params = [`center=${center}`, `zoom=auto`, `size=${size}`, `maptype=roadmap`, `key=${apiKey}`, ...markers, ...paths];

    return `https://maps.googleapis.com/maps/api/staticmap?${params.join("&")}`;
  }

  function encodePolyline(points: { lat: number; lng: number }[]): string {
    let result = "";
    let prevLat = 0;
    let prevLng = 0;
    for (const point of points) {
      const curLat = Math.round(point.lat * 1e5);
      const curLng = Math.round(point.lng * 1e5);
      result += encodeNumber(curLat - prevLat) + encodeNumber(curLng - prevLng);
      prevLat = curLat;
      prevLng = curLng;
    }
    return result;
  }

  function encodeNumber(num: number): string {
    let result = "";
    let n = num << 1;
    if (num < 0) n = ~n;
    while (n >= 0x20) {
      result += String.fromCharCode((n & 0x1f) | 0x20);
      n >>= 5;
    }
    result += String.fromCharCode(n);
    return result;
  }

  async function fetchMapImage(url: string): Promise<string | null> {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  const handleExportPDF = async () => {
    if (!payload || !pdfTitle.trim()) return;
    setExporting(true);

    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const staticUrl = buildStaticMapUrl();
      const mapImgData = staticUrl ? await fetchMapImage(staticUrl) : null;

      const doc = new jsPDF({ orientation: "landscape" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(pdfTitle.trim(), 14, 20);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`${payload.data.length} data points | Generated ${new Date().toLocaleString()}`, 14, 28);
      doc.setTextColor(0);

      let tableStartY = 34;

      if (mapImgData) {
        const margin = 14;
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (9 / 16) * imgWidth;
        const maxMapHeight = pageHeight * 0.45;
        const finalHeight = Math.min(imgHeight, maxMapHeight);
        doc.addImage(mapImgData, "PNG", margin, 34, imgWidth, finalHeight);
        tableStartY = 34 + finalHeight + 8;
      }

      if (tableStartY > pageHeight - 40) {
        doc.addPage();
        tableStartY = 16;
      }

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

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(MAP_STORAGE_KEY);
      if (raw) {
        setPayload(JSON.parse(raw));
        sessionStorage.removeItem(MAP_STORAGE_KEY);
      }
    } catch {}
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (!payload || !payload.data.length) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background gap-4">
        <p className="text-sm text-muted-foreground">No report data to display on the map.</p>
        <button onClick={() => router.push("/reports")} className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
          <ArrowLeft className="size-4" /> Go to Reports
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden">
      <Map
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={12}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
        gestureHandling="greedy"
        disableDefaultUI={true}
        style={MAP_STYLE}
      >
        <MapRenderer data={payload.data} />
      </Map>

      {/* Floating header */}
      <div className="absolute top-4 left-1/2 z-[1000] -translate-x-1/2 flex items-center gap-3 rounded-lg border bg-background/90 px-4 py-2 shadow-sm backdrop-blur">
        <h1 className="text-sm font-semibold">{payload.title}</h1>
        <span className="text-xs text-muted-foreground">{payload.data.length} points</span>
      </div>

      {/* Back button */}
      <button
        onClick={() => router.push("/reports")}
        className="absolute top-4 left-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-lg border bg-background/90 shadow-sm backdrop-blur hover:bg-accent"
      >
        <ArrowLeft className="size-4" />
      </button>

      {/* Export button */}
      <button
        onClick={() => setExportOpen(true)}
        disabled={exporting}
        className="absolute top-4 right-4 z-[1000] flex h-10 items-center gap-1.5 rounded-lg border bg-background/90 px-3 text-xs font-medium shadow-sm backdrop-blur hover:bg-accent disabled:opacity-50"
      >
        <FileText className="size-3.5" />
        {exporting ? "Exporting..." : "Export PDF"}
      </button>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogOverlay className="z-[9998]" />
        <DialogContent className="sm:max-w-md z-[9999]">
          <DialogHeader>
            <DialogTitle>Export PDF</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Report Title</label>
            <Input
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder="e.g. Vehicle Trip Report - August 2026"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleExportPDF(); }}
            />
          </div>
          <DialogFooter>
            <button onClick={() => setExportOpen(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">Cancel</button>
            <button onClick={handleExportPDF} disabled={!pdfTitle.trim() || exporting} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {exporting ? "Exporting..." : "Export"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
