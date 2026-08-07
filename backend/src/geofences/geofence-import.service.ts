import { Injectable, BadRequestException } from '@nestjs/common';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import * as shapefile from 'shapefile';
import * as proj4 from 'proj4';

const p4 = (proj4 as any).default ?? proj4;
p4.defs('EPSG:32645', '+proj=utm +zone=45 +datum=WGS84 +units=m +no_defs');

export interface ParsedGeofence {
  name: string;
  type: 'polygon';
  coordinates: { points: { lat: number; lon: number }[] };
  enabled: true;
}

interface GeoJSONFeature {
  type: string;
  geometry?: {
    type: string;
    coordinates: any;
  };
  properties?: Record<string, any>;
}

@Injectable()
export class GeofenceImportService {
  /**
   * Parse an uploaded file buffer into geofence polygons.
   * Supports: .geojson, .json, .kml, .zip (shapefile)
   */
  async importFile(
    buffer: Buffer,
    originalName: string,
  ): Promise<{ imported: ParsedGeofence[]; skipped: number; errors: string[] }> {
    const ext = this.getExtension(originalName);

    let features: GeoJSONFeature[];
    let errors: string[] = [];

    try {
      switch (ext) {
        case 'geojson':
        case 'json':
          features = this.parseGeoJSON(buffer);
          break;
        case 'kml':
          features = this.parseKML(buffer);
          break;
        case 'zip':
          features = await this.parseShapefile(buffer);
          break;
        default:
          throw new BadRequestException(
            `Unsupported file format "${ext}". Supported: geojson, json, kml, zip`,
          );
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Failed to parse file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const imported: ParsedGeofence[] = [];
    let skipped = 0;

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      try {
        const geofence = this.featureToGeofence(feature, i + 1);
        if (geofence) {
          imported.push(geofence);
        } else {
          skipped++;
        }
      } catch (err) {
        errors.push(
          `Feature ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { imported, skipped, errors };
  }

  private getExtension(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.geojson')) return 'geojson';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.kml')) return 'kml';
    if (lower.endsWith('.zip')) return 'zip';
    throw new BadRequestException(
      `Unrecognized file extension. Supported: .geojson, .json, .kml, .zip`,
    );
  }

  private parseGeoJSON(buffer: Buffer): GeoJSONFeature[] {
    let parsed: any;
    try {
      parsed = JSON.parse(buffer.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid JSON in GeoJSON file');
    }

    // Single Feature
    if (parsed.type === 'Feature' && parsed.geometry) {
      return [parsed];
    }

    // FeatureCollection
    if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      return parsed.features.filter(
        (f: any) => f.type === 'Feature' && f.geometry,
      );
    }

    // Bare geometry — wrap in a Feature
    if (parsed.type && parsed.coordinates) {
      return [{ type: 'Feature', geometry: parsed, properties: {} }];
    }

    throw new BadRequestException(
      'Unrecognized GeoJSON structure. Expected Feature, FeatureCollection, or bare geometry.',
    );
  }

  private parseKML(buffer: Buffer): GeoJSONFeature[] {
    const kmlString = buffer.toString('utf8');
    let dom: Document;
    try {
      dom = new DOMParser().parseFromString(kmlString, 'text/xml') as unknown as Document;
    } catch {
      throw new BadRequestException('Invalid XML in KML file');
    }

    const geojson = kml(dom as any);
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      throw new BadRequestException('No features found in KML file');
    }
    return geojson.features as GeoJSONFeature[];
  }

  private async parseShapefile(buffer: Buffer): Promise<GeoJSONFeature[]> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      throw new BadRequestException('Invalid ZIP file');
    }

    // Find .shp file (required)
    const shpFiles = zip.file(/\.shp$/i);
    if (shpFiles.length === 0) {
      throw new BadRequestException('No .shp file found in ZIP archive');
    }
    const shpEntry = shpFiles[0];

    // Find .dbf file (required)
    const dbfFiles = zip.file(/\.dbf$/i);
    if (dbfFiles.length === 0) {
      throw new BadRequestException('No .dbf file found in ZIP archive');
    }
    const dbfEntry = dbfFiles[0];

    const shpBuffer = await shpEntry.async('nodebuffer');
    const dbfBuffer = await dbfEntry.async('nodebuffer');

    const features: GeoJSONFeature[] = [];
    try {
      const source = await shapefile.open(shpBuffer, dbfBuffer);
      let result = await source.read();
      while (!result.done) {
        if (result.value) {
          features.push(result.value as GeoJSONFeature);
        }
        result = await source.read();
      }
    } catch (err) {
      throw new BadRequestException(
        `Failed to read shapefile: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (features.length === 0) {
      throw new BadRequestException('No features found in shapefile');
    }

    return features;
  }

  /**
   * Convert a GeoJSON feature into a ParsedGeofence.
   * Returns null for non-polygon geometries (skipped).
   */
  private featureToGeofence(
    feature: GeoJSONFeature,
    index: number,
  ): ParsedGeofence | null {
    const geom = feature.geometry;
    if (!geom) return null;

    const name =
      feature.properties?.name ||
      feature.properties?.Name ||
      feature.properties?.title ||
      `Imported Geofence ${index}`;

    if (geom.type === 'Polygon') {
      const points = this.extractPolygonPoints(geom.coordinates);
      if (!points) return null;
      return {
        name: String(name),
        type: 'polygon',
        coordinates: { points },
        enabled: true,
      };
    }

    if (geom.type === 'MultiPolygon') {
      // Take the largest polygon by point count from the MultiPolygon
      let bestPoints: { lat: number; lon: number }[] | null = null;
      for (const polygon of geom.coordinates) {
        const points = this.extractPolygonPoints(polygon);
        if (points && (!bestPoints || points.length > bestPoints.length)) {
          bestPoints = points;
        }
      }
      if (!bestPoints) return null;
      return {
        name: String(name),
        type: 'polygon',
        coordinates: { points: bestPoints },
        enabled: true,
      };
    }

    // Points, LineStrings, etc. — skip
    return null;
  }

  /**
   * Extract lat/lon points from GeoJSON Polygon coordinate array.
   * Takes the outer ring (index 0), ignores holes.
   * GeoJSON coordinates are [lon, lat]; our format is { lat, lon }.
   * Auto-detects projected CRS (values > 90 lat or > 180 lon) and reprojects from UTM Zone 45N.
   */
  private extractPolygonPoints(
    coordinates: number[][][],
  ): { lat: number; lon: number }[] | null {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return null;

    const ring = coordinates[0]; // outer ring
    if (!Array.isArray(ring) || ring.length < 3) return null;

    // GeoJSON uses [lon, lat]; we store as { lat, lon }
    let points = ring.map((coord) => ({
      lat: coord[1],
      lon: coord[0],
    }));

    // Detect projected CRS — if any coordinate has lat > 90 or lon > 180, reproject from UTM
    const needsReproject = points.some(
      (p) => Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180,
    );
    if (needsReproject) {
      points = points.map((p) => {
        const [x, y] = p4('EPSG:32645', 'WGS84', [p.lon, p.lat]);
        return { lat: y, lon: x };
      });
    }

    // Remove the closing point if it duplicates the first
    if (
      points.length > 1 &&
      points[0].lat === points[points.length - 1].lat &&
      points[0].lon === points[points.length - 1].lon
    ) {
      points.pop();
    }

    return points.length >= 3 ? points : null;
  }
}
