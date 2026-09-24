declare module "d3-geo" {
  export type GeoPermissibleObjects = object;
  export type GeoProjection = {
    clipAngle(angle: number): GeoProjection;
    translate(point: [number, number]): GeoProjection;
    scale(size: number): GeoProjection;
    rotate(angles: [number, number, number]): GeoProjection;
    invert?(point: [number, number]): [number, number] | null;
    (point: [number, number]): [number, number] | null;
  };
  export function geoOrthographic(): GeoProjection;
  export function geoPath(
    projection: unknown,
    context: CanvasRenderingContext2D,
  ): (object: GeoPermissibleObjects) => void;
  export function geoContains(
    object: GeoPermissibleObjects,
    point: [number, number],
  ): boolean;
}

declare module "topojson-client" {
  export type GeometryCollection<T> = { type: string; geometries: T[] };
  export function feature(
    topology: object,
    object: object,
  ): { features: { id?: string | number }[] };
}

declare module "*.geojson" {
  const value: {
    features: {
      properties: { iso2: string; name: string };
      geometry: object;
    }[];
  };
  export default value;
}
