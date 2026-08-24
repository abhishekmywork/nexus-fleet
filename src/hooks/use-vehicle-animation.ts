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
}

const STALE_MS = 30000;
const LERP_DURATION_MS = 5000;
const EASE_POWER = 2;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function ease(t: number): number {
  return t < 1 ? 1 - Math.pow(1 - t, EASE_POWER) : 1;
}

function calcBearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number
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
  const [animated, setAnimated] = useState<Map<string, AnimatedVehicle>>(new Map());
  const rafRef = useRef<number>(0);
  const needsUpdateRef = useRef(false);
  const animatingRef = useRef(false);

  const updateTargets = useCallback(() => {
    const now = Date.now();
    let hasChanges = false;

    for (const [id, pos] of positions) {
      const lat = pos.latitudeCleaned ?? pos.latitude;
      const lng = pos.longitudeCleaned ?? pos.longitude;
      const hdg = pos.heading ?? 0;

      const existing = statesRef.current.get(id);
      if (!existing) {
        statesRef.current.set(id, {
          prevLat: lat, prevLng: lng, prevHeading: hdg,
          targetLat: lat, targetLng: lng, targetHeading: hdg,
          speed: pos.speed, movement: pos.movement,
          plateNumber: pos.plateNumber, timestamp: pos.timestamp,
          receivedAt: now,
        });
        hasChanges = true;
      } else {
        if (existing.targetLat !== lat || existing.targetLng !== lng) {
          existing.prevLat = existing.targetLat;
          existing.prevLng = existing.targetLng;
          existing.prevHeading = normalizeHeading(existing.prevHeading, existing.targetHeading);
          existing.targetLat = lat;
          existing.targetLng = lng;
          if (pos.heading != null && pos.heading !== 0) {
            existing.targetHeading = hdg;
          } else {
            const dist = Math.hypot(lat - existing.prevLat, lng - existing.prevLng);
            if (dist > 0.00001) {
              existing.targetHeading = calcBearing(existing.prevLat, existing.prevLng, lat, lng);
            }
          }
          existing.speed = pos.speed;
          existing.movement = pos.movement;
          existing.plateNumber = pos.plateNumber;
          existing.timestamp = pos.timestamp;
          existing.receivedAt = now;
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      needsUpdateRef.current = true;
      if (!animatingRef.current) startAnimation();
    }
  }, [positions]);

  useEffect(() => {
    updateTargets();
  }, [updateTargets]);

  const startAnimation = useCallback(() => {
    if (animatingRef.current) return;
    animatingRef.current = true;

    const animate = (timestamp: number) => {
      const now = Date.now();
      const next = new Map<string, AnimatedVehicle>();
      let stillAnimating = false;

      for (const [id, state] of statesRef.current) {
        const elapsed = now - state.receivedAt;

        if (elapsed > STALE_MS || elapsed >= LERP_DURATION_MS) {
          next.set(id, {
            lat: state.targetLat, lng: state.targetLng,
            heading: state.targetHeading,
            speed: state.speed, movement: state.movement,
            plateNumber: state.plateNumber, timestamp: state.timestamp,
          });
        } else {
          const t = ease(Math.min(elapsed / LERP_DURATION_MS, 1));
          next.set(id, {
            lat: lerp(state.prevLat, state.targetLat, t),
            lng: lerp(state.prevLng, state.targetLng, t),
            heading: lerp(state.prevHeading, normalizeHeading(state.prevHeading, state.targetHeading), t),
            speed: state.speed, movement: state.movement,
            plateNumber: state.plateNumber, timestamp: state.timestamp,
          });
          stillAnimating = true;
        }
      }

      setAnimated(next);

      if (stillAnimating || needsUpdateRef.current) {
        needsUpdateRef.current = false;
        rafRef.current = requestAnimationFrame(animate);
      } else {
        animatingRef.current = false;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      animatingRef.current = false;
    };
  }, []);

  return animated;
}
