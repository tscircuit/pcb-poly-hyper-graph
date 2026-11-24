import { describe, expect, test } from "bun:test"
import { computeConvexRegions } from "../lib/computeConvexRegions"
import { getOffsetPolygonPoints } from "../lib/getOffsetPolygonPoints"
import type { Point } from "../lib/types"

const triangle: Point[] = [
  { x: 100, y: 100 },
  { x: 150, y: 100 },
  { x: 125, y: 150 },
]

const closeRing = (points: Point[]): Point[] => [...points, points[0]!]

describe("polygon point normalization", () => {
  test("explicitly closed polygon ring offsets like an implicit ring", () => {
    const openOffset = getOffsetPolygonPoints({
      polygon: { points: triangle },
      clearance: 5,
      verticesOnly: true,
    })
    const closedOffset = getOffsetPolygonPoints({
      polygon: { points: closeRing(triangle) },
      clearance: 5,
      verticesOnly: true,
    })

    expect(closedOffset).toEqual(openOffset)
  })

  test("duplicate consecutive vertices do not distort the clearance boundary", () => {
    const openOffset = getOffsetPolygonPoints({
      polygon: { points: triangle },
      clearance: 5,
      verticesOnly: true,
    })
    const duplicatedOffset = getOffsetPolygonPoints({
      polygon: {
        points: [triangle[0]!, triangle[1]!, triangle[1]!, triangle[2]!],
      },
      clearance: 5,
      verticesOnly: true,
    })

    expect(duplicatedOffset).toEqual(openOffset)
  })

  test("computeConvexRegions treats explicitly closed polygons as the same obstacle", () => {
    const input = {
      bounds: { minX: 0, maxX: 200, minY: 0, maxY: 200 },
      clearance: 5,
      concavityTolerance: 0,
    }
    const openResult = computeConvexRegions({
      ...input,
      polygons: [{ points: triangle }],
    })
    const closedResult = computeConvexRegions({
      ...input,
      polygons: [{ points: closeRing(triangle) }],
    })

    expect(closedResult.validTris).toEqual(openResult.validTris)
    expect(closedResult.regions).toEqual(openResult.regions)
  })
})
