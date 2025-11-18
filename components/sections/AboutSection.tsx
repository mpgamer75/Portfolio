'use client';

import { motion } from 'framer-motion';
import { MapPin, GraduationCap, Calendar } from 'lucide-react';
import Image from 'next/image';

export default function AboutSection() {
  return (
    <section id="about" className="relative py-12 sm:py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 sm:mb-4">
            <span className="text-cyber-primary">About Me</span>
          </h2>
          <div className="w-20 sm:w-24 h-1 bg-cyber-primary mx-auto mb-8 sm:mb-12 md:mb-16" />

          <div className="grid md:grid-cols-2 gap-8 sm:gap-10 md:gap-12 items-center">
            {/* Image container */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative order-2 md:order-1"
            >
              <div className="relative w-full aspect-square max-w-sm sm:max-w-md mx-auto group">
                {/* Decorative border with hover effect - Optimized */}
                <div
                  className="decorative-border absolute inset-0 border-2 border-cyber-primary rounded-lg smooth-transition group-hover:border-cyber-secondary"
                  style={{
                    transform: 'translate(12px, 12px)',
                    willChange: 'transform',
                  }}
                />

                {/* Image container with hover effects - Performance optimized */}
                <div
                  className="relative rounded-lg h-full w-full overflow-hidden border-2 border-cyber-primary/50 group-hover:border-cyber-primary smooth-transition group-hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] sm:group-hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                  style={{
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  {/* Overlay gradient on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyber-primary/0 to-cyber-primary/10 opacity-0 group-hover:opacity-100 smooth-transition z-10" />

                  {/* Image with optimized zoom effect */}
                  <div
                    className="relative w-full h-full overflow-hidden"
                    style={{
                      transform: 'translateZ(0)',
                      willChange: 'transform',
                    }}
                  >
                    <Image
                      src="/images/hero/photo_hero.jpg"
                      alt="Charles Lantigua Jorge"
                      fill
                      className="object-cover smooth-transition-slow group-hover:scale-105 sm:group-hover:scale-110"
                      priority
                      quality={90}
                      sizes="(max-width: 768px) 90vw, 45vw"
                      style={{
                        transform: 'translateZ(0)',
                        backfaceVisibility: 'hidden',
                      }}
                    />
                  </div>

                  {/* Shine effect on hover - GPU accelerated */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 smooth-transition-slow pointer-events-none">
                    <div
                      className="shine-effect absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      style={{
                        transform: 'translateX(-100%)',
                        transition: 'transform 1s ease-in-out',
                        willChange: 'transform',
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="space-y-4 sm:space-y-6 order-1 md:order-2"
            >
              <p className="text-base sm:text-lg text-white leading-relaxed font-medium">
                Computer Science and Cybersecurity Engineering student at ECE Paris, I specialize in offensive security, tool development and threat analysis. With hands-on experience in SOC, pentesting and secure application development, I constantly seek to deepen my technical skills.
              </p>

              <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-6">
                <div className="flex items-center space-x-3 text-white">
                  <MapPin className="text-cyber-primary flex-shrink-0" size={20} />
                  <span className="font-medium text-sm sm:text-base">Paris, France</span>
                </div>
                
                <div className="flex items-center space-x-3 text-white">
                  <GraduationCap className="text-cyber-primary flex-shrink-0" size={20} />
                  <span className="font-medium text-sm sm:text-base">Master&apos;s Student - ECE Paris</span>
                </div>
                
                <div className="flex items-center space-x-3 text-white">
                  <Calendar className="text-cyber-primary flex-shrink-0" size={20} />
                  <span className="font-medium text-sm sm:text-base">Available for internships</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-6 sm:pt-8">
                <motion.div 
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="cyber-card rounded-lg p-3 sm:p-4 text-center cursor-default"
                >
                  <div className="text-2xl sm:text-3xl font-bold text-cyber-primary mb-1">10+</div>
                  <div className="text-xs sm:text-sm text-white font-medium">Projects</div>
                </motion.div>
                
                <motion.div 
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="cyber-card rounded-lg p-3 sm:p-4 text-center cursor-default"
                >
                  <div className="text-2xl sm:text-3xl font-bold text-cyber-primary mb-1">3</div>
                  <div className="text-xs sm:text-sm text-white font-medium">Internships</div>
                </motion.div>
                
                <motion.div 
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="cyber-card rounded-lg p-3 sm:p-4 text-center cursor-default"
                >
                  <div className="text-lg sm:text-2xl font-bold text-cyber-primary mb-1">Trilingual</div>
                  <div className="text-[10px] sm:text-xs text-white font-medium leading-tight">French, Spanish, English</div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}