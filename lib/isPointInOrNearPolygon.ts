import {
  Polygon as FlattenPolygon,
  type Segment,
  point,
  segment,
} from "@flatten-js/core"
import type { Point } from "./types"
import { normalizePolygonPoints } from "./normalizePolygonPoints"

/**
 * Check if a point is inside a polygon or within clearance distance of it
 */
export const isPointInOrNearPolygon = (params: {
  px: number
  py: number
  polygonPoints: Point[]
  clearance: number
}): boolean => {
  const { px, py, polygonPoints, clearance } = params
  const normalizedPoints = normalizePolygonPoints(polygonPoints)
  const n = normalizedPoints.length
  if (n < 3) return false

  // Create Flatten polygon from points using segments
  const pts = normalizedPoints.map((p) => point(p.x, p.y))
  const shapes: Segment[] = []
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i]!
    const p2 = pts[(i + 1) % pts.length]!
    shapes.push(segment(p1, p2))
  }

  const flattenPoly = new FlattenPolygon()
  flattenPoly.addFace(shapes)

  const testPoint = point(px, py)

  // Check if point is inside the polygon
  if (flattenPoly.contains(testPoint)) {
    return true
  }

  // Check distance to the polygon boundary
  const [distance] = flattenPoly.distanceTo(testPoint)
  return distance < clearance - 0.1
}
