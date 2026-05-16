import { expect, test } from "bun:test"
import circuit100 from "@tscircuit/autorouting-dataset-01/lib/dataset/circuit100.simple-route.json"
import { ConvexRegionsSolver } from "../lib/ConvexRegionsSolver"
import { computeConvexRegions } from "../lib/computeConvexRegions"
import { constrainedDelaunay } from "../lib/constrainedDelaunay"
import { delaunay } from "../lib/delaunay"
import { filterTris } from "../lib/filterTris"
import { generateBoundaryPointsWithEdges } from "../lib/generateBoundaryPointsWithEdges"
import {
  countEdgeCrossings,
  createDiagonalWallInput,
  createSparseDiagonalWallPoints,
  createSparseHorizontalWallPoints,
  createThinHorizontalWallInput,
} from "./cdt-comparison.shared"
import { createPolygonObstaclesInput } from "./polygon-obstacles.shared"
import { createStaggeredJumpersInput } from "./staggered-jumpers.shared"

type DatasetObstacle = {
  type: string
  center: { x: number; y: number }
  width: number
  height: number
  layers?: string[]
  zLayers?: number[]
  connectedTo?: string[]
  ccwRotationDegrees?: number
  isCopperPour?: boolean
}

type DatasetSimpleRouteJson = {
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  obstacles?: DatasetObstacle[]
  layerCount: number
  minTraceWidth: number
  defaultObstacleMargin?: number
}

const circuit100Srj = circuit100 as DatasetSimpleRouteJson

const getDatasetObstacleRotation = (obstacle: DatasetObstacle) =>
  ((obstacle.ccwRotationDegrees ?? 0) * Math.PI) / 180

const getDatasetOvalPoints = (obstacle: DatasetObstacle) => {
  const rx = obstacle.width / 2
  const ry = obstacle.height / 2
  const rotation = getDatasetObstacleRotation(obstacle)
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  return Array.from({ length: 8 }, (_, index) => {
    const angle = (2 * Math.PI * index) / 8
    const localX = rx * Math.cos(angle)
    const localY = ry * Math.sin(angle)
    return {
      x: obstacle.center.x + localX * cos - localY * sin,
      y: obstacle.center.y + localX * sin + localY * cos,
    }
  })
}

// --- Core triangulation tests: prove unconstrained fails, CDT fixes it ---

test("horizontal wall: unconstrained Delaunay creates crossing edges", () => {
  const { pts, wallPoints } = createSparseHorizontalWallPoints()
  const tris = delaunay(pts)
  const crossings = countEdgeCrossings(pts, tris, wallPoints)

  expect(crossings).toBeGreaterThan(0)
})

test("horizontal wall: CDT eliminates all crossing edges", () => {
  const { pts, constraintEdges, wallPoints } =
    createSparseHorizontalWallPoints()
  const tris = constrainedDelaunay(pts, constraintEdges)
  const crossings = countEdgeCrossings(pts, tris, wallPoints)

  expect(crossings).toBe(0)
  expect(tris.length).toBeGreaterThan(0)
})

test("diagonal wall: unconstrained Delaunay creates crossing edges", () => {
  const { pts, wallPoints } = createSparseDiagonalWallPoints()
  const tris = delaunay(pts)
  const crossings = countEdgeCrossings(pts, tris, wallPoints)

  expect(crossings).toBeGreaterThan(0)
})

test("diagonal wall: CDT eliminates all crossing edges", () => {
  const { pts, constraintEdges, wallPoints } = createSparseDiagonalWallPoints()
  const tris = constrainedDelaunay(pts, constraintEdges)
  const crossings = countEdgeCrossings(pts, tris, wallPoints)

  expect(crossings).toBe(0)
  expect(tris.length).toBeGreaterThan(0)
})

// --- Full pipeline regression tests ---

test("CDT pipeline: thin horizontal wall — no crossings and regions on both sides", () => {
  const input = createThinHorizontalWallInput(true)
  const result = computeConvexRegions(input)

  const wallPoints = input.polygons![0]!.points
  const crossings = countEdgeCrossings(result.pts, result.validTris, wallPoints)
  expect(crossings).toBe(0)
  expect(result.regions.length).toBeGreaterThanOrEqual(2)

  const regionCentroids = result.regions.map((region) => {
    const avgY = region.reduce((sum, p) => sum + p.y, 0) / region.length
    return avgY
  })
  expect(regionCentroids.some((y) => y < 190)).toBe(true)
  expect(regionCentroids.some((y) => y > 210)).toBe(true)
})

