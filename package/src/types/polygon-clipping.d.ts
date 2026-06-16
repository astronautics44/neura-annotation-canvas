declare module "polygon-clipping" {
  type Ring = [number, number][];
  type Polygon = Ring[];
  type MultiPolygon = Polygon[];

  export function union(...geoms: MultiPolygon[]): MultiPolygon;
  export function intersection(...geoms: MultiPolygon[]): MultiPolygon;
  export function difference(
    subject: MultiPolygon,
    ...clips: MultiPolygon[]
  ): MultiPolygon;
  export function xor(...geoms: MultiPolygon[]): MultiPolygon;
}
