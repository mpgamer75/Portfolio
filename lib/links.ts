import { Github, Linkedin, Mail, type LucideIcon } from 'lucide-react';

/**
 * Single source of truth for the site's social links and section anchors, so the
 * Hero, Navigation and Footer can't drift out of sync.
 */

export interface SocialLink {
  href: string;
  label: string;
  Icon: LucideIcon;
}

export const socialLinks: SocialLink[] = [
  { href: 'https://github.com/mpgamer75', label: 'GitHub', Icon: Github },
  {
    href: 'https://www.linkedin.com/in/charles-lantigua-jorge',
    label: 'LinkedIn',
    Icon: Linkedin,
  },
  { href: 'mailto:charleslantiguajorge@gmail.com', label: 'Email', Icon: Mail },
];

export interface NavItem {
  label: string;
  href: string;
}

export const navItems: NavItem[] = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Experience', href: '#experience' },
  { label: 'Skills', href: '#skills' },
  { label: 'Projects', href: '#projects' },
  { label: 'Contact', href: '#contact' },
];
