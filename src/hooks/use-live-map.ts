"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const WS_URL = API_BASE.replace("/api", "");

export interface LivePosition {
  deviceId: string;
  imei: string;
  vehicleId: string | null;
  plateNumber: string | null;
  make: string | null;
  model: string | null;
  status: string | null;
  latitude: number;
  longitude: number;
  latitudeCleaned: number | null;
  longitudeCleaned: number | null;
  speed: number | null;
  heading: number | null;
  ignition: string | null;
  movement: string | null;
  odometerKm: number | null;
  batteryV: number | null;
  gsmSignal: number | null;
  timestamp: string;
}

export function useLiveMap(token: string) {
  const [positions, setPositions] = useState<Map<string, LivePosition>>(new Map());
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const socket = io(`${WS_URL}/live-map`, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("positions:initial", (items: LivePosition[]) => {
      setPositions((prev) => {
        const next = new Map(prev);
        for (const item of items) {
          next.set(item.deviceId, item);
        }
        return next;
      });
    });

    socket.on("position:update", (payload: LivePosition) => {
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(payload.deviceId, payload);
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const setInitialPositions = useCallback((items: LivePosition[]) => {
    setPositions((prev) => {
      const next = new Map(prev);
      for (const item of items) {
        if (!next.has(item.deviceId)) {
          next.set(item.deviceId, item);
        }
      }
      return next;
    });
  }, []);

  return { positions, connected, setInitialPositions };
}
