/**
 * Deterministic node-graph for the 3D Skills Constellation.
 *
 * Pure data + a stable layout (trig + Fibonacci shells, no runtime randomness),
 * so the constellation looks identical on every load. No React, no three here.
 *
 * NOTE: the skill lists mirror `skillCategories` in components/sections/SkillsSection.tsx
 * (which is the accessible, on-page source of truth). Keep the two in sync.
 */

export interface SkillNode {
  id: string;
  label: string;
  cluster: number;
  position: [number, number, number];
  isHub: boolean;
}

/** Link between two nodes, stored as indices into `GraphData.nodes`. */
export interface SkillLink {
  a: number;
  b: number;
}

/** Hub emblem — each domain gets its own outline shape as well as its own tint. */
export type ClusterGlyph = 'circle' | 'diamond' | 'hexagon' | 'triangle';

export interface Cluster {
  index: number;
  title: string;
  color: string;
  glyph: ClusterGlyph;
  center: [number, number, number];
}

export interface GraphData {
  nodes: SkillNode[];
  links: SkillLink[];
  clusters: Cluster[];
}

/**
 * Four domains. Each is keyed two ways so they're tellable apart at a glance:
 * a distinct luminance step within the emerald/teal family (light mint → deep
 * green, signature emerald leading), and a distinct hub glyph shape that repeats
 * in the legend, hub labels and detail card.
 */
const CATEGORIES: { title: string; color: string; glyph: ClusterGlyph; items: string[] }[] = [
  {
    title: 'Security & Systems',
    color: '#34D399', // signature emerald
    glyph: 'circle',
    items: ['Kali Linux', 'Linux', 'Nmap', 'Wireshark', 'Metasploit', 'Fortinet', 'Trellix EDR', 'OSINT'],
  },
  {
    title: 'Programming',
    color: '#A7F3D0', // light mint
    glyph: 'diamond',
    items: ['C', 'C#', 'Java', 'JavaScript', 'TypeScript', 'PowerShell', 'Python', 'SQL', 'Bash'],
  },
  {
    title: 'Web Development',
    color: '#2DD4BF', // teal
    glyph: 'hexagon',
    items: ['Next.js', 'React', 'Node.js', 'Vercel', 'REST API'],
  },
  {
    title: 'Tools & Platforms',
    color: '#059669', // deep emerald
    glyph: 'triangle',
    items: ['Git', 'GitHub', 'Docker', 'TryHackMe', 'Active Directory'],
  },
];

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.39996 rad
/**
 * Layout. The four hubs keep their XY compass positions (the home view stays
 * familiar) but sit at strongly alternating depths with a vertical stagger, and
 * each hub's leaves are spread over a Fibonacci shell around it — so the graph
 * is a volume, not a disc, and never collapses into a sliver as it turns.
 */
const HUB_RADIUS = 3.7;
/** Alternating hub depth (left/right hubs come forward, top/bottom recede). */
const HUB_DEPTH = 2.2;
/** Vertical stagger: pulls the top/bottom hubs in and tilts the left/right pair. */
const HUB_STAGGER = 0.6;
const HUB_STAGGER_SIGN = [1, -1, -1, 1];
/** Leaf shell radius range around a hub (inner leaves first). */
const LEAF_SHELL_MIN = 1.05;
const LEAF_SHELL_MAX = 1.75;
/** How far the shell reaches towards / away from the camera (unit-sphere z). */
const LEAF_SHELL_Z = 0.75;
/** Leaves lean away from the graph centre so clusters open outwards. */
const LEAF_OUTWARD_BIAS = 0.35;
// Minimum leaf offset from its hub in the XY plane — keeps every leaf clear of
// its hub so the hub's emblem, label and hit-target never get buried under a
// skill node in the home view.
const LEAF_MIN_RADIUS = 0.95;

/**
 * The hub's DOM label hangs just above its plate. A leaf sitting in that band
 * would be hidden under the label in the home view, so each cluster's shell is
 * rotated (about the view axis) to the phase that keeps the band clearest.
 * Scene units, relative to the hub: |x| < LABEL_ZONE_X, LABEL_ZONE_Y0 < y < LABEL_ZONE_Y1.
 */
