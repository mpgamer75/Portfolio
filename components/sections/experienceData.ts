/**
 * Career history for the Experience section, newest first.
 *
 * `current: true` marks the role shown in the featured card; every other role
 * goes on the timeline. Bullet text is the owner's wording — edit it here, not
 * in ExperienceSection.tsx.
 */

export type JobType = 'Full-time' | 'Internship' | 'Freelance';

export interface Job {
  title: string;
  company: string;
  location: string;
  /** Display string, e.g. "April 2025 - August 2025". */
  period: string;
  /** The role held today. At most one job should set this. */
  current?: boolean;
  type: JobType;
  /** One-sentence description shown above the highlights. */
  summary?: string;
  highlights: string[];
}

export const jobs: Job[] = [
  {
    title: 'Cybersecurity Consultant',
    company: 'HeadMind Partners',
    location: 'Paris, France',
    period: 'November 2026 - Present',
    current: true,
    type: 'Full-time',
    summary:
      'Cybersecurity consulting for client organisations, supporting their security and risk-reduction programmes',
    highlights: [],
  },
  {
    title: 'Cybersecurity Engineer Intern',
    company: 'Airbus Helicopters',
    location: 'Marignane, France',
    period: 'March 2026 - September 2026',
    type: 'Internship',
    highlights: [
      'Contribution to vulnerability management operations within a transverse security team (SOC, Endpoint Protection, Architecture): asset inventory integration (CMDB), automated data collection and classification covering workstations, servers, and industrial systems',
      'Design and implementation of a vulnerability scanning architecture to improve coverage and detection accuracy in the enterprise environment, including OT/IT convergence zones',
      'Development of predictive data-analytics capabilities: correlation of vulnerability data with asset criticality to prioritize remediation and model cybersecurity impact, applying machine-learning principles',
      "Development of a real-time dashboard with KPIs and predictive indicators, integrated into the security department's governance framework to drive corrective-action plans",
    ],
  },
  {
    title: 'Cybersecurity Engineer Intern',
    company: 'AlticeDo',
    location: 'Santo Domingo, Dominican Republic',
    period: 'April 2025 - August 2025',
    type: 'Internship',
    highlights: [
      'Security incident response management (SOC) through forensic analysis and advanced response coordination',
      'Deployment and configuration of Fortinet solutions (FortiGate, FortiMail Cloud, FortiAnalyzer)',
      'Trellix EDR solutions administration and Active Directory audit report automation',
      'Threat analysis using OSINT tools',
    ],
  },
  {
    title: 'Business Discovery Intern',
    company: 'General Consulate of the Dominican Republic',
    location: 'Paris, France',
    period: 'June 2024 - July 2024',
    type: 'Internship',
    highlights: [
      'Optimization of administrative workflows through technical solutions implementation',
      'Document management automation',
      'Financial and organizational operations analysis',
    ],
  },
  {
    title: 'Independent Contractor',
    company: 'Student Pop Platform',
    location: 'Paris, France',
    period: 'February 2024 - September 2025',
    type: 'Freelance',
    highlights: [
      'Event and technical missions for various clients (Coca-Cola, Wild Code School)',
      'Logistics coordination and Python educational content development',
    ],
  },
];
