"use client";

import * as React from "react";
import { AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";

interface VehicleMarkerProps {
  lat: number;
  lng: number;
  heading: number;
  speed: number | null;
  movement: string | null;
  plateNumber: string | null;
  timestamp: string;
  isSelected: boolean;
  onClick: () => void;
}

function formatSpeed(speed: number | null): string {
  if (speed == null) return "N/A";
  return `${parseFloat(speed.toFixed(1))} km/h`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

export const VehicleMarker = React.memo(function VehicleMarker({
  lat,
  lng,
  heading,
  speed,
  movement,
  plateNumber,
  timestamp,
  isSelected,
  onClick,
}: VehicleMarkerProps) {
  const [showInfo, setShowInfo] = React.useState(false);

  // Override: if speed is 0 or null, vehicle is not moving regardless of device's movement field
  // Coerce speed to number to handle string values from GPS protocols
  const numSpeed = speed != null ? Number(speed) : null;
  const effectiveMovement =
    (numSpeed != null && numSpeed > 0) ? movement : (movement === "MOVING" ? "IDLE" : movement);

  const color =
    effectiveMovement === "MOVING"
      ? "#22c55e"
      : effectiveMovement === "IDLE"
        ? "#10b981"
        : "#64748b";

  const glow =
    effectiveMovement === "MOVING"
      ? "rgba(34,197,94,0.5)"
      : effectiveMovement === "IDLE"
        ? "rgba(16,185,129,0.4)"
        : "rgba(100,116,139,0.3)";

  const handleClick = React.useCallback(() => {
    setShowInfo(true);
    onClick();
  }, [onClick]);

  const handleClose = React.useCallback(() => {
    setShowInfo(false);
  }, []);

  return (
    <AdvancedMarker
      position={{ lat, lng }}
      onClick={handleClick}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          cursor: "pointer",
        }}
        title={plateNumber ?? "Unknown"}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          style={{
            transform: `rotate(${heading}deg)`,
            filter: `drop-shadow(0 0 6px ${glow})`,
            transition: "filter 0.3s",
          }}
        >
          {/* wheels */}
          <rect x="6" y="4" width="3" height="4" rx="1" fill="#1f2937" />
          <rect x="23" y="4" width="3" height="4" rx="1" fill="#1f2937" />
          <rect x="6" y="24" width="3" height="4" rx="1" fill="#1f2937" />
          <rect x="23" y="24" width="3" height="4" rx="1" fill="#1f2937" />
          {/* body */}
          <rect x="8" y="3" width="16" height="26" rx="6" fill={color} stroke="#fff" strokeWidth="1.2" />
          {/* windshield */}
          <rect x="10.5" y="6" width="11" height="8" rx="3" fill="rgba(255,255,255,0.3)" />
          {/* rear window */}
          <rect x="10.5" y="19" width="11" height="6" rx="2.5" fill="rgba(255,255,255,0.2)" />
          {/* direction indicator (front dot) */}
          <circle cx="16" cy="4" r="1.5" fill="#fff" opacity="0.8" />
        </svg>
        {plateNumber && (
          <span
            style={{
              position: "absolute",
              top: -18,
              left: "50%",
              transform: "translateX(-50%)",
              background: color,
              color: "#fff",
              fontSize: "8px",
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: "3px",
              whiteSpace: "nowrap",
              letterSpacing: "0.3px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              pointerEvents: "none",
            }}
          >
            {plateNumber}
          </span>
        )}
      </div>
      {showInfo && (
        <InfoWindow
          position={{ lat, lng }}
          onCloseClick={handleClose}
        >
          <div
            style={{
              minWidth: 170,
              fontSize: 13,
              lineHeight: 1.6,
              color: "#1f2937",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 4,
                color: "#111827",
              }}
            >
              {plateNumber ?? "Unknown"}
            </div>
            <div>
              <span style={{ color: "#6b7280" }}>Speed: </span>
              <span style={{ fontWeight: 600 }}>{formatSpeed(speed)}</span>
            </div>
            <div>
              <span style={{ color: "#6b7280" }}>Status: </span>
              <span style={{ fontWeight: 600, color }}>{effectiveMovement ?? "N/A"}</span>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
              {formatTimestamp(timestamp)}
            </div>
          </div>
        </InfoWindow>
      )}
    </AdvancedMarker>
  );
});