const LABEL_ZONE_X = 1.7;
const LABEL_ZONE_Y0 = 0.5;
const LABEL_ZONE_Y1 = 1.25;
const PHASE_STEPS = 36;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Offset of leaf `li` (of `count`) from its hub, for a shell rotated by `phase`. */
function leafOffset(
  li: number,
  count: number,
  ux: number,
  uy: number,
  phase: number,
): [number, number, number] {
  const u = (li + 0.5) / count;
  const phi = li * GOLDEN_ANGLE + phase;
  const z = lerp(-LEAF_SHELL_Z, LEAF_SHELL_Z, u);
  const ring = Math.sqrt(1 - z * z);
  // Unit direction on the shell, biased away from the graph centre.
  let dx = Math.cos(phi) * ring + ux * LEAF_OUTWARD_BIAS;
  let dy = Math.sin(phi) * ring + uy * LEAF_OUTWARD_BIAS;
  let dz = z;
  const len = Math.hypot(dx, dy, dz) || 1;
  const r = lerp(LEAF_SHELL_MIN, LEAF_SHELL_MAX, Math.sqrt(u));
  dx = (dx / len) * r;
  dy = (dy / len) * r;
  dz = (dz / len) * r;
  // Enforce the XY clearance from the hub (see LEAF_MIN_RADIUS).
  const flat = Math.hypot(dx, dy);
  if (flat < LEAF_MIN_RADIUS) {
    const k = flat > 1e-4 ? LEAF_MIN_RADIUS / flat : 0;
    dx = flat > 1e-4 ? dx * k : ux * LEAF_MIN_RADIUS;
    dy = flat > 1e-4 ? dy * k : uy * LEAF_MIN_RADIUS;
  }
  return [dx, dy, dz];
}

/** Shell phase that leaves the fewest leaves (then the most margin) in the label zone. */
function bestShellPhase(count: number, ux: number, uy: number): number {
  let best = 0;
  let bestCost = Infinity;
  for (let s = 0; s < PHASE_STEPS; s++) {
    const phase = (s / PHASE_STEPS) * Math.PI * 2;
    let inside = 0;
    let margin = Infinity;
    for (let li = 0; li < count; li++) {
      const [dx, dy] = leafOffset(li, count, ux, uy, phase);
      // Distance outside the zone rectangle (0 when inside it).
      const ox = Math.max(0, Math.abs(dx) - LABEL_ZONE_X);
      const oy = Math.max(0, LABEL_ZONE_Y0 - dy, dy - LABEL_ZONE_Y1);
      const out = Math.hypot(ox, oy);
      if (out === 0) inside++;
      margin = Math.min(margin, out);
    }
    const cost = inside * 10 - Math.min(margin, 1);
    if (cost < bestCost - 1e-9) {
      bestCost = cost;
      best = phase;
    }
  }
  return best;
}

export function buildSkillsGraph(): GraphData {
  const nodes: SkillNode[] = [];
  const links: SkillLink[] = [];
  const clusters: Cluster[] = [];
  const hubIndices: number[] = [];
  const n = CATEGORIES.length;

  CATEGORIES.forEach((cat, ci) => {
    const angle = (ci / n) * Math.PI * 2;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const center: [number, number, number] = [
      ux * HUB_RADIUS,
      uy * HUB_RADIUS + HUB_STAGGER * HUB_STAGGER_SIGN[ci % HUB_STAGGER_SIGN.length],
      (ci % 2 === 0 ? 1 : -1) * HUB_DEPTH,
    ];
    clusters.push({ index: ci, title: cat.title, color: cat.color, glyph: cat.glyph, center });

    const hubIdx = nodes.length;
    hubIndices.push(hubIdx);
    nodes.push({ id: `${ci}-hub`, label: cat.title, cluster: ci, position: center, isHub: true });

    // Leaves on a Fibonacci shell around the hub (even, deterministic, 3D).
    const count = cat.items.length;
    const phase = bestShellPhase(count, ux, uy);
    cat.items.forEach((item, li) => {
      const [dx, dy, dz] = leafOffset(li, count, ux, uy, phase);
      const pos: [number, number, number] = [center[0] + dx, center[1] + dy, center[2] + dz];
      const leafIdx = nodes.length;
      nodes.push({ id: `${ci}-${li}`, label: item, cluster: ci, position: pos, isHub: false });
      links.push({ a: hubIdx, b: leafIdx });
    });
  });

  // Ring connecting the hubs (inter-domain relationships).
  for (let i = 0; i < hubIndices.length; i++) {
    links.push({ a: hubIndices[i], b: hubIndices[(i + 1) % hubIndices.length] });
  }

  return { nodes, links, clusters };
}

/** Baked once at module load. */
export const GRAPH = buildSkillsGraph();
