import { constrainedDelaunay } from "./constrainedDelaunay"
import { clampPointToBounds } from "./clampPointToBounds"
import { delaunay } from "./delaunay"
import { filterTris } from "./filterTris"
import { generateBoundaryPoints } from "./generateBoundaryPoints"
import { generateBoundaryPointsWithEdges } from "./generateBoundaryPointsWithEdges"
import { hullIdx } from "./hullIdx"
import { mergeCells } from "./mergeCells"
import { mergeCellsPolyanya } from "./mergeCellsPolyanya"
import type {
  ConvexRegionsComputeInput,
  ConvexRegionsComputeResult,
} from "./types"

const isDefinedPoint = <T>(value: T | undefined): value is T =>
  value !== undefined

export const computeConvexRegions = (
  input: ConvexRegionsComputeInput,
): ConvexRegionsComputeResult => {
  const { bounds, clearance, concavityTolerance } = input
  const vias = input.vias ?? []
  const rects = input.rects ?? []
  const polygons = input.polygons ?? []

  let pts: import("./types").Point[]
  let validTris: import("./types").Triangle[]

  if (input.useConstrainedDelaunay !== false) {
    const result = generateBoundaryPointsWithEdges({
      bounds,
      vias,
      clearance,
      rects,
      polygons,
      viaSegments: input.viaSegments,
    })
    pts = result.pts
    const cdtTris = constrainedDelaunay(pts, result.constraintEdges)
    // Always filter when obstacles exist — even without edge crossings,
    // one obstacle fully contained inside another can produce invalid triangles
    const hasObstacles =
      vias.length > 0 || rects.length > 0 || polygons.length > 0
    validTris = hasObstacles
      ? filterTris({
          triangles: cdtTris,
          pts,
          bounds,
          vias,
          clearance,
          rects,
          polygons,
        })
      : cdtTris
  } else {
    pts = generateBoundaryPoints({
      bounds,
      vias,
      clearance,
      rects,
      polygons,
      viaSegments: input.viaSegments,
    })
    const allTriangles = delaunay(pts)
    validTris = filterTris({
      triangles: allTriangles,
      pts,
      bounds,
      vias,
      clearance,
      rects,
      polygons,
    })
  }
  const { cells, depths } =
    input.usePolyanyaMerge !== false
      ? mergeCellsPolyanya({ triangles: validTris, pts })
      : mergeCells({ triangles: validTris, pts, concavityTolerance })

  const boundedPts = pts.map((pt) => clampPointToBounds(pt, bounds))
  const regions = cells.map((cell) =>
    cell.map((i) => boundedPts[i]).filter(isDefinedPoint),
  )
  const hulls = cells.map((cell) =>
    hullIdx(cell, boundedPts)
      .map((i) => boundedPts[i])
      .filter(isDefinedPoint),
  )

  return {
    pts: boundedPts,
    validTris,
    regions,
    hulls,
    depths,
  }
}
