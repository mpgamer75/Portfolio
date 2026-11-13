import { GRAPH } from './skillsGraph';

/*
 * Flat, typed views of the baked skills graph, shared by the scene and its
 * render layers (nodes / links). Static data only — everything here is computed
 * once at module load and never mutated. Client-only (lazy chunk), no three.
 */

export const NODES = GRAPH.nodes;
export const NODE_COUNT = NODES.length;
export const CLUSTERS = GRAPH.clusters;
export const CLUSTER_COUNT = CLUSTERS.length;
export const LINKS = GRAPH.links;
export const LINK_COUNT = LINKS.length;

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

/** Leaf count per cluster (the number shown on legend chips and hub labels). */
export const CLUSTER_COUNTS = CLUSTERS.map(
  (_, ci) => NODES.filter((n) => n.cluster === ci && !n.isHub).length,
);
/** Hub node index per cluster + the leaf skill labels per cluster (for the domain card). */
export const CLUSTER_HUB: number[] = [];
export const CLUSTER_SKILLS: string[][] = CLUSTERS.map(() => []);

/** World-space radius of a hub's plate and of a leaf's core (scene units). */
export const HUB_RADIUS_W = 0.5;
export const LEAF_RADIUS_W = 0.1;

export const NODE_POSITIONS = new Float32Array(NODE_COUNT * 3);
export const CLUSTER_OF = new Int16Array(NODE_COUNT);
export const IS_HUB = new Uint8Array(NODE_COUNT);
export const NODE_RADIUS = new Float32Array(NODE_COUNT);
/** Entrance delay (0..1 of the reveal) — hubs first, then each cluster's leaves fan in. */
export const NODE_ENTER = new Float32Array(NODE_COUNT);
NODES.forEach((node, i) => {
  NODE_POSITIONS[i * 3] = node.position[0];
  NODE_POSITIONS[i * 3 + 1] = node.position[1];
  NODE_POSITIONS[i * 3 + 2] = node.position[2];
  CLUSTER_OF[i] = node.cluster;
  IS_HUB[i] = node.isHub ? 1 : 0;
  NODE_RADIUS[i] = node.isHub ? HUB_RADIUS_W : LEAF_RADIUS_W;
  if (node.isHub) {
    CLUSTER_HUB[node.cluster] = i;
    NODE_ENTER[i] = 0.02 * node.cluster;
  } else {
    const li = CLUSTER_SKILLS[node.cluster].length;
    CLUSTER_SKILLS[node.cluster].push(node.label);
    NODE_ENTER[i] = 0.3 + 0.035 * li + 0.02 * node.cluster;
  }
});

export const LINK_A = new Int16Array(LINK_COUNT);
export const LINK_B = new Int16Array(LINK_COUNT);
/** Resting brightness per link: spokes inside a domain read stronger than the hub ring. */
export const LINK_REST = new Float32Array(LINK_COUNT);
/** Entrance timing per link (0..1): hub ring first, then leaves fan out. */
export const LINK_ENTER = new Float32Array(LINK_COUNT);
/** 1 for the hub-to-hub ring links, 0 for hub-to-leaf spokes. */
export const LINK_IS_RING = new Uint8Array(LINK_COUNT);
LINKS.forEach((link, l) => {
  LINK_A[l] = link.a;
  LINK_B[l] = link.b;
  const ring = NODES[link.a].isHub && NODES[link.b].isHub;
  LINK_IS_RING[l] = ring ? 1 : 0;
  LINK_REST[l] = ring ? 0.3 : 0.46;
  LINK_ENTER[l] = ring ? 0.05 + 0.04 * (l - (LINK_COUNT - CLUSTER_COUNT)) : NODE_ENTER[link.b];
});
