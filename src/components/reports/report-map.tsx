"use client";

import * as React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Column } from "./report-shell";

function fmtCoord(val: any): number | null {
  const n = Number(val);
  if (!n || !isFinite(n)) return null;
  return n;
}

function fmtTimestamp(val?: string): string {
  return val ? new Date(val).toLocaleString() : "—";
}

function createMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "report-marker",
    html: `<div style="
      width:12px;height:12px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.4);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

const ICON_BLUE = createMarkerIcon("#3b82f6");
const ICON_GREEN = createMarkerIcon("#22c55e");
const ICON_RED = createMarkerIcon("#ef4444");

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);
  return null;
}

interface ReportMapProps {
  data: any[];
  columns: Column[];
}

export function ReportMap({ data, columns }: ReportMapProps) {
  const { markers, polylines, center } = React.useMemo(() => {
    const markers: {
      lat: number;
      lon: number;
      label: string;
      icon: L.DivIcon;
      popup: string;
    }[] = [];
    const polylines: { points: [number, number][]; color: string }[] = [];
    const allPoints: [number, number][] = [];

    for (const row of data) {
      const plate = row.plateNumber ?? "Unknown";

      // Trip reports: start/end + trail points
      if (Array.isArray(row.points) && row.points.length >= 2) {
        const trail: [number, number][] = row.points
          .map((p: any) => [p.lat, p.lon] as [number, number])
          .filter(
            (p: [number, number]) =>
              p[0] != null &&
              p[1] != null &&
              isFinite(p[0]) &&
              isFinite(p[1])
          );
        if (trail.length >= 2) {
          polylines.push({ points: trail, color: "#f97316" });
          allPoints.push(...trail);
          markers.push({
            lat: trail[0][0],
            lon: trail[0][1],
            label: plate,
            icon: ICON_GREEN,
            popup: `<b>${plate}</b><br/>Start: ${fmtTimestamp(row.startTime)}<br/>Distance: ${row.distanceKm ?? "—"} km`,
          });
          markers.push({
            lat: trail[trail.length - 1][0],
            lon: trail[trail.length - 1][1],
            label: "",
            icon: ICON_RED,
            popup: `<b>${plate}</b><br/>End: ${fmtTimestamp(row.endTime)}`,
          });
        }
        continue;
      }

      // Single point reports (events, violations, etc.)
      const lat = fmtCoord(row.latitude ?? row.startLat);
      const lon = fmtCoord(row.longitude ?? row.startLon);
      if (lat != null && lon != null) {
        allPoints.push([lat, lon]);
        const parts = [`<b>${plate}</b>`];
        if (row.eventType) parts.push(`Event: ${row.eventType}`);
        if (row.speed != null) parts.push(`Speed: ${Number(row.speed).toFixed(1)} km/h`);
        if (row.timestamp) parts.push(`Time: ${fmtTimestamp(row.timestamp)}`);
        if (row.startedAt) parts.push(`Start: ${fmtTimestamp(row.startedAt)}`);
        if (row.geofenceName) parts.push(`Geofence: ${row.geofenceName}`);
        markers.push({
          lat,
          lon,
          label: plate,
          icon: ICON_BLUE,
          popup: parts.join("<br/>"),
        });
      }
    }

    const center: [number, number] =
      allPoints.length > 0
        ? allPoints[Math.floor(allPoints.length / 2)]
        : [28.6139, 77.209];

    return { markers, polylines, center };
  }, [data]);

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="h-full w-full rounded-lg"
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
      />
      {markers.length > 0 && (
        <FitBounds points={markers.map((m) => [m.lat, m.lon])} />
      )}
      {polylines.map((pl, i) => (
        <Polyline
          key={i}
          positions={pl.points}
          pathOptions={{ color: pl.color, weight: 4, opacity: 0.9 }}
        />
      ))}
      {markers.map((m, i) => (
        <Marker key={i} position={[m.lat, m.lon]} icon={m.icon}>
          <Popup>
            <div
              className="text-sm"
              dangerouslySetInnerHTML={{ __html: m.popup }}
            />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
