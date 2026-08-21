"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { LivePosition } from "./use-live-map";

interface AnimatedVehicle {
  lat: number;
  lng: number;
  heading: number;
  speed: number | null;
  movement: string | null;
  plateNumber: string | null;
  timestamp: string;
}

interface VehicleState {
  prevLat: number;
  prevLng: number;
  prevHeading: number;
  targetLat: number;
  targetLng: number;
  targetHeading: number;
  speed: number | null;
  movement: string | null;
  plateNumber: string | null;
  timestamp: string;
  receivedAt: number;
  firstReceivedAt: number;
}

const STALE_MS = 30000;
const EASE_POWER = 2;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function ease(t: number): number {
  return t < 1 ? 1 - Math.pow(1 - t, EASE_POWER) : 1;
}

function calcBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function normalizeHeading(from: number, to: number): number {
  let diff = to - from;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return from + diff;
}

export function useVehicleAnimation(positions: Map<string, LivePosition>) {
  const statesRef = useRef<Map<string, VehicleState>>(new Map());
  const [animated, setAnimated] = useState<Map<string, AnimatedVehicle>>(
    new Map()
  );
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  const updateTargets = useCallback(() => {
    const now = Date.now();
    for (const [id, pos] of positions) {
      const lat =
        pos.latitudeCleaned != null ? pos.latitudeCleaned : pos.latitude;
      const lng =
        pos.longitudeCleaned != null ? pos.longitudeCleaned : pos.longitude;
      const hdg = pos.heading ?? 0;

      const existing = statesRef.current.get(id);
      if (!existing) {
        statesRef.current.set(id, {
          prevLat: lat,
          prevLng: lng,
          prevHeading: hdg,
          targetLat: lat,
          targetLng: lng,
          targetHeading: hdg,
          speed: pos.speed,
          movement: pos.movement,
          plateNumber: pos.plateNumber,
          timestamp: pos.timestamp,
          receivedAt: now,
          firstReceivedAt: now,
        });
      } else {
        existing.prevLat = existing.targetLat;
        existing.prevLng = existing.targetLng;
        existing.prevHeading = normalizeHeading(
          existing.prevHeading,
          existing.targetHeading
        );
        existing.targetLat = lat;
        existing.targetLng = lng;
        // Use device heading if available, otherwise compute from position delta
        if (pos.heading != null && pos.heading !== 0) {
          existing.targetHeading = hdg;
        } else {
          const dist = Math.hypot(lat - existing.prevLat, lng - existing.prevLng);
          if (dist > 0.00001) {
            existing.targetHeading = calcBearing(
              existing.prevLat, existing.prevLng, lat, lng
            );
          }
        }
        existing.speed = pos.speed;
        existing.movement = pos.movement;
        existing.plateNumber = pos.plateNumber;
        existing.timestamp = pos.timestamp;
        existing.receivedAt = now;
      }
    }
  }, [positions]);

  useEffect(() => {
    updateTargets();
  }, [updateTargets]);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!lastFrameRef.current) lastFrameRef.current = timestamp;
      lastFrameRef.current = timestamp;
      const now = Date.now();

      const next = new Map<string, AnimatedVehicle>();

      for (const [id, state] of statesRef.current) {
        const elapsed = now - state.receivedAt;
        const isStale = elapsed > STALE_MS;

        if (isStale) {
          next.set(id, {
            lat: state.targetLat,
            lng: state.targetLng,
            heading: state.targetHeading,
            speed: state.speed,
            movement: state.movement,
            plateNumber: state.plateNumber,
            timestamp: state.timestamp,
          });
          continue;
        }

        const rawT = Math.min(elapsed / 5000, 1);
        const t = ease(rawT);

        const lat = lerp(state.prevLat, state.targetLat, t);
        const lng = lerp(state.prevLng, state.targetLng, t);
        const heading = normalizeHeading(
          state.prevHeading,
          state.targetHeading
        );

        next.set(id, {
          lat,
          lng,
          heading: lerp(state.prevHeading, heading, t),
          speed: state.speed,
          movement: state.movement,
          plateNumber: state.plateNumber,
          timestamp: state.timestamp,
        });
      }

      setAnimated(next);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return animated;
}
