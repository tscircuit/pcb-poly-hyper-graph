import type { Point } from "./types"

export const normalizePolygonPoints = (points: Point[]): Point[] => {
  const normalized: Point[] = []

  for (const point of points) {
    const previous = normalized[normalized.length - 1]
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      normalized.push(point)
    }
  }

  while (normalized.length > 1) {
    const first = normalized[0]!
    const last = normalized[normalized.length - 1]!
    if (first.x !== last.x || first.y !== last.y) break
    normalized.pop()
  }

  return normalized
}
