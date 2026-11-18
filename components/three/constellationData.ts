import { GRAPH } from './skillsGraph';
import { projects } from '@/components/sections/projectsData';

/*
 * Flat, typed views of the baked star system, shared by the scene and its
 * render layers. Everything is computed once at module load; the only arrays
 * the scene mutates are the live positions (moons orbit, ships fly).
 * Client-only (lazy chunk), no three.
 */

export const NODES = GRAPH.nodes;
export const NODE_COUNT = NODES.length;
export const CLUSTERS = GRAPH.clusters;
export const CLUSTER_COUNT = CLUSTERS.length;
export const LANES = GRAPH.lanes;
export const LANE_COUNT = LANES.length;

/**
 * Cluster colours as plain sRGB floats (r,g,b per cluster). The shaders output
 * these untouched, so a body is exactly the colour of its legend chip — parsing
 * through THREE.Color would hand back linear values and darken them.
 */
export const CLUSTER_RGB = new Float32Array(CLUSTER_COUNT * 3);
CLUSTERS.forEach((c, i) => {
  const v = parseInt(c.color.slice(1), 16);
  CLUSTER_RGB[i * 3] = ((v >> 16) & 255) / 255;
  CLUSTER_RGB[i * 3 + 1] = ((v >> 8) & 255) / 255;
  CLUSTER_RGB[i * 3 + 2] = (v & 255) / 255;
});

/** Moon count per cluster (the number shown on legend chips and hub labels). */
export const CLUSTER_COUNTS = CLUSTERS.map(
  (_, ci) => NODES.filter((n) => n.cluster === ci && !n.isHub).length,
);
/** Hub node index per cluster + the skill labels per cluster (for the domain card). */
export const CLUSTER_HUB: number[] = [];
export const CLUSTER_SKILLS: string[][] = CLUSTERS.map(() => []);

/** World-space radius of a moon (scene units). Planet radii live on the cluster. */
export const LEAF_RADIUS_W = 0.125;

/** Live node positions: planets are fixed, moons are rewritten every frame. */
export const NODE_POSITIONS = new Float32Array(NODE_COUNT * 3);
export const CLUSTER_OF = new Int16Array(NODE_COUNT);
export const IS_HUB = new Uint8Array(NODE_COUNT);
export const NODE_RADIUS = new Float32Array(NODE_COUNT);
/** Entrance delay (0..1 of the reveal) — planets first, then each system's moons fan in. */
export const NODE_ENTER = new Float32Array(NODE_COUNT);
NODES.forEach((node, i) => {
  NODE_POSITIONS[i * 3] = node.position[0];
  NODE_POSITIONS[i * 3 + 1] = node.position[1];
  NODE_POSITIONS[i * 3 + 2] = node.position[2];
  CLUSTER_OF[i] = node.cluster;
  IS_HUB[i] = node.isHub ? 1 : 0;
  NODE_RADIUS[i] = node.isHub ? CLUSTERS[node.cluster].radius : LEAF_RADIUS_W;
  if (node.isHub) {
    CLUSTER_HUB[node.cluster] = i;
    NODE_ENTER[i] = 0.1 + 0.03 * node.cluster;
  } else {
    const li = CLUSTER_SKILLS[node.cluster].length;
    CLUSTER_SKILLS[node.cluster].push(node.label);
    NODE_ENTER[i] = 0.38 + 0.028 * li + 0.02 * node.cluster;
  }
});

/** Hull models, in the order of their cells in the craft atlas (see bodyLayer.ts). */
export const CRAFT_COURIER = 0;
export const CRAFT_FREIGHTER = 1;
export const CRAFT_EXPLORER = 2;
/** Half-length of each hull model (scene units). */
const CRAFT_HALF_LENGTH = [0.17, 0.215, 0.2];

/**
 * Ships: every highlighted project is a ship on the lane between the two
 * domains it draws on most ("shipped work"). Hovering one names the project,
 * clicking flies alongside it. A project without a route here simply has no ship.
 */
const ROUTES: Record<string, { lane: number; offset: number; bow: number; craft: number }> = {
  'Security Scanner': { lane: 0, offset: 0.0, bow: 0.55, craft: CRAFT_COURIER },
  'Warhammer 40k Terminal Display': { lane: 0, offset: 0.5, bow: -0.5, craft: CRAFT_FREIGHTER },
  SABER: { lane: 1, offset: 0.2, bow: 0.55, craft: CRAFT_EXPLORER },
  'Lisa Tejada Boutique': { lane: 1, offset: 0.7, bow: -0.5, craft: CRAFT_FREIGHTER },
  'Mi SaludRD': { lane: 2, offset: 0.35, bow: 0.5, craft: CRAFT_EXPLORER },
  Encryptor: { lane: 3, offset: 0.1, bow: 0.5, craft: CRAFT_COURIER },
};

