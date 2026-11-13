import { GRAPH, ORBIT_RADIUS, planeBasis } from './skillsGraph';

/*
 * Flat, typed views of the baked skills graph, shared by the scene and its
 * render layers (nodes / links / rings). Everything here is computed once at
 * module load and never mutated — except NODE_POSITIONS, whose leaf entries are
 * rewritten every frame by orbitSim (the skills ride rings around their hub).
 * Client-only (lazy chunk), no three.
 */

export const NODES = GRAPH.nodes;
export const NODE_COUNT = NODES.length;
export const CLUSTERS = GRAPH.clusters;
export const CLUSTER_COUNT = CLUSTERS.length;
export const LINKS = GRAPH.links;
export const LINK_COUNT = LINKS.length;
export { ORBIT_RADIUS };

/** Index of the core node (the system's centre). */
export const CORE = NODES.findIndex((n) => n.kind === 'core');
/** The core's tint: the signature emerald pushed towards white. */
export const CORE_RGB = [0.72, 1.0, 0.88] as const;
export const CORE_COLOR = '#B8FFE0';

/**
 * Cluster colours as plain sRGB floats (r,g,b per cluster). The shaders output
 * these untouched, so a node is exactly the colour of its legend chip — parsing
 * through THREE.Color would hand back linear values and darken them.
 */
export const CLUSTER_RGB = new Float32Array(CLUSTER_COUNT * 3);
CLUSTERS.forEach((c, i) => {
  const v = parseInt(c.color.slice(1), 16);
  CLUSTER_RGB[i * 3] = ((v >> 16) & 255) / 255;
  CLUSTER_RGB[i * 3 + 1] = ((v >> 8) & 255) / 255;
  CLUSTER_RGB[i * 3 + 2] = (v & 255) / 255;
});

/** Writes node `i`'s tint (its domain's, or the core's) into `out` at `offset`. */
export function nodeRgb(i: number, out: Float32Array, offset: number): void {
  const c = NODES[i].cluster;
  if (c < 0) out.set(CORE_RGB, offset);
  else out.set(CLUSTER_RGB.subarray(c * 3, c * 3 + 3), offset);
}

/** Leaf count per cluster (the number shown on legend chips and hub labels). */
export const CLUSTER_COUNTS = CLUSTERS.map(
  (_, ci) => NODES.filter((n) => n.cluster === ci && n.kind === 'leaf').length,
);
/** Total number of skills (leaves) in the graph. */
export const SKILL_COUNT = CLUSTER_COUNTS.reduce((a, b) => a + b, 0);
/** Hub node index per cluster + the leaf skill labels per cluster (for the domain card). */
export const CLUSTER_HUB: number[] = [];
export const CLUSTER_SKILLS: string[][] = CLUSTERS.map(() => []);
/** Outermost skill-ring radius per cluster (scene units). */
export const CLUSTER_REACH = CLUSTERS.map((c) => c.rings[c.rings.length - 1]);

/** World-space radius of the core, of a hub's plate and of a leaf's bead (scene units). */
export const CORE_RADIUS_W = 0.92;
export const HUB_RADIUS_W = 0.5;
export const LEAF_RADIUS_W = 0.115;

/** Graph-local positions. Hubs and the core are fixed; leaves are driven by orbitSim. */
export const NODE_POSITIONS = new Float32Array(NODE_COUNT * 3);
/** Domain index per node (-1 for the core). */
export const CLUSTER_OF = new Int16Array(NODE_COUNT);
/** 1 for "anchor" nodes — the domain hubs and the core: always labelled, big targets. */
export const IS_HUB = new Uint8Array(NODE_COUNT);
export const NODE_RADIUS = new Float32Array(NODE_COUNT);
/** Entrance delay (0..1 of the reveal) — core, then hubs, then each cluster's leaves fan in. */
export const NODE_ENTER = new Float32Array(NODE_COUNT);
/** Leaves: ring radius and resting angle on the ring (0 for hubs / core). */
export const LEAF_RING = new Float32Array(NODE_COUNT);
export const LEAF_ANGLE = new Float32Array(NODE_COUNT);
/** Leaf node indices, grouped by cluster. */
export const CLUSTER_LEAVES: number[][] = CLUSTERS.map(() => []);

