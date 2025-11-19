'use client';

import { motion } from 'framer-motion';
import { Briefcase, MapPin, Calendar } from 'lucide-react';

export default function ExperienceSection() {
  const jobs = [
    {
      title: 'Cybersecurity Engineer Intern',
      company: 'AlticeDo',
      location: 'Santo Domingo, Dominican Republic',
      period: 'April 2025 - August 2025',
      description: [
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
      description: [
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
      description: [
        'Event and technical missions for various clients (Coca-Cola, Wild Code School)',
        'Logistics coordination and Python educational content development',
      ],
    },
  ];

  return (
    <section id="experience" className="relative py-12 sm:py-16 md:py-20 bg-cyber-dark/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-3 sm:mb-4 cyber-scan">
            <span className="text-cyber-primary">Professional Experience</span>
          </h2>
          <div className="w-20 sm:w-24 h-1 bg-cyber-primary mx-auto mb-8 sm:mb-12 md:mb-16 cyber-neon" />

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line - hidden on mobile */}
            <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-cyber-primary/30" />

            {jobs.map((job, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className={`relative mb-8 sm:mb-10 md:mb-12 lg:mb-16 ${
                  index % 2 === 0 ? 'md:pr-[50%] md:mr-8' : 'md:pl-[50%] md:ml-8'
                }`}
              >
                {/* Timeline dot - hidden on mobile */}
                <div className="hidden md:block absolute top-0 left-1/2 transform -translate-x-1/2 w-3 h-3 sm:w-4 sm:h-4 bg-cyber-primary rounded-full border-2 sm:border-4 border-cyber-darker shadow-[0_0_10px_rgba(255,255,255,0.5)]" />

                {/* Card */}
                <div className="cyber-card rounded-lg p-4 sm:p-5 md:p-6">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1">
                      <div className="p-1.5 sm:p-2 bg-cyber-primary/10 rounded-lg flex-shrink-0">
                        <Briefcase className="text-cyber-primary" size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg sm:text-xl font-bold text-white break-words">{job.title}</h3>
                        <p className="text-cyber-secondary font-semibold text-sm sm:text-base">{job.company}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                    <div className="flex items-center space-x-2 text-gray-400 text-xs sm:text-sm">
                      <MapPin size={14} className="text-cyber-primary flex-shrink-0" />
                      <span className="break-words">{job.location}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-400 text-xs sm:text-sm">
                      <Calendar size={14} className="text-cyber-primary flex-shrink-0" />
                      <span>{job.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-1.5 sm:space-y-2">
                    {job.description.map((item, i) => (
                      <li key={i} className="text-gray-300 text-xs sm:text-sm flex items-start">
                        <span className="text-cyber-primary mr-2 mt-0.5 flex-shrink-0">▹</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}