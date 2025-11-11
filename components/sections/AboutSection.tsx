'use client';

import { motion } from 'framer-motion';
import { MapPin, GraduationCap, Calendar } from 'lucide-react';
import Image from 'next/image';

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
            {/* Image container */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative w-full aspect-square max-w-md mx-auto group">
                {/* Decorative border with hover effect */}
                <div className="absolute inset-0 border-2 border-cyber-primary rounded-lg transform translate-x-4 translate-y-4 transition-all duration-300 group-hover:translate-x-6 group-hover:translate-y-6 group-hover:border-cyber-secondary" />
                
                {/* Image container with hover effects */}
                <div className="relative rounded-lg h-full w-full overflow-hidden border-2 border-cyber-primary/50 group-hover:border-cyber-primary transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                  {/* Overlay gradient on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyber-primary/0 to-cyber-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />
                  
                  {/* Image with zoom effect */}
                  <div className="relative w-full h-full overflow-hidden">
                    <Image 
                      src="/images/hero/photo_hero.jpg" 
                      alt="Charles Lantigua Jorge" 
                      fill 
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      priority
                      unoptimized
                    />
                  </div>
                  
                  {/* Shine effect on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
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
              className="space-y-6"
            >
              <p className="text-lg text-white leading-relaxed font-medium">
                Computer Science and Cybersecurity Engineering student at ECE Paris, I specialize in offensive security, tool development and threat analysis. With hands-on experience in SOC, pentesting and secure application development, I constantly seek to deepen my technical skills.
              </p>

              <div className="space-y-4 pt-6">
                <div className="flex items-center space-x-3 text-white">
                  <MapPin className="text-cyber-primary flex-shrink-0" size={24} />
                  <span className="font-medium">Paris, France</span>
                </div>
                
                <div className="flex items-center space-x-3 text-white">
                  <GraduationCap className="text-cyber-primary flex-shrink-0" size={24} />
                  <span className="font-medium">Master&apos;s Student - ECE Paris</span>
                </div>
                
                <div className="flex items-center space-x-3 text-white">
                  <Calendar className="text-cyber-primary flex-shrink-0" size={24} />
                  <span className="font-medium">Available for internships</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-8">
                <motion.div 
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="cyber-card rounded-lg p-4 text-center cursor-default"
                >
                  <div className="text-3xl font-bold text-cyber-primary mb-1">10+</div>
                  <div className="text-sm text-white font-medium">Projects</div>
                </motion.div>
                
                <motion.div 
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="cyber-card rounded-lg p-4 text-center cursor-default"
                >
                  <div className="text-3xl font-bold text-cyber-primary mb-1">3</div>
                  <div className="text-sm text-white font-medium">Internships</div>
                </motion.div>
                
                <motion.div 
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="cyber-card rounded-lg p-4 text-center cursor-default"
                >
                  <div className="text-2xl font-bold text-cyber-primary mb-1">Trilingual</div>
                  <div className="text-xs text-white font-medium">French, Spanish, English</div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}