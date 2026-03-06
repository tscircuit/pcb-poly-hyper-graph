import type { Bounds, Point } from "./types"

export const clampPointToBounds = (point: Point, bounds: Bounds): Point => ({
  x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
  y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y)),
})
