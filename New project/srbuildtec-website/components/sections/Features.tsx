'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import {
  GraduationCap,
  Award,
  Shield,
  MessageSquare,
  Clock,
  DollarSign,
  Cpu,
  Smile,
} from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import featuresData from '@/data/features.json'

const iconMap: { [key: string]: any } = {
  graduation: GraduationCap,
  award: Award,
  shield: Shield,
  message: MessageSquare,
  clock: Clock,
  dollar: DollarSign,
  cpu: Cpu,
  smile: Smile,
}

export function Features() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-20 md:py-32 bg-navy-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <Container>
        <SectionHeading
          subtitle="Why Choose Us"
          title="Excellence in Every Aspect"
          description="We combine expertise, quality, and dedication to deliver outstanding construction and engineering solutions"
        />

        <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuresData.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Award

            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="group"
              >
                <div className="h-full bg-gradient-to-br from-navy-800 to-navy-900 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-navy-700 hover:border-primary hover:-translate-y-2">
                  {/* Icon */}
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                    className="w-14 h-14 bg-gradient-to-br from-primary to-primary-600 rounded-xl flex items-center justify-center mb-4 group-hover:shadow-lg group-hover:shadow-primary/50"
                  >
                    <Icon className="text-white" size={28} />
                  </motion.div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-navy-300 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Quality Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-20 bg-gradient-to-r from-navy-900 to-navy rounded-2xl p-12 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />

          <div className="relative z-10">
            <h3 className="text-3xl font-heading font-bold text-white text-center mb-12">
              Built To Last, Built Safely
            </h3>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { label: 'ISO Certified', value: 'Quality Management' },
                { label: 'Safety Compliance', value: 'OSHA Standards' },
                { label: 'Engineering Standards', value: 'IS Codes' },
                { label: 'Green Building', value: 'Sustainable' },
              ].map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 1 + index * 0.1, duration: 0.4 }}
                  className="text-center"
                >
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="text-primary" size={36} />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-2">{item.label}</h4>
                  <p className="text-navy-300 text-sm">{item.value}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  )
}
