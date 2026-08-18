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
import { Crosshair, MapPin, Clock, Loader2, Navigation, AlertCircle, Layers } from "lucide-react";

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

type Reference = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  latitude: number;
  longitude: number;
};

type NearestResult = {
  vehicle: { id: string; plateNumber: string; make: string; model: string };
  distance_km: number;
  duration_min: number;
  latitude: number;
  longitude: number;
};

const TILE_LAYERS = {
  streets: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", label: "Streets" },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", label: "Satellite" },
  terrain: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", label: "Terrain" },
} as const;

type MapStyle = keyof typeof TILE_LAYERS;

function createDetailedMarkerIcon(color: string, plate: string, model: string, distanceKm: number, isRef: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require("leaflet");
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer">
      <div style="position:absolute;top:-58px;left:50%;transform:translateX(-50%);white-space:nowrap;background:${isRef ? '#fef2f2' : '#f0fdf4'};border:1px solid ${isRef ? '#fca5a5' : '#86efac'};padding:3px 8px;border-radius:6px;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.15);pointer-events:none">
        <div style="font-weight:700;color:${isRef ? '#dc2626' : '#16a34a'};font-size:12px">${plate}</div>
        <div style="color:#555;font-size:10px">${model}</div>
        <div style="color:#777;font-size:10px;margin-top:1px">${distanceKm} km${isRef ? ' (reference)' : ''}</div>
      </div>
      <div style="width:${isRef ? 32 : 26}px;height:${isRef ? 32 : 26}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:1">
        <svg width="${isRef ? 16 : 12}" height="${isRef ? 16 : 12}" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>
      </div>
    </div>`,
    iconSize: [isRef ? 32 : 26, isRef ? 32 : 26],
    iconAnchor: [isRef ? 16 : 13, isRef ? 16 : 13],
  });
}

export default function NearestVehiclePage() {
  const [allVehicles, setAllVehicles] = React.useState<Vehicle[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [reference, setReference] = React.useState<Reference | null>(null);
  const [results, setResults] = React.useState<NearestResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [vehiclesLoading, setVehiclesLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [iconsReady, setIconsReady] = React.useState(false);
  const [mapStyle, setMapStyle] = React.useState<MapStyle>("streets");
  const mapRef = React.useRef<any>(null);
  const tileLayerRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);

  React.useEffect(() => {
    setIconsReady(true);
  }, []);

  React.useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const data = await api.dashboard.vehiclePositions();
        setAllVehicles(data.filter((v: Vehicle) => v.latitude && v.longitude));
      } catch {
        setError("Failed to load vehicles. Please try again.");
      } finally {
        setVehiclesLoading(false);
      }
    };
    fetchVehicles();
  }, []);

  const handleSearch = async () => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.nearestVehicle.find(selectedId);
      setReference(data.reference);
      setResults(data.results);
      updateMap(data.reference, data.results);
    } catch (err: any) {
      const msg = err?.message || "Failed to find nearest vehicles";
      setError(msg);
      setReference(null);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMapStyleChange = (style: MapStyle) => {
    setMapStyle(style);
    if (mapRef.current && tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const L = require("leaflet");
      tileLayerRef.current = L.tileLayer(TILE_LAYERS[style].url, {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapRef.current);
    }
  };

  const updateMap = (ref: Reference | null, res: NearestResult[]) => {
    if (!mapRef.current || !ref) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet");
    const map = mapRef.current;

    markersRef.current.forEach((m: any) => map.removeLayer(m));
    markersRef.current = [];

    const refIcon = createDetailedMarkerIcon("#ef4444", ref.plateNumber, `${ref.make} ${ref.model}`, 0, true);
    const refMarker = L.marker([ref.latitude, ref.longitude], { icon: refIcon }).addTo(map);
    markersRef.current.push(refMarker);

    res.forEach((r) => {
      const icon = createDetailedMarkerIcon("#22c55e", r.vehicle.plateNumber, `${r.vehicle.make} ${r.vehicle.model}`, r.distance_km, false);
      const m = L.marker([r.latitude, r.longitude], { icon }).addTo(map);
      markersRef.current.push(m);
    });

    const allPoints: [number, number][] = [
      [ref.latitude, ref.longitude],
      ...res.map((r) => [r.latitude, r.longitude] as [number, number]),
    ];
    if (allPoints.length > 1) {
      map.fitBounds(allPoints, { padding: [50, 50] });
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

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertCircle className="size-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

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

      {results.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
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

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="size-5" />
                    Map View
                  </CardTitle>
                  <CardDescription className="mt-1">
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block size-2.5 rounded-full bg-red-500" /> Reference
                    </span>
                    {" · "}
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block size-2.5 rounded-full bg-green-500" /> Nearest
                    </span>
                  </CardDescription>
                </div>
                <Select value={mapStyle} onValueChange={(v) => handleMapStyleChange(v as MapStyle)}>
                  <SelectTrigger className="w-[130px]">
                    <Layers className="size-3.5 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TILE_LAYERS).map(([key, layer]) => (
                      <SelectItem key={key} value={key}>{layer.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] overflow-hidden rounded-lg border">
                {iconsReady && (
                  <NearestMapInner
                    ref={mapRef}
                    center={reference}
                    mapStyle={mapStyle}
                    onTileLayerRef={(tl: any) => { tileLayerRef.current = tl; }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && results.length === 0 && selectedId && !error && (
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

const NearestMapInner = React.forwardRef<any, { center: Reference | null; mapStyle: MapStyle; onTileLayerRef: (tl: any) => void }>(
  function NearestMapInner({ center, mapStyle, onTileLayerRef }, ref) {
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

        const tl = L.tileLayer(TILE_LAYERS[mapStyle].url, {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        onTileLayerRef(tl);
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
