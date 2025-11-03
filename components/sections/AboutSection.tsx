'use client';

import { motion } from 'framer-motion';
import { MapPin, GraduationCap, Calendar } from 'lucide-react';

export default function AboutSection() {
  return (
    <section id="about" className="relative py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-4">
            <span className="text-cyber-primary">About Me</span>
          </h2>
          <div className="w-24 h-1 bg-cyber-primary mx-auto mb-16" />

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Image placeholder */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative w-full aspect-square max-w-md mx-auto">
                {/* Decorative border */}
                <div className="absolute inset-0 border-2 border-cyber-primary rounded-lg transform translate-x-4 translate-y-4" />
                
                {/* Image container */}
                <div className="relative image-placeholder rounded-lg h-full w-full overflow-hidden bg-cyber-dark/50 border-2 border-cyber-primary/50">
                  {/* Placeholder text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-cyber-primary/50">
                    <svg
                      className="w-24 h-24 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <p className="text-sm font-mono">Professional Photo</p>
                    <p className="text-xs font-mono mt-2">400x400px</p>
                  </div>
                  {/* Replace with: <Image src="/images/hero/profile.jpg" alt="Charles Lantigua Jorge" fill className="object-cover" /> */}
                </div>
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="space-y-6"
            >
              <p className="text-lg text-gray-300 leading-relaxed">
                Computer Science and Cybersecurity Engineering student at ECE Paris, I specialize in offensive security, tool development and threat analysis. With hands-on experience in SOC, pentesting and secure application development, I constantly seek to deepen my technical skills.
              </p>

              <div className="space-y-4 pt-6">
                <div className="flex items-center space-x-3 text-gray-300">
                  <MapPin className="text-cyber-primary flex-shrink-0" size={24} />
                  <span>Paris, France</span>
                </div>
                
                <div className="flex items-center space-x-3 text-gray-300">
                  <GraduationCap className="text-cyber-primary flex-shrink-0" size={24} />
                  <span>Master&apos;s Student - ECE Paris</span>
                </div>
                
                <div className="flex items-center space-x-3 text-gray-300">
                  <Calendar className="text-cyber-primary flex-shrink-0" size={24} />
                  <span>Available for internships</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-8">
                <div className="cyber-card rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-cyber-primary mb-1">5+</div>
                  <div className="text-sm text-gray-400">Projects</div>
                </div>
                <div className="cyber-card rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-cyber-primary mb-1">3</div>
                  <div className="text-sm text-gray-400">Internships</div>
                </div>
                <div className="cyber-card rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-cyber-primary mb-1">9+</div>
                  <div className="text-sm text-gray-400">Languages</div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}