test("CDT pipeline: diagonal wall — no crossings", () => {
  const input = createDiagonalWallInput(true)
  const result = computeConvexRegions(input)

  const wallPoints = input.polygons![0]!.points
  const crossings = countEdgeCrossings(result.pts, result.validTris, wallPoints)
  expect(crossings).toBe(0)
  expect(result.regions.length).toBeGreaterThanOrEqual(2)
})

test("CDT pipeline: polygon obstacles regression", () => {
  const base = createPolygonObstaclesInput()
  const input = { ...base, useConstrainedDelaunay: true }
  const result = computeConvexRegions(input)

  expect(result.regions.length).toBeGreaterThanOrEqual(1)
  expect(result.validTris.length).toBeGreaterThanOrEqual(1)
})

test("CDT pipeline: staggered jumpers regression", () => {
  const base = createStaggeredJumpersInput()
  const input = { ...base, useConstrainedDelaunay: true }
  const result = computeConvexRegions(input)

  expect(result.regions.length).toBeGreaterThanOrEqual(1)
  expect(result.validTris.length).toBeGreaterThanOrEqual(1)
})

test("CDT pipeline: dataset01 circuit100 resolves crossing constraints before triangulation", () => {
  const rects = (circuit100Srj.obstacles ?? [])
    .filter((obstacle) => obstacle.type === "rect")
    .map((obstacle) => ({
      center: obstacle.center,
      width: obstacle.width,
      height: obstacle.height,
      ccwRotation: getDatasetObstacleRotation(obstacle),
      layers: obstacle.layers,
      zLayers: obstacle.zLayers,
      isCopperPour: obstacle.isCopperPour,
    }))
  const polygons = (circuit100Srj.obstacles ?? [])
    .filter((obstacle) => obstacle.type === "oval")
    .map((obstacle) => ({
      points: getDatasetOvalPoints(obstacle),
      layers: obstacle.layers,
      zLayers: obstacle.zLayers,
      isCopperPour: obstacle.isCopperPour,
    }))

  const result = computeConvexRegions({
    bounds: circuit100Srj.bounds,
    rects,
    polygons,
    clearance:
      circuit100Srj.defaultObstacleMargin ?? circuit100Srj.minTraceWidth,
    concavityTolerance: 0.2,
    layerCount: circuit100Srj.layerCount,
    layerMergeMode: "same",
    useConstrainedDelaunay: true,
    usePolyanyaMerge: false,
    viaSegments: 8,
  })

  expect(result.validTris.length).toBeGreaterThan(0)
  expect(result.regions.length).toBeGreaterThan(0)
  expect(result.availableZ?.length).toBe(result.regions.length)
})

test("CDT pipeline: thin horizontal wall — solver SVG snapshot", async () => {
  const input = createThinHorizontalWallInput(true)
  const solver = new ConvexRegionsSolver(input)
  solver.solve()

  await expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
})

// --- filterTris is redundant in CDT mode when obstacles don't overlap ---

test("CDT: filterTris removes zero triangles when no obstacles overlap", () => {
  const inputs = [
    createThinHorizontalWallInput(true),
    createDiagonalWallInput(true),
    { ...createPolygonObstaclesInput(), useConstrainedDelaunay: true },
    { ...createStaggeredJumpersInput(), useConstrainedDelaunay: true },
  ]

  for (const input of inputs) {
    const { pts, constraintEdges, hadCrossings } =
      generateBoundaryPointsWithEdges({
        bounds: input.bounds,
        vias: input.vias ?? [],
        clearance: input.clearance,
        rects: input.rects ?? [],
        polygons: input.polygons ?? [],
        viaSegments: input.viaSegments,
      })

    // These inputs have non-overlapping obstacles
    expect(hadCrossings).toBe(false)

    const cdtTris = constrainedDelaunay(pts, constraintEdges)
    const filtered = filterTris({
      triangles: cdtTris,
      pts,
      bounds: input.bounds,
      vias: input.vias ?? [],
      clearance: input.clearance,
      rects: input.rects ?? [],
      polygons: input.polygons ?? [],
    })

    expect(filtered.length).toBe(cdtTris.length)
  }
})

// --- viaSegments defaults ---

