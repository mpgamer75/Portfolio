/**
 * Certifications shown at the bottom of the Skills section, newest first.
 *
 * `media` is either a local badge image under public/images/certs/ (preferred
 * once the owner supplies one) or a procedural emblem: a short mono code drawn
 * on an emerald tile. No remote images, so the CSP needs no extra hosts.
 *
 * Optional fields are simply omitted when unknown — the card is designed to
 * look complete without a date, credential id or verify link.
 */

export type CertificationMedia =
  | { kind: 'image'; src: string }
  | { kind: 'emblem'; code: string };

export interface Certification {
  name: string;
  /** One-line expansion of the name (e.g. what an acronym stands for). */
  subtitle?: string;
  issuer: string;
  /** Human-readable issue date, e.g. "March 2026". */
  issued?: string;
  credentialId?: string;
  /** Public verification page. The card renders a Verify link only when set. */
  verifyUrl?: string;
  skills?: string[];
  media: CertificationMedia;
}

export const certifications: Certification[] = [
  {
    name: 'Qualys Certified Specialist - VMDR',
    subtitle: 'Vulnerability Management, Detection & Response',
    issuer: 'Qualys',
    // No verifyUrl / issued yet: the owner will supply the certificate PDF.
    media: { kind: 'emblem', code: 'VMDR' },
  },
  {
    name: 'CompTIA Security+',
    issuer: 'CompTIA',
    verifyUrl: 'https://www.credly.com/badges/892d3bff-6d4f-4b21-bdf7-2a14d28c5985/public_url',
    media: { kind: 'emblem', code: 'SEC+' },
  },
  {
    name: 'Cisco Introduction to Cybersecurity',
    issuer: 'Cisco',
    verifyUrl: 'https://www.credly.com/badges/606eed2a-e969-489e-8f0f-049aa12e36ad/public_url',
    media: { kind: 'emblem', code: 'CISCO' },
  },
];