NODES.forEach((node, i) => {
  NODE_POSITIONS[i * 3] = node.position[0];
  NODE_POSITIONS[i * 3 + 1] = node.position[1];
  NODE_POSITIONS[i * 3 + 2] = node.position[2];
  CLUSTER_OF[i] = node.cluster;
  IS_HUB[i] = node.kind === 'leaf' ? 0 : 1;
  LEAF_RING[i] = node.ringRadius;
  LEAF_ANGLE[i] = node.ringAngle;
  if (node.kind === 'core') {
    NODE_RADIUS[i] = CORE_RADIUS_W;
    NODE_ENTER[i] = 0;
  } else if (node.kind === 'hub') {
    NODE_RADIUS[i] = HUB_RADIUS_W;
    CLUSTER_HUB[node.cluster] = i;
    NODE_ENTER[i] = 0.26 + 0.035 * node.cluster;
  } else {
    NODE_RADIUS[i] = LEAF_RADIUS_W;
    const li = CLUSTER_SKILLS[node.cluster].length;
    CLUSTER_SKILLS[node.cluster].push(node.label);
    CLUSTER_LEAVES[node.cluster].push(i);
    NODE_ENTER[i] = 0.5 + 0.03 * li + 0.025 * node.cluster;
  }
});

/** Resting ring-plane frame per cluster: normal + in-plane basis (u × v = n). */
export const CLUSTER_N0 = new Float32Array(CLUSTER_COUNT * 3);
export const CLUSTER_U0 = new Float32Array(CLUSTER_COUNT * 3);
export const CLUSTER_V0 = new Float32Array(CLUSTER_COUNT * 3);
/** Ring angular speed per cluster (rad/s). */
export const CLUSTER_SPIN = new Float32Array(CLUSTER_COUNT);
/** Each hub's angle on the shared orbit (graph-local, atan2(z, x)). */
export const CLUSTER_AZIMUTH = new Float32Array(CLUSTER_COUNT);
CLUSTERS.forEach((c, i) => {
  const { u, v } = planeBasis(c.normal);
  CLUSTER_N0.set(c.normal, i * 3);
  CLUSTER_U0.set(u, i * 3);
  CLUSTER_V0.set(v, i * 3);
  CLUSTER_SPIN[i] = c.spin;
  CLUSTER_AZIMUTH[i] = Math.atan2(c.center[2], c.center[0]);
});

export const LINK_TRUNK = 0;
export const LINK_SPOKE = 1;
export const LINK_CROSS = 2;

export const LINK_A = new Int16Array(LINK_COUNT);
export const LINK_B = new Int16Array(LINK_COUNT);
/** LINK_TRUNK (core → hub) · LINK_SPOKE (hub → skill) · LINK_CROSS (skill ↔ skill). */
export const LINK_KIND = new Uint8Array(LINK_COUNT);
/** Resting brightness per link: trunks lead, spokes follow, cross links whisper. */
export const LINK_REST = new Float32Array(LINK_COUNT);
/** Entrance timing per link (0..1): trunks shoot out first, spokes fan out, cross links last. */
export const LINK_ENTER = new Float32Array(LINK_COUNT);
/** Cross-link partners per node (skills this one is used with, in another domain). */
export const RELATED: number[][] = NODES.map(() => []);
{
  let cross = 0;
  LINKS.forEach((link, l) => {
    LINK_A[l] = link.a;
    LINK_B[l] = link.b;
    if (link.kind === 'trunk') {
      LINK_KIND[l] = LINK_TRUNK;
      LINK_REST[l] = 0.62;
      LINK_ENTER[l] = 0.08 + 0.035 * NODES[link.b].cluster;
    } else if (link.kind === 'spoke') {
      LINK_KIND[l] = LINK_SPOKE;
      LINK_REST[l] = 0.44;
      LINK_ENTER[l] = NODE_ENTER[link.b] - 0.06;
    } else {
      LINK_KIND[l] = LINK_CROSS;
      LINK_REST[l] = 0.13;
      LINK_ENTER[l] = 0.74 + 0.012 * cross++;
      RELATED[link.a].push(link.b);
      RELATED[link.b].push(link.a);
    }
  });
}
