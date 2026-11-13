import DecryptedText from '@/components/ui/DecryptedText';

interface SectionHeadingProps {
  /** Heading text, rendered in the section's <h2>. */
  text: string;
  /** DecryptedText tick in ms (default 50). Use ~35 for long titles. */
  speed?: number;
  /** Optional mono line above the heading, e.g. "// 02 experience". */
  eyebrow?: string;
  /**
   * Classes for the wrapper. It carries the space below the underline, so
   * passing this REPLACES the default `mb-6 sm:mb-8`
   * (About/Experience used `mb-8 sm:mb-12 md:mb-16`).
   */
  className?: string;
}

/**
 * The shared section title: optional mono eyebrow, the decrypting <h2> and the
 * emerald `.cyber-neon` underline. Centred. Replaces the five hand-rolled
 * copies in components/sections/*.
 */
export default function SectionHeading({
  text,
  speed = 50,
  eyebrow,
  className = 'mb-6 sm:mb-8',
}: SectionHeadingProps) {
  return (
    <div className={className}>
      {eyebrow ? (
        <p className="font-mono text-xs text-cyber-brand/80 tracking-widest text-center mb-2 sm:mb-3">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 sm:mb-4 cyber-scan text-cyber-primary">
        <DecryptedText
          text={text}
          animateOn="view"
          speed={speed}
          encryptedClassName="text-cyber-brand/70"
        />
      </h2>
      <div aria-hidden="true" className="w-20 sm:w-24 h-1 bg-cyber-primary mx-auto cyber-neon" />
    </div>
  );
}
