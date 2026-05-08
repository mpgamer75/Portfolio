'use client';

import { motion } from 'framer-motion';
import { Code2, Shield, Globe, Wrench, Award } from 'lucide-react';
import { useTranslations } from 'next-intl';
import CredlyBadge from '@/components/ui/CredlyBadge';
import SplitText from '@/components/ui/SplitText';

type CategoryKey = 'programming' | 'security' | 'web' | 'tools';

const ICON_BY_KEY: Record<CategoryKey, React.ComponentType<{ size?: number; className?: string }>> = {
  programming: Code2,
  security: Shield,
  web: Globe,
  tools: Wrench,
};

const COLOR_BY_KEY: Record<CategoryKey, string> = {
  programming: 'text-cyber-primary',
  security: 'text-cyber-secondary',
  web: 'text-cyber-accent',
  tools: 'text-cyber-primary',
};

const CATEGORY_KEYS: CategoryKey[] = ['programming', 'security', 'web', 'tools'];

export default function SkillsSection() {
  const t = useTranslations('skills');

  return (
    <section id="skills" className="relative py-12 sm:py-16 md:py-20 bg-cyber-dark/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 sm:mb-4 cyber-scan">
            <SplitText className="text-cyber-primary">{t('title')}</SplitText>
          </h2>
          <div className="w-20 sm:w-24 h-1 bg-cyber-primary mx-auto mb-8 sm:mb-12 md:mb-16 cyber-neon" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
            {CATEGORY_KEYS.map((key, index) => {
              const Icon = ICON_BY_KEY[key];
              const items = t.raw(`categories.${key}.items`) as string[];
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="cyber-card rounded-lg p-4 sm:p-5 md:p-6"
                >
                  <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
                    <div className="p-2 sm:p-3 bg-cyber-primary/10 rounded-lg shrink-0">
                      <Icon className={COLOR_BY_KEY[key]} size={24} />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white">
                      {t(`categories.${key}.title`)}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {items.map((skill, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: index * 0.1 + i * 0.05 }}
                        whileHover={{ scale: 1.1 }}
                        className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-mono bg-cyber-darker text-gray-300 border border-cyber-primary/30 rounded-lg hover:border-cyber-primary hover:text-cyber-primary transition-all duration-300 cursor-default"
                      >
                        {skill}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 sm:mt-16"
          >
            <div className="flex items-center justify-center space-x-3 mb-8">
              <Award className="text-cyber-primary" size={28} aria-hidden="true" />
              <h3 className="text-2xl sm:text-3xl font-bold text-white">
                {t('certifications.title')}
              </h3>
            </div>

            <div className="flex flex-wrap justify-center gap-6 md:gap-8">
              <div className="flex flex-col items-center">
                <CredlyBadge
                  badgeId="606eed2a-e969-489e-8f0f-049aa12e36ad"
                  width={150}
                  height={270}
                />
                <a
                  href="https://www.credly.com/badges/606eed2a-e969-489e-8f0f-049aa12e36ad/public_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-sm text-cyber-secondary hover:text-cyber-primary transition-colors"
                >
                  {t('certifications.cisco')} →
                </a>
              </div>

              <div className="flex flex-col items-center">
                <CredlyBadge
                  badgeId="892d3bff-6d4f-4b21-bdf7-2a14d28c5985"
                  width={150}
                  height={270}
                />
                <a
                  href="https://www.credly.com/badges/892d3bff-6d4f-4b21-bdf7-2a14d28c5985/public_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-sm text-cyber-secondary hover:text-cyber-primary transition-colors"
                >
                  {t('certifications.comptia')} →
                </a>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 sm:mt-12 md:mt-16 grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6"
          >
            <div className="cyber-card rounded-lg p-4 sm:p-5 md:p-6 text-center">
              <div className="text-3xl sm:text-4xl font-bold text-cyber-primary mb-2">
                {t('highlights.tryhackme.title')}
              </div>
              <p className="text-gray-400 text-sm sm:text-base">
                {t('highlights.tryhackme.description')}
              </p>
              <a
                href="https://tryhackme.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 sm:mt-4 text-cyber-secondary hover:text-cyber-primary transition-colors text-xs sm:text-sm"
              >
                {t('highlights.tryhackme.cta')} →
              </a>
            </div>

            <div className="cyber-card rounded-lg p-4 sm:p-5 md:p-6 text-center">
              <div className="text-3xl sm:text-4xl font-bold text-cyber-primary mb-2">
                {t('highlights.github.title')}
              </div>
              <p className="text-gray-400 text-sm sm:text-base">
                {t('highlights.github.description')}
              </p>
              <a
                href="https://github.com/mpgamer75"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 sm:mt-4 text-cyber-secondary hover:text-cyber-primary transition-colors text-xs sm:text-sm"
              >
                {t('highlights.github.cta')} →
              </a>
            </div>

            <div className="cyber-card rounded-lg p-4 sm:p-5 md:p-6 text-center sm:col-span-2 md:col-span-1">
              <div className="text-3xl sm:text-4xl font-bold text-cyber-primary mb-2">
                {t('highlights.school.title')}
              </div>
              <p className="text-gray-400 text-sm sm:text-base">
                {t('highlights.school.description')}
              </p>
              <p className="text-cyber-secondary mt-3 sm:mt-4 text-xs sm:text-sm">
                {t('highlights.school.period')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
