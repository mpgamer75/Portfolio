/**
 * Deterministic node-graph for the 3D Skills Constellation.
 *
 * Pure data + a stable layout (trig only, no runtime randomness), so the
 * constellation starts identically on every load. No React, no three here.
 *
 * The graph is an orrery: one core in the middle, the four domain hubs on a
 * shared orbit around it (the XZ plane — the scene tilts it towards the camera),
 * and each domain's skills on one or two rings around their hub. The rings turn
 * at run time (see orbitSim.ts); the positions baked here are the t = 0 pose.
 *
 * NOTE: the skill lists mirror `skillCategories` in components/sections/SkillsSection.tsx
 * (which is the accessible, on-page source of truth). Keep the two in sync.
 */

export type NodeKind = 'core' | 'hub' | 'leaf';

export interface SkillNode {
  id: string;
  label: string;
  /** Domain index, or -1 for the core. */
  cluster: number;
  /** Position at t = 0, graph-local. Leaves move at run time. */
  position: [number, number, number];
  kind: NodeKind;
  /** Domain hubs only (the core is not a hub). */
  isHub: boolean;
  /** Leaves: radius of the ring it rides around its hub, and its angle on it at t = 0. */
  ringRadius: number;
  ringAngle: number;
}

export type LinkKind = 'trunk' | 'spoke' | 'cross';

/** Link between two nodes, stored as indices into `GraphData.nodes`. */
export interface SkillLink {
  a: number;
  b: number;
  /** trunk: core → hub · spoke: hub → skill · cross: two skills that work together. */
  kind: LinkKind;
}

/** Hub emblem — each domain gets its own outline shape as well as its own tint. */
export type ClusterGlyph = 'circle' | 'diamond' | 'hexagon' | 'triangle';

export interface Cluster {
  index: number;
  title: string;
  color: string;
  glyph: ClusterGlyph;
  center: [number, number, number];
  /** Unit normal of the plane this domain's skills orbit in (resting pose). */
  normal: [number, number, number];
  /** Radii of the skill rings around the hub (one or two). */
  rings: number[];
  /** Angular speed of the rings, rad/s (sign = direction). */
  spin: number;
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
    items: ['Git', 'GitHub', 'Docker', 'TryHackMe', 'Hack The Box', 'Active Directory'],
  },
];

/**
 * Skills from different domains that are used together (same project or role in
 * skillsMeta.ts). Drawn as faint arcs across the system; they light up with
 * either end. Labels must match the item names above exactly.
 */
const CROSS_LINKS: [string, string][] = [
  ['Bash', 'Linux'], // Security Scanner, Encryptor
  ['Bash', 'GitHub'], // Encryptor's GitHub Actions packaging
  ['Python', 'OSINT'], // IoC correlation at the SOC
  ['PowerShell', 'Active Directory'], // AD audit scripting
  ['Trellix EDR', 'Active Directory'], // automated AD audit reports
  ['Kali Linux', 'Hack The Box'], // pentest labs
  ['Kali Linux', 'TryHackMe'],
  ['Metasploit', 'Hack The Box'],
  ['JavaScript', 'Next.js'], // SABER
  ['JavaScript', 'Node.js'],
  ['TypeScript', 'React'], // this portfolio
  ['TypeScript', 'Next.js'],
  ['SQL', 'REST API'], // Mi SaludRD
  ['Vercel', 'GitHub'], // deploy pipeline
  ['Docker', 'Linux'], // labs
];

export const CORE_LABEL = '<CL />';

/** Radius of the orbit the four hubs share. */
export const ORBIT_RADIUS = 5.4;
/** First hub's angle on the orbit: 45° puts the hubs on the diagonals of the home view. */
const ORBIT_PHASE = Math.PI / 4;
/** Hubs ride a little above / below the orbital plane so the system has volume. */
const HUB_LIFT = [0.55, -0.5, 0.4, -0.6];
/**
 * How far each domain's ring plane leans off the orbital plane (tan of the
 * angle). Kept well under the scene's tilt, so no ring is ever seen edge-on.
 */
const RING_LEAN = 0.24;
const RING_SPIN = [0.1, -0.085, 0.12, -0.095];

/** Ring radii by skill count: up to six ride one ring, more are split over two. */
function ringPlan(count: number): { radii: number[]; sizes: number[] } {
  if (count <= 5) return { radii: [1.35], sizes: [count] };
  if (count <= 6) return { radii: [1.5], sizes: [count] };
  const inner = Math.floor((count - 1) / 2);
  return { radii: [1.05, 1.75], sizes: [inner, count - inner] };
}

/**
 * Angular offset of the inner ring that keeps its skills as far as possible (in
 * angle) from the outer ring's — the two rings turn together, so the spacing
 * found here holds for good.
 */
