import { GRAPH } from './skillsGraph';
import { PLANET_PHYSICS, meanMotion } from './orbitalMechanics';
import { projects } from '@/components/sections/projectsData';

/*
 * Flat, typed views of the star system, shared by the scene and its render
 * layers. Everything is computed once at module load; what the scene rewrites
 * every frame are the live positions (planets, moons, ships).
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

/**
 * Typical radius of a moon (scene units); each moon's own is in NODE_RADIUS,
 * between 0.8 and 1.25 times this. Planet radii live on the cluster.
 */
export const LEAF_RADIUS_W = 0.125;
/** A fixed pseudo-random 0..1 per node, so the same moon is the same size on every load. */
const sizeSeed = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Live node positions, rewritten every frame as the planets and their moons move. */
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
  NODE_RADIUS[i] = node.isHub ? CLUSTERS[node.cluster].radius : LEAF_RADIUS_W * (0.8 + 0.45 * sizeSeed(i));
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
 * Ships: every highlighted project is a ship that plies between the two
 * domains it draws on most ("shipped work"). Hovering one names the project,
 * clicking flies alongside it. A project without a route here simply has no ship.
 * `home` is the end of its lane it starts at (0 or 1), `wait` how long it
 * stays in parking orbit before its first departure (scene seconds).
 */
const ROUTES: Record<string, { lane: number; home: number; wait: number; craft: number }> = {
  'Security Scanner': { lane: 0, home: 0, wait: 0.5, craft: CRAFT_COURIER },
  'Warhammer 40k Terminal Display': { lane: 0, home: 1, wait: 9, craft: CRAFT_FREIGHTER },
  SABER: { lane: 1, home: 0, wait: 4, craft: CRAFT_EXPLORER },
  'Lisa Tejada Boutique': { lane: 1, home: 1, wait: 13, craft: CRAFT_FREIGHTER },
  'Mi SaludRD': { lane: 2, home: 0, wait: 2, craft: CRAFT_EXPLORER },
  Encryptor: { lane: 3, home: 1, wait: 6.5, craft: CRAFT_COURIER },
};

export interface Ship {
  /** Index into `projects`. */
  project: number;
  label: string;
  lane: number;
  /** Which end of its lane it starts at, and how long before it first leaves. */
  home: number;
  wait: number;
  /** Hull model (CRAFT_*) and its half-length in scene units. */
  craft: number;
  size: number;
}

/** Scene seconds a ship spends in parking orbit between two transits. */
export const DOCK_SECONDS = 7;
/** Radius of that parking orbit, in planet radii (inside the innermost moon). */
export const PARK_RADII = 1.34;

export const SHIPS: Ship[] = [];
projects.forEach((p, i) => {
  const r = ROUTES[p.title];
  if (r) SHIPS.push({ project: i, label: p.title, size: CRAFT_HALF_LENGTH[r.craft], ...r });
});
export const SHIP_COUNT = SHIPS.length;

/* ── Satellites and the orbital station ─────────────────────────────────── */

export interface Satellite {
  cluster: number;
  /** Orbit radius (scene units) and the orthonormal basis of its (inclined) orbital plane. */
  radius: number;
  u: [number, number, number];
  v: [number, number, number];
  /** Angular speed (rad per scene second, from the planet's mass) and start angle. */
  speed: number;
  phase: number;
  station: boolean;
}

/** cluster, orbit radius in planet radii, inclination to the moons' plane (deg), direction, phase, station */
const SAT_SPECS: [number, number, number, number, number, boolean][] = [
  [0, 1.42, 62, 1, 0.4, false],
  [0, 1.72, -48, -1, 2.1, false],
  [1, 1.5, 70, 1, 1.2, false],
  [2, 2.2, 80, 1, 3.0, false],
  [3, 1.45, -58, -1, 5.0, false],
  [3, 1.85, 28, 1, 0.8, true],
];

export const SATELLITES: Satellite[] = SAT_SPECS.map(([cluster, r, inc, dir, phase, station]) => {
  const c = CLUSTERS[cluster];
  const i = (inc * Math.PI) / 180;
  const v: [number, number, number] = [
    c.v[0] * Math.cos(i) + c.axis[0] * Math.sin(i),
    c.v[1] * Math.cos(i) + c.axis[1] * Math.sin(i),
    c.v[2] * Math.cos(i) + c.axis[2] * Math.sin(i),
  ];
  // A circular orbit: its angular speed is the mean motion for that radius.
  const speed = dir * meanMotion(PLANET_PHYSICS[c.planet], r);
  return { cluster, radius: r * c.radius, u: c.u, v, speed, phase, station };
});
export const SAT_COUNT = SATELLITES.length;