test("CDT is enabled by default (omitting useConstrainedDelaunay uses CDT)", () => {
  const base = createStaggeredJumpersInput()
  const nVias = (base.vias ?? []).length

  const defaultResult = computeConvexRegions(base)
  const explicitCdt = computeConvexRegions({
    ...base,
    useConstrainedDelaunay: true,
  })
  const explicitUc = computeConvexRegions({
    ...base,
    useConstrainedDelaunay: false,
  })

  // Default should match explicit CDT (8-segment vias)
  expect(defaultResult.pts.length).toBe(40 + 8 * nVias)
  expect(defaultResult.pts.length).toBe(explicitCdt.pts.length)
  // Explicit unconstrained uses 24-segment vias
  expect(explicitUc.pts.length).toBe(40 + 24 * nVias)
})

test("viaSegments override is respected", () => {
  const base = createStaggeredJumpersInput()
  const nVias = (base.vias ?? []).length

  const result = computeConvexRegions({
    ...base,
    useConstrainedDelaunay: true,
    viaSegments: 12,
  })

  expect(result.pts.length).toBe(40 + 12 * nVias)
})

// --- Overlapping / intersecting obstacle tests ---

test("CDT: overlapping vias produce valid triangulation", () => {
  const result = computeConvexRegions({
    bounds: { minX: 0, maxX: 400, minY: 0, maxY: 400 },
    vias: [
      { center: { x: 190, y: 200 }, diameter: 30 },
      { center: { x: 210, y: 200 }, diameter: 30 },
    ],
    clearance: 8,
    concavityTolerance: 0,
    useConstrainedDelaunay: true,
  })

  expect(result.validTris.length).toBeGreaterThan(0)
  expect(result.regions.length).toBeGreaterThanOrEqual(1)
})

test("CDT: touching vias produce valid triangulation", () => {
  const result = computeConvexRegions({
    bounds: { minX: 0, maxX: 400, minY: 0, maxY: 400 },
    vias: [
      { center: { x: 180, y: 200 }, diameter: 30 },
      { center: { x: 220, y: 200 }, diameter: 30 },
    ],
    clearance: 8,
    concavityTolerance: 0,
    useConstrainedDelaunay: true,
  })

  expect(result.validTris.length).toBeGreaterThan(0)
  expect(result.regions.length).toBeGreaterThanOrEqual(1)
})

test("CDT: cluster of 3 overlapping vias", () => {
  const result = computeConvexRegions({
    bounds: { minX: 0, maxX: 400, minY: 0, maxY: 400 },
    vias: [
      { center: { x: 180, y: 200 }, diameter: 30 },
      { center: { x: 220, y: 200 }, diameter: 30 },
      { center: { x: 200, y: 230 }, diameter: 30 },
    ],
    clearance: 8,
    concavityTolerance: 0,
    useConstrainedDelaunay: true,
  })

  expect(result.validTris.length).toBeGreaterThan(0)
  expect(result.regions.length).toBeGreaterThanOrEqual(1)
})

test("CDT: via overlapping rect", () => {
  const result = computeConvexRegions({
    bounds: { minX: 0, maxX: 400, minY: 0, maxY: 400 },
    vias: [{ center: { x: 200, y: 200 }, diameter: 30 }],
    rects: [
      { center: { x: 220, y: 200 }, width: 40, height: 20, ccwRotation: 0 },
    ],
    clearance: 8,
    concavityTolerance: 0,
    useConstrainedDelaunay: true,
  })

  expect(result.validTris.length).toBeGreaterThan(0)
  expect(result.regions.length).toBeGreaterThanOrEqual(1)
})

test("CDT: via overlapping polygon", () => {
  const result = computeConvexRegions({
    bounds: { minX: 0, maxX: 400, minY: 0, maxY: 400 },
    vias: [{ center: { x: 200, y: 200 }, diameter: 30 }],
    polygons: [
      {
        points: [
          { x: 210, y: 180 },
          { x: 260, y: 200 },
          { x: 210, y: 220 },
        ],
      },
    ],
    clearance: 8,
    concavityTolerance: 0,
    useConstrainedDelaunay: true,
  })

  expect(result.validTris.length).toBeGreaterThan(0)
  expect(result.regions.length).toBeGreaterThanOrEqual(1)
})

test("CDT: via near bounds edge", () => {
  const result = computeConvexRegions({
    bounds: { minX: 0, maxX: 400, minY: 0, maxY: 400 },
    vias: [{ center: { x: 10, y: 200 }, diameter: 30 }],
    clearance: 8,
    concavityTolerance: 0,
    useConstrainedDelaunay: true,
  })

  expect(result.validTris.length).toBeGreaterThan(0)
  expect(result.regions.length).toBeGreaterThanOrEqual(1)
})
