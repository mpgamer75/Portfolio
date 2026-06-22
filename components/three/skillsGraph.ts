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

export interface Cluster {
  index: number;
  title: string;
  color: string;
  center: [number, number, number];
}

export interface GraphData {
  nodes: SkillNode[];
  links: SkillLink[];
  clusters: Cluster[];
}

/**
 * Four domains. Each gets a distinct swatch from the emerald/teal family —
 * stepped (not a gradient) and kept on-brand, but spread enough in hue+lightness
 * that the clusters are tellable apart (the legend keys them, the hover/focus
 * interaction confirms them). The signature emerald (#34D399) leads.
 */
const CATEGORIES: { title: string; color: string; items: string[] }[] = [
  {
    title: 'Security & Systems',
    color: '#34D399', // signature emerald
    items: ['Kali Linux', 'Linux', 'Nmap', 'Wireshark', 'Metasploit', 'Fortinet', 'Trellix EDR', 'OSINT'],
  },
  {
    title: 'Programming',
    color: '#6EE7B7', // light mint
    items: ['C', 'C#', 'Java', 'JavaScript', 'TypeScript', 'PowerShell', 'Python', 'SQL', 'Bash'],
  },
  {
    title: 'Web Development',
    color: '#2DD4BF', // teal
    items: ['Next.js', 'React', 'Node.js', 'Vercel', 'REST API'],
  },
  {
    title: 'Tools & Platforms',
    color: '#10B981', // deep emerald
    items: ['Git', 'GitHub', 'Docker', 'TryHackMe', 'Active Directory'],
  },
];

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.39996 rad
// Push hubs further apart and tighten the leaf spiral so the four domains read
// as distinct clouds rather than one central blob; alternate depth for parallax.
const HUB_RADIUS = 3.7;
const LEAF_RADIUS = 1.55;

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
    clusters.push({ index: ci, title: cat.title, color: cat.color, center });

    const hubIdx = nodes.length;
    hubIndices.push(hubIdx);
    nodes.push({ id: `${ci}-hub`, label: cat.title, cluster: ci, position: center, isHub: true });

    // Leaves spread around the hub via a golden-angle spiral (even, deterministic).
    cat.items.forEach((item, li) => {
      const a = li * GOLDEN_ANGLE;
      const r = LEAF_RADIUS * Math.sqrt((li + 1) / cat.items.length);
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
