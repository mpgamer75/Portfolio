/**
 * Deterministic layout for the 3D Skills star system.
 *
 * Each skill domain is a planet; its skills are moons on two equatorial orbits.
 * Shipping lanes join neighbouring planets. Pure data + a stable layout (trig
 * only, no runtime randomness), so the system looks identical on every load.
 * No React, no three here.
 *
 * NOTE: the skill lists mirror `skillCategories` in components/sections/SkillsSection.tsx
 * (which is the accessible, on-page source of truth). Keep the two in sync.
 */

export type Vec3 = [number, number, number];

export interface SkillNode {
  id: string;
  label: string;
  cluster: number;
  /** Planet centre for a hub; the moon's position at orbit phase 0 for a leaf. */
  position: Vec3;
  isHub: boolean;
  /** Leaves only: orbit radius (scene units), start angle and angular speed (rad/s). */
  orbitRadius: number;
  orbitPhase: number;
  orbitSpeed: number;
  /** Leaves only: 0 = inner orbit, 1 = outer orbit. */
  orbit: number;
}

/** Hub emblem — each domain gets its own outline shape as well as its own tint. */
export type ClusterGlyph = 'circle' | 'diamond' | 'hexagon' | 'triangle';

/** Surface model drawn for a domain's planet (see bodyLayer.ts). */
export type PlanetKind = 'terran' | 'ice' | 'gas' | 'forge';

export interface Cluster {
  index: number;
  title: string;
  color: string;
  glyph: ClusterGlyph;
  planet: PlanetKind;
  center: Vec3;
  /** Planet radius (scene units). */
  radius: number;
  /** Spin axis = normal of the moons' orbital plane (unit vector). */
  axis: Vec3;
  /** Orthonormal basis of the orbital plane. */
  u: Vec3;
  v: Vec3;
  /** Inner and outer moon orbit radii (scene units). */
  orbits: [number, number];
}

/** Shipping lane between two neighbouring planets (indices into `clusters`). */
export interface Lane {
  a: number;
  b: number;
}

export interface GraphData {
  nodes: SkillNode[];
  clusters: Cluster[];
  lanes: Lane[];
}

interface Category {
  title: string;
  color: string;
  glyph: ClusterGlyph;
  planet: PlanetKind;
  /** Planet radius (scene units). */
  radius: number;
  /**
   * Orbital-plane tilt away from the line of sight (0 = seen face-on, as a
   * circle; 90 = edge-on), and the screen direction it leans towards (degrees).
   */
  tilt: number;
  lean: number;
  /** Orbit radii in planet radii. */
  orbits: [number, number];
  items: string[];
}

/**
 * Four domains. Each is keyed three ways so they're tellable apart at a glance:
 * a distinct luminance step within the emerald/teal family (signature emerald
 * leading), a distinct glyph shape (legend, hub labels, detail card) and a
 * distinct kind of world.
 */
const CATEGORIES: Category[] = [
  {
    title: 'Security & Systems',
    color: '#34D399', // signature emerald
    glyph: 'circle',
    planet: 'terran',
    radius: 0.62,
    tilt: 55,
    lean: 58,
    orbits: [2.15, 3.1],
    items: [
      'Vulnerability Management',
      'Qualys',
      'Kali Linux',
      'Linux',
      'Nmap',
      'Wireshark',
      'Metasploit',
      'Fortinet',
      'Trellix EDR',
      'OSINT',
    ],
  },
  {
    title: 'Programming',
    color: '#A7F3D0', // light mint
    glyph: 'diamond',
    planet: 'ice',
    radius: 0.56,
    tilt: 57,
    lean: 108,
    orbits: [2.25, 3.3],
    items: ['C', 'C#', 'Java', 'JavaScript', 'TypeScript', 'PowerShell', 'Python', 'SQL', 'Bash'],
  },
  {
    title: 'Web Development',
    color: '#2DD4BF', // teal
    glyph: 'hexagon',
    planet: 'gas',
    radius: 0.68,
    tilt: 64,
    lean: 80,
    orbits: [2.4, 3.15],
    items: ['Next.js', 'React', 'Node.js', 'Supabase', 'Stripe', 'Vercel', 'REST API'],
  },
  {
    title: 'Tools & Platforms',
    color: '#059669', // deep emerald
    glyph: 'triangle',
    planet: 'forge',
    radius: 0.58,
    tilt: 54,
    lean: 148,
    orbits: [2.2, 3.2],
    items: ['Git', 'GitHub', 'Docker', 'Flutter', 'Tauri', 'TryHackMe', 'Hack The Box', 'Active Directory'],
  },
];

/**
 * Layout. The four planets keep their XY compass positions around the star
 * (the home view stays familiar) but sit at strongly alternating depths with a
 * vertical stagger — so the system is a volume, not a disc, and never collapses
 * into a sliver as it turns.
 */
