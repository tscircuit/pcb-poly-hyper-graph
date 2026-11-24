import {
  Polygon as FlattenPolygon,
  type Line,
  ORIENTATION,
  line,
  point,
  segment,
  vector,
} from "@flatten-js/core"
import type { Point, Polygon } from "./types"
import { normalizePolygonPoints } from "./normalizePolygonPoints"

/**
 * Generate offset polygon points by offsetting each edge outward and sampling along them.
 * Uses Flatten.js for geometry operations.
 */
export const getOffsetPolygonPoints = (params: {
  polygon: Polygon
  clearance: number
  verticesOnly?: boolean
}): Point[] => {
  const { polygon, clearance, verticesOnly = false } = params
  const pts = normalizePolygonPoints(polygon.points)
  const n = pts.length
  if (n < 3) return []

  // Create Flatten polygon to determine orientation
  const flattenPoly = new FlattenPolygon(pts.map((p) => point(p.x, p.y)))
  const isCCW = flattenPoly.orientation() === ORIENTATION.CCW

  // Create offset lines for each edge
  const offsetLines: Line[] = []

  for (let i = 0; i < n; i++) {
    const p1 = pts[i]!
    const p2 = pts[(i + 1) % n]!

    // Edge direction vector
    const edgeVec = vector(p2.x - p1.x, p2.y - p1.y)
    const len = edgeVec.length

    if (len === 0) {
      // Degenerate edge, create a dummy line
      offsetLines.push(line(point(p1.x, p1.y), vector(1, 0)))
      continue
    }

    // Normalize and get outward normal
    const dir = edgeVec.normalize()
    // For CCW polygon, outward normal is 90° clockwise rotation: (dy, -dx)
    // For CW polygon, outward normal is 90° counter-clockwise: (-dy, dx)
    const outwardNormal = isCCW ? vector(dir.y, -dir.x) : vector(-dir.y, dir.x)

    // Offset the edge by moving a point on it along the normal
    const offsetPt = point(
      p1.x + clearance * outwardNormal.x,
      p1.y + clearance * outwardNormal.y,
    )

    // Create line through offset point
    // line(pt, norm) takes the NORMAL to the line, not direction
    // The normal to our offset edge is the same as outwardNormal
    offsetLines.push(line(offsetPt, outwardNormal))
  }

  // Calculate offset vertices by intersecting adjacent offset lines
  const offsetVertices: Point[] = []

  for (let i = 0; i < n; i++) {
    const prevLine = offsetLines[(i - 1 + n) % n]!
    const currLine = offsetLines[i]!

    // Find intersection of the two offset lines
    const intersections = prevLine.intersect(currLine)

    if (intersections.length > 0) {
      const ip = intersections[0]!
      offsetVertices.push({ x: ip.x, y: ip.y })
    } else {
      // Parallel edges - just use a point on the current offset line
      offsetVertices.push({ x: currLine.pt.x, y: currLine.pt.y })
    }
  }

  if (verticesOnly) {
    return offsetVertices
  }

  // Sample points along each offset edge
  const result: Point[] = []

  for (let i = 0; i < n; i++) {
    const v1 = offsetVertices[i]!
    const v2 = offsetVertices[(i + 1) % n]!

    const seg = segment(point(v1.x, v1.y), point(v2.x, v2.y))
    const edgeLength = seg.length
    const numSegments = Math.max(2, Math.ceil(edgeLength / 20))

    for (let j = 0; j < numSegments; j++) {
      const t = j / numSegments
      result.push({
        x: v1.x + t * (v2.x - v1.x),
        y: v1.y + t * (v2.y - v1.y),
      })
    }
  }

  return result
}