export interface Ship {
  /** Index into `projects`. */
  project: number;
  label: string;
  lane: number;
  /** Start offset (0..1 of a round trip) and sideways bow of this ship's own path. */
  offset: number;
  bow: number;
  /** Seconds for a full round trip. */
  period: number;
  /** Hull model (CRAFT_*) and its half-length in scene units. */
  craft: number;
  size: number;
}

export const SHIPS: Ship[] = [];
projects.forEach((p, i) => {
  const r = ROUTES[p.title];
  if (r) {
    SHIPS.push({ project: i, label: p.title, period: 46 + SHIPS.length * 5, size: CRAFT_HALF_LENGTH[r.craft], ...r });
  }
});
export const SHIP_COUNT = SHIPS.length;

/* ── Curves: lanes between planets, and each ship's own path along its lane ── */

/** Quadratic Bezier per lane: A(3) Ctrl(3) B(3) t0 t1 (trimmed at both planets). */
export const CURVE_STRIDE = 11;
export const LANE_CURVES = new Float32Array(LANE_COUNT * CURVE_STRIDE);
export const SHIP_CURVES = new Float32Array(SHIP_COUNT * CURVE_STRIDE);

/** How far a lane bows away from the star, and where curves stop short of a planet (in radii). */
const LANE_BOW = 0.7;
const LANE_TRIM = 1.3;
const SHIP_TRIM = 2.0;

function writeCurve(out: Float32Array, o: number, lane: number, side: number, trim: number) {
  const a = CLUSTERS[LANES[lane].a];
  const b = CLUSTERS[LANES[lane].b];
  const [ax, ay, az] = a.center;
  const [bx, by, bz] = b.center;
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 1;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const mz = (az + bz) / 2;
  // Bow away from the star, plus an optional sideways offset (ships fly beside the lane).
  const m = Math.hypot(mx, my, mz) || 1;
  const ox = mx / m;
  const oy = my / m;
  const oz = mz / m;
  let sx = dy * oz - dz * oy;
  let sy = dz * ox - dx * oz;
  let sz = dx * oy - dy * ox;
  const sl = Math.hypot(sx, sy, sz) || 1;
  sx /= sl;
  sy /= sl;
  sz /= sl;
  out.set(
    [
      ax,
      ay,
      az,
      mx + ox * LANE_BOW + sx * side,
      my + oy * LANE_BOW + sy * side,
      mz + oz * LANE_BOW + sz * side,
      bx,
      by,
      bz,
      (a.radius * trim) / len,
      1 - (b.radius * trim) / len,
    ],
    o,
  );
}
for (let l = 0; l < LANE_COUNT; l++) writeCurve(LANE_CURVES, l * CURVE_STRIDE, l, 0, LANE_TRIM);
SHIPS.forEach((s, i) => writeCurve(SHIP_CURVES, i * CURVE_STRIDE, s.lane, s.bow, SHIP_TRIM));

/* ── Satellites and the orbital station ─────────────────────────────────── */

export interface Satellite {
  cluster: number;
  /** Orbit radius (scene units) and the orthonormal basis of its (inclined) orbital plane. */
  radius: number;
  u: [number, number, number];
  v: [number, number, number];
  /** Angular speed (rad/s) and start angle. */
  speed: number;
  phase: number;
  station: boolean;
}

/** cluster, orbit radius in planet radii, inclination to the moons' plane (deg), speed, phase, station */
const SAT_SPECS: [number, number, number, number, number, boolean][] = [
  [0, 1.42, 62, 0.55, 0.4, false],
  [0, 1.72, -48, -0.4, 2.1, false],
  [1, 1.5, 70, 0.5, 1.2, false],
  [2, 2.2, 80, 0.34, 3.0, false],
  [3, 1.45, -58, -0.52, 5.0, false],
  [3, 1.85, 28, 0.16, 0.8, true],
];

export const SATELLITES: Satellite[] = SAT_SPECS.map(([cluster, r, inc, speed, phase, station]) => {
  const c = CLUSTERS[cluster];
  const i = (inc * Math.PI) / 180;
  const v: [number, number, number] = [
    c.v[0] * Math.cos(i) + c.axis[0] * Math.sin(i),
    c.v[1] * Math.cos(i) + c.axis[1] * Math.sin(i),
    c.v[2] * Math.cos(i) + c.axis[2] * Math.sin(i),
  ];
  return { cluster, radius: r * c.radius, u: c.u, v, speed, phase, station };
});
export const SAT_COUNT = SATELLITES.length;