const HUB_RADIUS = 3.7;
/** Alternating planet depth (left/right come forward, top/bottom recede). */
const HUB_DEPTH = 2.2;
/** Vertical stagger: pulls the top/bottom planets in and tilts the left/right pair. */
const HUB_STAGGER = 0.6;
const HUB_STAGGER_SIGN = [1, -1, -1, 1];
/** Share of a domain's moons that ride the inner orbit. */
const INNER_SHARE = 0.4;
/** Angular speed (rad/s) of a moon one scene unit from its planet; falls off as r^-1.5. */
const ORBIT_RATE = 0.115;

/**
 * Where the home camera sits (must match HOME_Z in sceneShared.ts). Each
 * orbital plane is tilted relative to the line of sight from here to its own
 * planet, so every system opens towards the viewer by the same amount — a
 * plane tilted relative to the stage axis instead would read edge-on for the
 * planets off to the sides.
 */
const HOME_EYE: Vec3 = [0, 0, 11.5];

const DEG = Math.PI / 180;

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Point on a cluster's orbital plane at `radius` and `angle`. */
export function orbitPoint(c: Cluster, radius: number, angle: number): Vec3 {
  const cs = Math.cos(angle) * radius;
  const sn = Math.sin(angle) * radius;
  return [
    c.center[0] + c.u[0] * cs + c.v[0] * sn,
    c.center[1] + c.u[1] * cs + c.v[1] * sn,
    c.center[2] + c.u[2] * cs + c.v[2] * sn,
  ];
}

export function buildSkillsGraph(): GraphData {
  const nodes: SkillNode[] = [];
  const clusters: Cluster[] = [];
  const n = CATEGORIES.length;

  CATEGORIES.forEach((cat, ci) => {
    const angle = (ci / n) * Math.PI * 2;
    const center: Vec3 = [
      Math.cos(angle) * HUB_RADIUS,
      Math.sin(angle) * HUB_RADIUS + HUB_STAGGER * HUB_STAGGER_SIGN[ci % HUB_STAGGER_SIGN.length],
      (ci % 2 === 0 ? 1 : -1) * HUB_DEPTH,
    ];
    const tilt = cat.tilt * DEG;
    const lean = cat.lean * DEG;
    // Frame facing the home camera: w points at the eye, e1/e2 span the screen.
    const w = normalize([HOME_EYE[0] - center[0], HOME_EYE[1] - center[1], HOME_EYE[2] - center[2]]);
    const e1 = normalize(cross([0, 1, 0], w));
    const e2 = cross(w, e1);
    const st = Math.sin(tilt);
    const ct = Math.cos(tilt);
    const axis: Vec3 = normalize([
      w[0] * ct + (e1[0] * Math.cos(lean) + e2[0] * Math.sin(lean)) * st,
      w[1] * ct + (e1[1] * Math.cos(lean) + e2[1] * Math.sin(lean)) * st,
      w[2] * ct + (e1[2] * Math.cos(lean) + e2[2] * Math.sin(lean)) * st,
    ]);
    const u = normalize(cross(axis, w));
    const v = normalize(cross(axis, u));
    const cluster: Cluster = {
      index: ci,
      title: cat.title,
      color: cat.color,
      glyph: cat.glyph,
      planet: cat.planet,
      center,
      radius: cat.radius,
      axis,
      u,
      v,
      orbits: [cat.orbits[0] * cat.radius, cat.orbits[1] * cat.radius],
    };
    clusters.push(cluster);

    nodes.push({
      id: `${ci}-hub`,
      label: cat.title,
      cluster: ci,
      position: center,
      isHub: true,
      orbitRadius: 0,
      orbitPhase: 0,
      orbitSpeed: 0,
      orbit: 0,
    });

    // Moons: evenly spaced on two coplanar orbits, the inner one faster (Kepler-ish).
    // Neighbouring systems turn in opposite directions.
    const count = cat.items.length;
    const inner = Math.max(1, Math.round(count * INNER_SHARE));
    const dir = ci % 2 === 0 ? 1 : -1;
    cat.items.forEach((item, li) => {
      const orbit = li < inner ? 0 : 1;
      const onOrbit = orbit === 0 ? inner : count - inner;
      const slot = orbit === 0 ? li : li - inner;
      const radius = cluster.orbits[orbit];
      const phase = (slot / onOrbit) * Math.PI * 2 + ci * 1.3 + orbit * 0.9;
      nodes.push({
        id: `${ci}-${li}`,
        label: item,
        cluster: ci,
        position: orbitPoint(cluster, radius, phase),
        isHub: false,
        orbitRadius: radius,
        orbitPhase: phase,
        orbitSpeed: (dir * ORBIT_RATE) / Math.pow(radius, 1.5),
        orbit,
      });
    });
  });

  // Lanes join each planet to the next one round the star.
  const lanes: Lane[] = [];
  for (let i = 0; i < n; i++) lanes.push({ a: i, b: (i + 1) % n });

  return { nodes, clusters, lanes };
}

/** Baked once at module load. */
export const GRAPH = buildSkillsGraph();
