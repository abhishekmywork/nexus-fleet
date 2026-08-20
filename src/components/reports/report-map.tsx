"use client";

import * as React from "react";
import {
  Map,
  useMap,
  AdvancedMarker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import type { Column } from "./report-shell";

function fmtCoord(val: any): number | null {
  const n = Number(val);
  if (!n || !isFinite(n)) return null;
  return n;
}

function fmtTimestamp(val?: string): string {
  return val ? new Date(val).toLocaleString() : "—";
}

function MarkerIcon({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: color,
        border: "2px solid #fff",
        boxShadow: "0 1px 4px rgba(0,0,0,.4)",
      }}
    />
  );
}

const COLOR_BLUE = "#3b82f6";
const COLOR_GREEN = "#22c55e";
const COLOR_RED = "#ef4444";

interface MarkerData {
  lat: number;
  lon: number;
  label: string;
  color: string;
  popupHtml: string;
}

interface PolylineData {
  points: [number, number][];
  color: string;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (!map || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const [lat, lng] of points) {
      bounds.extend({ lat, lng });
    }
    map.fitBounds(bounds, 40);
  }, [points, map]);
  return null;
}

function TripTrails({
  polylines,
}: {
  polylines: PolylineData[];
}) {
  const map = useMap();
  const polylinesRef = React.useRef<google.maps.Polyline[]>([]);

  React.useEffect(() => {
    if (!map) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    for (const pl of polylines) {
      const path = pl.points.map(([lat, lng]) => ({ lat, lng }));
      const polyline = new google.maps.Polyline({
        path,
        map,
        strokeColor: pl.color,
        strokeWeight: 4,
        strokeOpacity: 0.9,
      });
      polylinesRef.current.push(polyline);
    }

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, polylines]);

  return null;
}

interface ReportMapProps {
  data: any[];
  columns: Column[];
}

export function ReportMap({ data, columns }: ReportMapProps) {
  const [openInfoWindow, setOpenInfoWindow] = React.useState<number | null>(
    null
  );

  const { markers, polylines, center } = React.useMemo(() => {
    const markers: MarkerData[] = [];
    const polylines: PolylineData[] = [];
    const allPoints: [number, number][] = [];

    for (const row of data) {
      const plate = row.plateNumber ?? "Unknown";

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
            color: COLOR_GREEN,
            popupHtml: `<b>${plate}</b><br/>Start: ${fmtTimestamp(row.startTime)}<br/>Distance: ${row.distanceKm ?? "—"} km`,
          });
          markers.push({
            lat: trail[trail.length - 1][0],
            lon: trail[trail.length - 1][1],
            label: "",
            color: COLOR_RED,
            popupHtml: `<b>${plate}</b><br/>End: ${fmtTimestamp(row.endTime)}`,
          });
        }
        continue;
      }

      const lat = fmtCoord(row.latitude ?? row.startLat);
      const lon = fmtCoord(row.longitude ?? row.startLon);
      if (lat != null && lon != null) {
        allPoints.push([lat, lon]);
        const parts = [`<b>${plate}</b>`];
        if (row.eventType) parts.push(`Event: ${row.eventType}`);
        if (row.speed != null)
          parts.push(`Speed: ${Number(row.speed).toFixed(1)} km/h`);
        if (row.timestamp) parts.push(`Time: ${fmtTimestamp(row.timestamp)}`);
        if (row.startedAt)
          parts.push(`Start: ${fmtTimestamp(row.startedAt)}`);
        if (row.geofenceName)
          parts.push(`Geofence: ${row.geofenceName}`);
        markers.push({
          lat,
          lon,
          label: plate,
          color: COLOR_BLUE,
          popupHtml: parts.join("<br/>"),
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
    <Map
      defaultCenter={{ lat: center[0], lng: center[1] }}
      defaultZoom={12}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
      gestureHandling="greedy"
      disableDefaultUI={true}
      style={{ width: "100%", height: "100%" }}
      className="rounded-lg"
    >
      {markers.length > 0 && (
        <FitBounds points={markers.map((m) => [m.lat, m.lon])} />
      )}

      <TripTrails polylines={polylines} />

      {markers.map((m, i) => (
        <AdvancedMarker
          key={i}
          position={{ lat: m.lat, lng: m.lon }}
          title={m.label}
          onClick={() => setOpenInfoWindow(i)}
        >
          <MarkerIcon color={m.color} />
          {openInfoWindow === i && (
            <InfoWindow
              position={{ lat: m.lat, lng: m.lon }}
              onCloseClick={() => setOpenInfoWindow(null)}
            >
              <div
                className="text-sm"
                dangerouslySetInnerHTML={{ __html: m.popupHtml }}
              />
            </InfoWindow>
          )}
        </AdvancedMarker>
      ))}
    </Map>
  );
}