function interleave(inner: number, outer: number): number {
  let best = 0;
  let bestGap = -1;
  const STEPS = 90;
  for (let s = 0; s < STEPS; s++) {
    const offset = (s / STEPS) * ((Math.PI * 2) / inner);
    let gap = Infinity;
    for (let i = 0; i < inner; i++) {
      const a = offset + (i / inner) * Math.PI * 2;
      for (let o = 0; o < outer; o++) {
        const b = (o / outer) * Math.PI * 2;
        const d = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
        gap = Math.min(gap, d);
      }
    }
    if (gap > bestGap + 1e-9) {
      bestGap = gap;
      best = offset;
    }
  }
  return best;
}

type Vec3 = [number, number, number];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Orthonormal basis (u, v) of the plane with unit normal `n`; u × v = n. */
export function planeBasis(n: Vec3): { u: Vec3; v: Vec3 } {
  const ref: Vec3 = Math.abs(n[0]) < 0.8 ? [1, 0, 0] : [0, 0, 1];
  const u = normalize(cross(ref, n));
  const v = cross(n, u);
  return { u, v };
}

export function buildSkillsGraph(): GraphData {
  const nodes: SkillNode[] = [];
  const links: SkillLink[] = [];
  const clusters: Cluster[] = [];
  const hubIndices: number[] = [];
  const byLabel = new Map<string, number>();
  const n = CATEGORIES.length;

  CATEGORIES.forEach((cat, ci) => {
    const angle = ORBIT_PHASE + (ci / n) * Math.PI * 2;
    const center: Vec3 = [
      Math.cos(angle) * ORBIT_RADIUS,
      HUB_LIFT[ci % HUB_LIFT.length],
      Math.sin(angle) * ORBIT_RADIUS,
    ];
    // Ring plane: the orbital plane, leaned along the orbit's tangent (alternating
    // sides), so the four domains read as four differently tilted little systems.
    const lean = RING_LEAN * (ci % 2 === 0 ? 1 : -1);
    const normal = normalize([-Math.sin(angle) * lean, 1, Math.cos(angle) * lean]);
    const plan = ringPlan(cat.items.length);
    clusters.push({
      index: ci,
      title: cat.title,
      color: cat.color,
      glyph: cat.glyph,
      center,
      normal,
      rings: plan.radii,
      spin: RING_SPIN[ci % RING_SPIN.length],
    });

    const hubIdx = nodes.length;
    hubIndices.push(hubIdx);
    nodes.push({
      id: `${ci}-hub`,
      label: cat.title,
      cluster: ci,
      position: center,
      kind: 'hub',
      isHub: true,
      ringRadius: 0,
      ringAngle: 0,
    });

    const { u, v } = planeBasis(normal);
    const innerOffset = plan.sizes.length > 1 ? interleave(plan.sizes[0], plan.sizes[1]) : 0;
    let li = 0;
    plan.sizes.forEach((size, ring) => {
      const r = plan.radii[ring];
      for (let k = 0; k < size; k++, li++) {
        const a = (ring === 0 && plan.sizes.length > 1 ? innerOffset : 0) + (k / size) * Math.PI * 2;
        const cx = Math.cos(a) * r;
        const sx = Math.sin(a) * r;
        const pos: Vec3 = [
          center[0] + u[0] * cx + v[0] * sx,
          center[1] + u[1] * cx + v[1] * sx,
          center[2] + u[2] * cx + v[2] * sx,
        ];
        const leafIdx = nodes.length;
        const label = cat.items[li];
        byLabel.set(label, leafIdx);
        nodes.push({
          id: `${ci}-${li}`,
          label,
          cluster: ci,
          position: pos,
          kind: 'leaf',
          isHub: false,
          ringRadius: r,
          ringAngle: a,
        });
        links.push({ a: hubIdx, b: leafIdx, kind: 'spoke' });
      }
    });
  });

  // The core comes last, so hubs still precede their leaves and node 0 is a hub.
  const coreIdx = nodes.length;
  nodes.push({
    id: 'core',
    label: CORE_LABEL,
    cluster: -1,
    position: [0, 0, 0],
    kind: 'core',
    isHub: false,
    ringRadius: 0,
    ringAngle: 0,
  });
  for (const hub of hubIndices) links.push({ a: coreIdx, b: hub, kind: 'trunk' });

  for (const [from, to] of CROSS_LINKS) {
    const a = byLabel.get(from);
    const b = byLabel.get(to);
    if (a === undefined || b === undefined) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`skillsGraph: cross link "${from}" – "${to}" names an unknown skill`);
      }
      continue;
    }
    links.push({ a, b, kind: 'cross' });
  }

  return { nodes, links, clusters };
}

/** Baked once at module load. */
export const GRAPH = buildSkillsGraph();
