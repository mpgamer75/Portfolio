/**
 * Deterministic node-graph for the 3D Skills Constellation.
 *
 * Pure data + a stable layout (trig + golden-angle spiral, no runtime randomness),
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
// Push hubs further apart and tighten the leaf spiral so the four domains read
// as distinct clouds rather than one central blob; alternate depth for parallax.
const HUB_RADIUS = 3.7;
const LEAF_RADIUS = 1.7;
// Innermost leaf offset — keeps every leaf clear of its hub so the hub's label
// and hit-target never get buried under a skill node.
const LEAF_MIN_RADIUS = 0.85;

export function buildSkillsGraph(): GraphData {
  const nodes: SkillNode[] = [];
  const links: SkillLink[] = [];
  const clusters: Cluster[] = [];
  const hubIndices: number[] = [];
  const n = CATEGORIES.length;

  CATEGORIES.forEach((cat, ci) => {
    const angle = (ci / n) * Math.PI * 2;
    const z = (ci % 2 === 0 ? 1 : -1) * 1.0; // alternate depth for parallax separation
    const center: [number, number, number] = [
      Math.cos(angle) * HUB_RADIUS,
      Math.sin(angle) * HUB_RADIUS,
      z,
    ];
    clusters.push({ index: ci, title: cat.title, color: cat.color, glyph: cat.glyph, center });

    const hubIdx = nodes.length;
    hubIndices.push(hubIdx);
    nodes.push({ id: `${ci}-hub`, label: cat.title, cluster: ci, position: center, isHub: true });

    // Leaves spread around the hub via a golden-angle spiral (even, deterministic).
    cat.items.forEach((item, li) => {
      const a = li * GOLDEN_ANGLE;
      const spread = cat.items.length > 1 ? li / (cat.items.length - 1) : 1;
      const r = LEAF_MIN_RADIUS + (LEAF_RADIUS - LEAF_MIN_RADIUS) * Math.sqrt(spread);
      const pos: [number, number, number] = [
        center[0] + Math.cos(a) * r,
        center[1] + Math.sin(a) * r,
        center[2] + Math.cos(a * 1.3) * 0.55,
      ];
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
