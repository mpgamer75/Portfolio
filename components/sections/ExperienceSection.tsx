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
    <section id="experience" className="relative py-20 bg-cyber-dark/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-center mb-4">
            <span className="text-cyber-primary">Professional Experience</span>
          </h2>
          <div className="w-24 h-1 bg-cyber-primary mx-auto mb-16" />

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-cyber-primary/30" />

            {jobs.map((job, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className={`relative mb-12 md:mb-16 ${
                  index % 2 === 0 ? 'md:pr-[50%] md:mr-8' : 'md:pl-[50%] md:ml-8'
                }`}
              >
                {/* Timeline dot */}
                <div className="hidden md:block absolute top-0 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-cyber-primary rounded-full border-4 border-cyber-darker shadow-[0_0_10px_rgba(255,255,255,0.5)]" />

                {/* Card */}
                <div className="cyber-card rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-cyber-primary/10 rounded-lg">
                        <Briefcase className="text-cyber-primary" size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{job.title}</h3>
                        <p className="text-cyber-secondary font-semibold">{job.company}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center space-x-2 text-gray-400 text-sm">
                      <MapPin size={16} className="text-cyber-primary" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-400 text-sm">
                      <Calendar size={16} className="text-cyber-primary" />
                      <span>{job.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {job.description.map((item, i) => (
                      <li key={i} className="text-gray-300 text-sm flex items-start">
                        <span className="text-cyber-primary mr-2 mt-1">▹</span>
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