/**
 * Per-skill descriptions + "where I use it" references for the Skills Constellation
 * detail card. Grounded in the CV (public/cv.pdf) and components/sections/projectsData.ts.
 *
 * `kind: 'project'` labels MUST match a `projects[].title` exactly — the detail card
 * looks them up to open that project's modal. `kind: 'role'` labels are non-clickable
 * experience/context tags (internships, CV-only work, study).
 */

export type SkillUsageKind = 'project' | 'role';

export interface SkillUsage {
  label: string;
  kind: SkillUsageKind;
}

export interface SkillMeta {
  blurb: string;
  usedIn: SkillUsage[];
}

const P = (label: string): SkillUsage => ({ label, kind: 'project' });
const R = (label: string): SkillUsage => ({ label, kind: 'role' });

export const SKILL_META: Record<string, SkillMeta> = {
  // ── Security & Systems ──
  'Kali Linux': {
    blurb: "My offensive Linux distro — the toolset behind pentest labs and the Security Scanner's recon and exploitation modules.",
    usedIn: [P('Security Scanner'), R('Pentest labs · TryHackMe')],
  },
  Linux: {
    blurb: 'The base for everything I build and break: SOC tooling, servers, and every Bash project.',
    usedIn: [P('Security Scanner'), P('Encryptor'), R('AlticeDo · SOC')],
  },
  Nmap: {
    blurb: 'Network discovery and service enumeration — the recon backbone of my Security Scanner.',
    usedIn: [P('Security Scanner')],
  },
  Wireshark: {
    blurb: 'Packet-level traffic analysis for investigating incidents and dissecting protocols.',
    usedIn: [R('AlticeDo · SOC')],
  },
  Metasploit: {
    blurb: "Exploitation and validation of findings, wired into the Security Scanner's exploitation module.",
    usedIn: [P('Security Scanner')],
  },
  Fortinet: {
    blurb: "Deployed and configured FortiGate, FortiMail Cloud and FortiAnalyzer to harden the network at AlticeDo's SOC.",
    usedIn: [R('AlticeDo · SOC')],
  },
  'Trellix EDR': {
    blurb: 'Administered endpoint detection & response and automated AD audit reports during my AlticeDo SOC internship.',
    usedIn: [R('AlticeDo · SOC')],
  },
  OSINT: {
    blurb: 'Open-source intelligence for threat analysis and reconnaissance — at the SOC and inside the Security Scanner.',
    usedIn: [R('AlticeDo · SOC'), P('Security Scanner')],
  },

  // ── Programming ──
  C: {
    blurb: 'Low-level systems programming and memory fundamentals from my CS engineering degree.',
    usedIn: [R('ECE Paris · CS')],
  },
  'C#': {
    blurb: 'Object-oriented application development from academic and side projects.',
    usedIn: [R('Engineering coursework')],
  },
  Java: {
    blurb: 'OOP and data-structures work across my engineering curriculum.',
    usedIn: [R('Engineering coursework')],
  },
  JavaScript: {
    blurb: "The language behind SABER's client-side cryptography and my earlier web builds.",
    usedIn: [P('SABER')],
  },
  TypeScript: {
    blurb: 'Typed end-to-end — this portfolio and the Mi SaludRD SaaS platform.',
    usedIn: [R('This portfolio'), R('Mi SaludRD · SaaS')],
  },
  PowerShell: {
    blurb: 'Windows automation and Active Directory audit scripting at the SOC.',
    usedIn: [R('AlticeDo · SOC')],
  },
  Python: {
    blurb: 'Built the IoC correlation app at AlticeDo and predictive vulnerability analytics at Airbus.',
    usedIn: [P('IoC App Altice'), R('Airbus · Analytics')],
  },
  SQL: {
    blurb: 'Relational data modelling and queries behind app back-ends.',
    usedIn: [R('Mi SaludRD · SaaS'), R('Engineering coursework')],
  },
  Bash: {
    blurb: 'My first reach for security tooling — the Security Scanner and the Encryptor are both Bash-first.',
    usedIn: [P('Security Scanner'), P('Encryptor')],
  },

  // ── Web Development ──
  'Next.js': {
    blurb: 'App-router React powering SABER, Mi SaludRD and this portfolio.',
    usedIn: [P('SABER'), R('This portfolio'), R('Mi SaludRD · SaaS')],
  },
  React: {
    blurb: "Component-driven UIs — including the interactive 3D layer you're exploring right now.",
    usedIn: [R('This portfolio')],
  },
  'Node.js': {
    blurb: 'Server-side JavaScript for tooling, APIs and build pipelines.',
    usedIn: [P('SABER'), R('This portfolio')],
  },
  Vercel: {
    blurb: 'Edge hosting and CI/CD — where SABER and this portfolio are deployed.',
    usedIn: [P('SABER'), R('This portfolio')],
  },
  'REST API': {
    blurb: 'Designing and consuming HTTP APIs across my web projects.',
    usedIn: [P('SABER'), R('Mi SaludRD · SaaS')],
  },

  // ── Tools & Platforms ──
  Git: {
    blurb: 'Version control for every project I ship.',
    usedIn: [P('Security Scanner'), P('Encryptor'), P('SABER')],
  },
  GitHub: {
    blurb: "Source hosting plus GitHub Actions CI — e.g. the Encryptor's automated Debian packaging.",
    usedIn: [P('Encryptor'), P('Security Scanner')],
  },
  Docker: {
    blurb: 'Containerised, reproducible environments for labs and deployments.',
    usedIn: [R('Labs & deployment')],
  },
  TryHackMe: {
    blurb: 'Continuous hands-on offensive-security practice and challenges.',
    usedIn: [R('Ongoing practice')],
  },
  'Active Directory': {
    blurb: 'Automated AD audit reporting and hardening during my AlticeDo SOC internship.',
    usedIn: [R('AlticeDo · SOC')],
  },
};

/** Safe accessor with a sensible fallback for any skill missing explicit metadata. */
export function getSkillMeta(label: string): SkillMeta {
  return SKILL_META[label] ?? { blurb: `${label} — part of my day-to-day toolkit.`, usedIn: [] };
}
