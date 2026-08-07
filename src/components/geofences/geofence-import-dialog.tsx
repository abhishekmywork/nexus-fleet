"use client";

import * as React from "react";
import { FileUp, Loader2, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface GeofenceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

const ACCEPT = ".geojson,.json,.kml,.zip";
const FORMATS = [
  { ext: ".geojson / .json", desc: "GeoJSON Feature or FeatureCollection" },
  { ext: ".kml", desc: "Google Earth KML file" },
  { ext: ".zip", desc: "ESRI Shapefile (shp + dbf + shx + prj)" },
];

export function GeofenceImportDialog({
  open,
  onOpenChange,
  onImported,
}: GeofenceImportDialogProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setImporting(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const res = await api.geofences.import(file);
      setResult({
        imported: res.imported.length,
        skipped: res.skipped,
        errors: res.errors,
      });
      if (res.imported.length > 0) {
        toast.success(`Imported ${res.imported.length} geofence(s)`);
      }
      if (res.errors.length > 0) {
        toast.warning(`${res.errors.length} feature(s) had errors`);
      }
      if (res.imported.length > 0) {
        onImported();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import geofences from file</DialogTitle>
          <DialogDescription>
            Upload a GeoJSON, KML, or Shapefile to create geofences. Each polygon
            becomes a separate geofence.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Drop zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
          >
            {file ? (
              <>
                <FileUp className="size-8 text-primary" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setResult(null);
                  }}
                >
                  <X className="mr-1 size-3" />
                  Remove
                </Button>
              </>
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    Drop a file here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    GeoJSON, KML, or Shapefile ZIP
                  </p>
                </div>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Supported formats */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Supported formats
            </p>
            <div className="grid gap-1">
              {FORMATS.map((f) => (
                <div
                  key={f.ext}
                  className="flex items-center gap-2 text-xs"
                >
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                    {f.ext}
                  </code>
                  <span className="text-muted-foreground">{f.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">Import results</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Imported: </span>
                  <span className="font-medium">{result.imported}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Skipped: </span>
                  <span className="font-medium">{result.skipped}</span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-destructive">Errors</p>
                  <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="mr-2 size-4" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
