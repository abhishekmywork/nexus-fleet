"use client";

import { Circle, Polygon } from "react-leaflet";
import type { Geofence } from "@/lib/auth-types";

interface GeofenceOverlayProps {
  geofences: Geofence[];
}

export function GeofenceOverlay({ geofences }: GeofenceOverlayProps) {
  return (
    <>
      {geofences
        .filter((gf) => gf.enabled)
        .map((gf) => {
          if (gf.type === "circle") {
            const center = gf.coordinates?.center;
            const radius = gf.coordinates?.radiusMeters;
            if (!center || !radius) return null;
            return (
              <Circle
                key={gf.id}
                center={[center.lat, center.lon]}
                radius={radius}
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.1,
                  weight: 2,
                }}
              >
              </Circle>
            );
          }

          if (gf.type === "polygon") {
            const points = gf.coordinates?.points;
            if (!points || !Array.isArray(points) || points.length < 3) return null;
            return (
              <Polygon
                key={gf.id}
                positions={points.map((p: { lat: number; lon: number }) => [p.lat, p.lon])}
                pathOptions={{
                  color: "#8b5cf6",
                  fillColor: "#8b5cf6",
                  fillOpacity: 0.1,
                  weight: 2,
                }}
              >
              </Polygon>
            );
          }

          return null;
        })}
    </>
  );
}
