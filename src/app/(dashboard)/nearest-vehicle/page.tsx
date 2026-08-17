"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Crosshair, MapPin, Clock, Loader2, Navigation } from "lucide-react";

type Vehicle = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  heading: number | null;
  lastSeen: string | null;
};

type NearestResult = {
  vehicle: { id: string; plateNumber: string; make: string; model: string };
  distance_km: number;
  duration_min: number;
  latitude: number;
  longitude: number;
};

function createMarkerIcon(color: string, label?: string) {
  const L = require("leaflet");
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
      <div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>
      </div>
      ${label ? `<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);white-space:nowrap;background:white;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${label}</div>` : ""}
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const ICON_REF = createMarkerIcon("#ef4444", "REF");
const ICON_NEAREST = createMarkerIcon("#22c55e");

export default function NearestVehiclePage() {
  const [allVehicles, setAllVehicles] = React.useState<Vehicle[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [reference, setReference] = React.useState<any>(null);
  const [results, setResults] = React.useState<NearestResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [vehiclesLoading, setVehiclesLoading] = React.useState(true);
  const mapRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);

  // Load all vehicles with positions
  React.useEffect(() => {
    const fetchVehicles = async () => {
      try {
        // Use dashboard vehicle positions endpoint
        const data = await api.dashboard.vehiclePositions();
        setAllVehicles(data.filter((v: any) => v.latitude && v.longitude));
      } catch {
        // fallback
      } finally {
        setVehiclesLoading(false);
      }
    };
    fetchVehicles();
  }, []);

  const handleSearch = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const data = await api.nearestVehicle.find(selectedId);
      setReference(data.reference);
      setResults(data.results);
      updateMap(data.reference, data.results);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const updateMap = (ref: any, res: NearestResult[]) => {
    if (!mapRef.current || !ref) return;
    const L = require("leaflet");
    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    // Reference marker
    const refMarker = L.marker([ref.latitude, ref.longitude], { icon: ICON_REF }).addTo(map);
    markersRef.current.push(refMarker);

    // Result markers
    res.forEach((r) => {
      const m = L.marker([r.latitude, r.longitude], { icon: ICON_NEAREST }).addTo(map);
      markersRef.current.push(m);
    });

    // Fit bounds
    const allPoints = [
      [ref.latitude, ref.longitude],
      ...res.map((r) => [r.latitude, r.longitude]),
    ];
    if (allPoints.length > 1) {
      map.fitBounds(allPoints, { padding: [40, 40] });
    } else {
      map.setView([ref.latitude, ref.longitude], 14);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nearest Vehicle Finder</h1>
        <p className="text-muted-foreground">Select a vehicle to find the nearest others by road distance</p>
      </div>

      {/* Vehicle Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Crosshair className="size-5" />
            Select Reference Vehicle
          </CardTitle>
          <CardDescription>Choose a vehicle to measure distances from</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Select
              value={selectedId}
              onValueChange={setSelectedId}
              disabled={vehiclesLoading}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={vehiclesLoading ? "Loading vehicles..." : "Select a vehicle"} />
              </SelectTrigger>
              <SelectContent>
                {allVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.plateNumber} — {v.make} {v.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={handleSearch}
              disabled={!selectedId || loading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
              Find Nearest
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Results ({results.length} vehicles)</CardTitle>
              <CardDescription>
                Sorted by road distance from {reference?.plateNumber}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="text-right">Distance</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, i) => (
                      <TableRow key={r.vehicle.id}>
                        <TableCell className="font-medium">
                          <Badge variant={i < 3 ? "default" : "secondary"} className="w-6 justify-center">
                            {i + 1}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{r.vehicle.plateNumber}</p>
                            <p className="text-xs text-muted-foreground">{r.vehicle.make} {r.vehicle.model}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {r.distance_km} km
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {r.duration_min > 0 ? `${r.duration_min} min` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Map */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="size-5" />
                Map View
              </CardTitle>
              <CardDescription>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-full bg-red-500" /> Reference
                </span>
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-full bg-green-500" /> Nearest
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] overflow-hidden rounded-lg border">
                <NearestMapInner ref={mapRef} center={reference} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && selectedId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Crosshair className="mb-3 size-10 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No other vehicles with positions found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Inner map component using dynamic import
const NearestMapInner = React.forwardRef<any, { center: any }>(
  function NearestMapInner({ center }, ref) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const mapInstanceRef = React.useRef<any>(null);

    React.useEffect(() => {
      if (!containerRef.current || mapInstanceRef.current) return;

      const init = async () => {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");

        const map = L.map(containerRef.current!, {
          center: center
            ? [center.latitude, center.longitude]
            : [22.5, 88.3],
          zoom: 12,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
        if (typeof ref === "object" && ref) ref.current = map;
      };

      init();

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }, []);

    return <div ref={containerRef} className="h-full w-full" />;
  }
);
