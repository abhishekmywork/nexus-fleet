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
import { Map, useMap, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";

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

type MapStyle = "streets" | "satellite" | "terrain";

const MAP_TYPE_MAP: Record<MapStyle, google.maps.MapTypeId> = {
  streets: google.maps.MapTypeId.ROADMAP,
  satellite: google.maps.MapTypeId.SATELLITE,
  terrain: google.maps.MapTypeId.TERRAIN,
};

const MAP_STYLE_LABELS: Record<MapStyle, string> = {
  streets: "Streets",
  satellite: "Satellite",
  terrain: "Terrain",
};

function MarkerIcon({ color, isRef }: { color: string; isRef: boolean }) {
  const size = isRef ? 32 : 26;
  const circleR = isRef ? 16 : 13;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          border: "3px solid white",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        <svg
          width={isRef ? 16 : 12}
          height={isRef ? 16 : 12}
          viewBox="0 0 24 24"
          fill="white"
          stroke="white"
          strokeWidth={2}
        >
          <circle cx={12} cy={12} r={4} />
        </svg>
      </div>
    </div>
  );
}

function MarkerLabel({
  plate,
  model,
  distanceKm,
  isRef,
  color,
}: {
  plate: string;
  model: string;
  distanceKm: number;
  isRef: boolean;
  color: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: -62,
        left: "50%",
        transform: "translateX(-50%)",
        whiteSpace: "nowrap",
        background: isRef ? "#fef2f2" : "#f0fdf4",
        border: `1px solid ${isRef ? "#fca5a5" : "#86efac"}`,
        padding: "3px 8px",
        borderRadius: 6,
        fontSize: 11,
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color,
          fontSize: 12,
        }}
      >
        {plate}
      </div>
      <div style={{ color: "#555", fontSize: 10 }}>{model}</div>
      <div style={{ color: "#777", fontSize: 10, marginTop: 1 }}>
        {distanceKm} km{isRef ? " (reference)" : ""}
      </div>
    </div>
  );
}

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (!map || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const p of points) {
      bounds.extend(p);
    }
    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(14);
    } else {
      map.fitBounds(bounds, 50);
    }
  }, [points, map]);
  return null;
}

function MapTypeController({ mapStyle }: { mapStyle: MapStyle }) {
  const map = useMap();
  React.useEffect(() => {
    if (map) map.setMapTypeId(MAP_TYPE_MAP[mapStyle]);
  }, [mapStyle, map]);
  return null;
}

export default function NearestVehiclePage() {
  const [allVehicles, setAllVehicles] = React.useState<Vehicle[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [reference, setReference] = React.useState<Reference | null>(null);
  const [results, setResults] = React.useState<NearestResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [vehiclesLoading, setVehiclesLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [mapStyle, setMapStyle] = React.useState<MapStyle>("streets");
  const [openInfoWindow, setOpenInfoWindow] = React.useState<string | null>(null);

  const fitPoints = React.useMemo(() => {
    if (!reference) return [];
    const points: { lat: number; lng: number }[] = [
      { lat: reference.latitude, lng: reference.longitude },
    ];
    for (const r of results) {
      points.push({ lat: r.latitude, lng: r.longitude });
    }
    return points;
  }, [reference, results]);

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
      setOpenInfoWindow(null);
    } catch (err: any) {
      const msg = err?.message || "Failed to find nearest vehicles";
      setError(msg);
      setReference(null);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const defaultCenter = reference
    ? { lat: reference.latitude, lng: reference.longitude }
    : { lat: 22.5, lng: 88.3 };

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
                <Select value={mapStyle} onValueChange={(v) => setMapStyle(v as MapStyle)}>
                  <SelectTrigger className="w-[130px]">
                    <Layers className="size-3.5 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MAP_TYPE_MAP) as MapStyle[]).map((key) => (
                      <SelectItem key={key} value={key}>{MAP_STYLE_LABELS[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] overflow-hidden rounded-lg border">
                <Map
                  defaultCenter={defaultCenter}
                  defaultZoom={12}
                  mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
                  gestureHandling="greedy"
                  disableDefaultUI={true}
                  style={{ width: "100%", height: "100%" }}
                >
                  <MapTypeController mapStyle={mapStyle} />

                  {fitPoints.length > 0 && <FitBounds points={fitPoints} />}

                  {reference && (
                    <AdvancedMarker
                      position={{
                        lat: reference.latitude,
                        lng: reference.longitude,
                      }}
                      onClick={() => setOpenInfoWindow(`ref-${reference.id}`)}
                    >
                      <div style={{ position: "relative" }}>
                        <MarkerLabel
                          plate={reference.plateNumber}
                          model={`${reference.make} ${reference.model}`}
                          distanceKm={0}
                          isRef
                          color="#dc2626"
                        />
                        <MarkerIcon color="#ef4444" isRef />
                      </div>
                      {openInfoWindow === `ref-${reference.id}` && (
                        <InfoWindow
                          position={{
                            lat: reference.latitude,
                            lng: reference.longitude,
                          }}
                          onCloseClick={() => setOpenInfoWindow(null)}
                        >
                          <div className="text-sm">
                            <p className="font-bold">{reference.plateNumber}</p>
                            <p>{reference.make} {reference.model}</p>
                            <p className="text-muted-foreground">Reference vehicle</p>
                          </div>
                        </InfoWindow>
                      )}
                    </AdvancedMarker>
                  )}

                  {results.map((r) => {
                    const key = `result-${r.vehicle.id}`;
                    return (
                      <AdvancedMarker
                        key={r.vehicle.id}
                        position={{
                          lat: r.latitude,
                          lng: r.longitude,
                        }}
                        onClick={() => setOpenInfoWindow(key)}
                      >
                        <div style={{ position: "relative" }}>
                          <MarkerLabel
                            plate={r.vehicle.plateNumber}
                            model={`${r.vehicle.make} ${r.vehicle.model}`}
                            distanceKm={r.distance_km}
                            isRef={false}
                            color="#16a34a"
                          />
                          <MarkerIcon color="#22c55e" isRef={false} />
                        </div>
                        {openInfoWindow === key && (
                          <InfoWindow
                            position={{
                              lat: r.latitude,
                              lng: r.longitude,
                            }}
                            onCloseClick={() => setOpenInfoWindow(null)}
                          >
                            <div className="text-sm">
                              <p className="font-bold">{r.vehicle.plateNumber}</p>
                              <p>{r.vehicle.make} {r.vehicle.model}</p>
                              <p>Distance: {r.distance_km} km</p>
                              <p>Duration: {r.duration_min > 0 ? `${r.duration_min} min` : "—"}</p>
                            </div>
                          </InfoWindow>
                        )}
                      </AdvancedMarker>
                    );
                  })}
                </Map>
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
