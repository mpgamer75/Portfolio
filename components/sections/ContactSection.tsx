'use client';

import { motion } from 'framer-motion';
import { Mail, Linkedin, Github, Phone } from 'lucide-react';

export default function ContactSection() {
  const contactMethods = [
    {
      icon: Mail,
      label: 'Email',
      value: 'charleslantiguajorge@gmail.com',
      href: 'mailto:charleslantiguajorge@gmail.com',
      color: 'text-cyber-primary',
    },
    {
      icon: Linkedin,
      label: 'LinkedIn',
      value: 'Charles Lantigua Jorge',
      href: 'https://www.linkedin.com/in/charles-lantigua-jorge',
      color: 'text-cyber-secondary',
    },
    {
      icon: Github,
      label: 'GitHub',
      value: '@mpgamer75',
      href: 'https://github.com/mpgamer75',
      color: 'text-cyber-primary',
    },
    {
      icon: Phone,
      label: 'Phone',
      value: '+33 7 67 80 40 34',
      href: 'tel:+33767804034',
      color: 'text-cyber-secondary',
    },
  ];

  return (
    <section id="contact" className="relative py-12 sm:py-16 md:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 sm:mb-4">
            <span className="text-cyber-primary">Contact Me</span>
          </h2>
          <div className="w-20 sm:w-24 h-1 bg-cyber-primary mx-auto mb-6 sm:mb-8" />
          
          <p className="text-lg sm:text-xl text-gray-300 text-center max-w-2xl mx-auto mb-8 sm:mb-12 md:mb-16">
            Interested in working together? Feel free to reach out!
          </p>

          {/* Contact Cards */}
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6 mb-8 sm:mb-10 md:mb-12">
            {contactMethods.map((method, index) => {
              const Icon = method.icon;
              return (
                <motion.a
                  key={index}
                  href={method.href}
                  target={method.href.startsWith('http') ? '_blank' : undefined}
                  rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  className="cyber-card rounded-lg p-4 sm:p-5 md:p-6 flex items-center space-x-3 sm:space-x-4 cursor-pointer group"
                >
                  <div className="p-3 sm:p-4 bg-cyber-primary/10 rounded-lg flex-shrink-0">
                    <Icon className={`${method.color} group-hover:scale-110 transition-transform`} size={28} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-0.5 sm:mb-1">{method.label}</h3>
                    <p className="text-gray-400 group-hover:text-cyber-primary transition-colors text-sm sm:text-base break-words">
                      {method.value}
                    </p>
                  </div>
                </motion.a>
              );
            })}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="cyber-card rounded-lg p-6 sm:p-7 md:p-8 text-center"
          >
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
              Ready to collaborate?
            </h3>
            <p className="text-gray-300 mb-4 sm:mb-6 max-w-md mx-auto text-sm sm:text-base">
              Feel free to contact me to discuss projects, opportunities or just to chat about cybersecurity!
            </p>
            
            <a
              href="mailto:charleslantiguajorge@gmail.com"
              className="cyber-button rounded-lg inline-block"
            >
              Send message
            </a>
          </motion.div>

          {/* Additional links */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-8 sm:mt-10 md:mt-12 text-center"
          >
            <p className="text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">You can also find me on:</p>
            <div className="flex justify-center gap-4 sm:gap-6">
              <a
                href="https://github.com/mpgamer75"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-cyber-primary transition-colors"
              >
                <Github size={28} className="sm:w-8 sm:h-8" />
              </a>
              
              <a
                href="https://www.linkedin.com/in/charles-lantigua-jorge"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-cyber-primary transition-colors"
              >
                <Linkedin size={28} className="sm:w-8 sm:h-8" />
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}