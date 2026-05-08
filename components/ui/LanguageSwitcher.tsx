'use client';

import { useTransition } from 'react';
import { motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const LOCALE_LABEL: Record<string, string> = {
  en: 'EN',
  fr: 'FR',
};

export default function LanguageSwitcher() {
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: (typeof routing.locales)[number]) => {
    if (next === currentLocale) return;
    const navigate = () =>
      startTransition(() => {
        router.replace(pathname, { locale: next });
      });

    // Progressive enhancement: cross-fade via View Transitions API where
    // supported; otherwise rely on the AnimatePresence fade in
    // LocaleTransitionWrapper.
    const docWithVT = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (typeof docWithVT.startViewTransition === 'function') {
      docWithVT.startViewTransition(navigate);
    } else {
      navigate();
    }
  };

  return (
    <div
      role="group"
      aria-label="Language"
      className="relative flex items-center gap-0.5 rounded-full border border-cyber-primary/20 bg-cyber-darker/60 backdrop-blur-xs px-1 py-0.5"
    >
      {routing.locales.map((loc) => {
        const isActive = loc === currentLocale;
        return (
          <button
            key={loc}
            onClick={() => switchTo(loc)}
            disabled={isPending && !isActive}
            aria-pressed={isActive}
            aria-label={`Switch to ${LOCALE_LABEL[loc]}`}
            className={`relative z-10 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider rounded-full transition-colors ${
              isActive
                ? 'text-cyber-darker'
                : 'text-cyber-accent hover:text-cyber-primary'
            } ${isPending ? 'cursor-wait' : 'cursor-pointer'}`}
          >
            {isActive && (
              <motion.span
                layoutId="lang-pill"
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-full bg-cyber-primary"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            {LOCALE_LABEL[loc]}
          </button>
        );
      })}
    </div>
  );
}
