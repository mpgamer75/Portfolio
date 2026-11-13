import {
  CLUSTER_COUNT,
  CLUSTER_HUB,
  CLUSTER_LEAVES,
  CLUSTER_N0,
  CLUSTER_SPIN,
  CLUSTER_U0,
  CLUSTER_V0,
  LEAF_ANGLE,
  LEAF_RING,
  NODE_POSITIONS,
} from './constellationData';

/*
 * The moving part of the graph. Each domain's skills ride one or two rings
 * around their hub; the rings turn slowly, and when a domain gets the focus its
 * ring plane swings round to face the camera ("unfolds") and stops turning, so
 * its skills hold still and spread into a readable dial.
 *
 * Runs on the CPU once per frame (about thirty nodes) and writes the leaf
 * entries of NODE_POSITIONS, which the node / link / ring layers, the picker
 * and the DOM labels all read — so everything agrees on where a skill is.
 */

/** Current ring-plane frame per cluster (normal + in-plane basis). */
export const CLUSTER_N = new Float32Array(CLUSTER_N0);
export const CLUSTER_U = new Float32Array(CLUSTER_U0);
export const CLUSTER_V = new Float32Array(CLUSTER_V0);
/** Eased unfold amount per cluster: 0 resting plane … 1 facing the camera. */
export const FOLD = new Float32Array(CLUSTER_COUNT);
/** Accumulated ring rotation per cluster (rad). */
const TURN = new Float32Array(CLUSTER_COUNT);
/** Eased time scale of each cluster's rings: 1 turning … 0 held. */
const RATE = new Float32Array(CLUSTER_COUNT).fill(1);

const BOB = 0.055;

/** Lets go of every unfold at once (used when the scene remounts). */
export function resetOrbits(): void {
  FOLD.fill(0);
  RATE.fill(1);
}

/**
 * Advances the rings and rewrites the leaf positions.
 * `camX/Y/Z` is the camera position in graph-local space (the unfold aims at it).
 */
export function stepOrbits(
  dt: number,
  time: number,
  focusCluster: number | null,
  camX: number,
  camY: number,
  camZ: number,
): void {
  const kFold = 1 - Math.exp(-dt * 5.5);
  const kRate = 1 - Math.exp(-dt * 4);
  for (let c = 0; c < CLUSTER_COUNT; c++) {
    const focused = focusCluster === c;
    FOLD[c] += ((focused ? 1 : 0) - FOLD[c]) * kFold;
    RATE[c] += ((focused ? 0 : 1) - RATE[c]) * kRate;
    TURN[c] += CLUSTER_SPIN[c] * RATE[c] * dt;

    const o = c * 3;
    const h = CLUSTER_HUB[c] * 3;
    const hx = NODE_POSITIONS[h];
    const hy = NODE_POSITIONS[h + 1];
    const hz = NODE_POSITIONS[h + 2];
    const n0x = CLUSTER_N0[o];
    const n0y = CLUSTER_N0[o + 1];
    const n0z = CLUSTER_N0[o + 2];
    let nx = n0x;
    let ny = n0y;
    let nz = n0z;
    let ux = CLUSTER_U0[o];
    let uy = CLUSTER_U0[o + 1];
    let uz = CLUSTER_U0[o + 2];
    let vx = CLUSTER_V0[o];
    let vy = CLUSTER_V0[o + 1];
    let vz = CLUSTER_V0[o + 2];

    const f = FOLD[c] * FOLD[c] * (3 - 2 * FOLD[c]);
    if (f > 0.0005) {
      // Aim the plane normal at the camera (whichever side is nearer: a ring
      // facing the viewer looks the same from either face).
      let dx = camX - hx;
      let dy = camY - hy;
      let dz = camZ - hz;
      const dl = Math.hypot(dx, dy, dz) || 1;
      const side = dx * n0x + dy * n0y + dz * n0z < 0 ? -1 : 1;
      dx = (dx / dl) * side;
      dy = (dy / dl) * side;
      dz = (dz / dl) * side;
      nx = n0x + (dx - n0x) * f;
      ny = n0y + (dy - n0y) * f;
      nz = n0z + (dz - n0z) * f;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      // Carry the in-plane basis along with the smallest rotation n0 → n
      // (Rodrigues), so the skills swing with the plane instead of swirling.
      let kx = n0y * nz - n0z * ny;
      let ky = n0z * nx - n0x * nz;
      let kz = n0x * ny - n0y * nx;
      const sin = Math.hypot(kx, ky, kz);
      if (sin > 1e-5) {
        kx /= sin;
        ky /= sin;
        kz /= sin;
        const cos = n0x * nx + n0y * ny + n0z * nz;
        const ku = (kx * ux + ky * uy + kz * uz) * (1 - cos);
        const kv = (kx * vx + ky * vy + kz * vz) * (1 - cos);
        const rux = ux * cos + (ky * uz - kz * uy) * sin + kx * ku;
        const ruy = uy * cos + (kz * ux - kx * uz) * sin + ky * ku;
        const ruz = uz * cos + (kx * uy - ky * ux) * sin + kz * ku;
        const rvx = vx * cos + (ky * vz - kz * vy) * sin + kx * kv;
        const rvy = vy * cos + (kz * vx - kx * vz) * sin + ky * kv;
        const rvz = vz * cos + (kx * vy - ky * vx) * sin + kz * kv;
        ux = rux;
        uy = ruy;
        uz = ruz;
        vx = rvx;
        vy = rvy;
        vz = rvz;
      }
    }
    CLUSTER_N[o] = nx;
    CLUSTER_N[o + 1] = ny;
    CLUSTER_N[o + 2] = nz;
    CLUSTER_U[o] = ux;
    CLUSTER_U[o + 1] = uy;
    CLUSTER_U[o + 2] = uz;
    CLUSTER_V[o] = vx;
    CLUSTER_V[o + 1] = vy;
    CLUSTER_V[o + 2] = vz;

    const leaves = CLUSTER_LEAVES[c];
    const bobAmp = BOB * (1 - f);
    for (let k = 0; k < leaves.length; k++) {
      const i = leaves[k];
      const a = LEAF_ANGLE[i] + TURN[c];
      const r = LEAF_RING[i];
      const cx = Math.cos(a) * r;
      const sx = Math.sin(a) * r;
      const bob = bobAmp * Math.sin(time * 0.7 + i * 1.7);
      NODE_POSITIONS[i * 3] = hx + ux * cx + vx * sx + nx * bob;
      NODE_POSITIONS[i * 3 + 1] = hy + uy * cx + vy * sx + ny * bob;
      NODE_POSITIONS[i * 3 + 2] = hz + uz * cx + vz * sx + nz * bob;
    }
  }
}
