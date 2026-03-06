import { isPointInOrNearPolygon } from "./isPointInOrNearPolygon"
import type { Bounds, Point, Polygon, Rect, Via } from "./types"

export const inFreeSpace = (params: {
  px: number
  py: number
  bounds: Bounds
  vias: Via[]
  clearance: number
  rects: Rect[]
  polygons: Polygon[]
}): boolean => {
  const { px, py, bounds, vias, clearance, rects, polygons } = params
  const { minX, maxX, minY, maxY } = bounds
  const maxDim = Math.max(maxX - minX, maxY - minY, 1)
  const eps = maxDim * 1e-6
  if (
    px < minX - eps ||
    px > maxX + eps ||
    py < minY - eps ||
    py > maxY + eps
  ) {
    return false
  }

  for (const via of vias) {
    const radius = via.diameter / 2 + clearance
    const effectiveRadius = Math.max(0, radius - eps)
    if (
      (px - via.center.x) ** 2 + (py - via.center.y) ** 2 <
      effectiveRadius * effectiveRadius
    ) {
      return false
    }
  }

  for (const rect of rects) {
    const halfWidth = rect.width / 2 + clearance
    const halfHeight = rect.height / 2 + clearance
    const effectiveHalfWidth = Math.max(0, halfWidth - eps)
    const effectiveHalfHeight = Math.max(0, halfHeight - eps)
    const dx = px - rect.center.x
    const dy = py - rect.center.y
    const cosTheta = Math.cos(rect.ccwRotation)
    const sinTheta = Math.sin(rect.ccwRotation)
    const localX = dx * cosTheta + dy * sinTheta
    const localY = -dx * sinTheta + dy * cosTheta

    if (
      Math.abs(localX) < effectiveHalfWidth &&
      Math.abs(localY) < effectiveHalfHeight
    ) {
      return false
    }
  }

  for (const polygon of polygons) {
    if (
      isPointInOrNearPolygon({
        px,
        py,
        polygonPoints: polygon.points,
        clearance,
      })
    ) {
      return false
    }
  }

  return true
}
