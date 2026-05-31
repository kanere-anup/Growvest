'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Target, Eye, Award, Shield } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import companyData from '@/data/company.json'

const icons = {
  mission: Target,
  vision: Eye,
  quality: Award,
  safety: Shield,
}

export function About() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section id="about" className="py-20 md:py-32 bg-gradient-to-b from-navy-900 to-navy">
      <Container>
        <SectionHeading
          subtitle="About Us"
          title="Building Dreams with Precision & Passion"
          description={companyData.about}
        />

        <div ref={ref} className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          {/* Image Section */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative h-[500px] rounded-2xl overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2831')] bg-cover bg-center" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/80 to-transparent" />

              {/* Overlay Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="absolute bottom-8 left-8 right-8 bg-navy-800/95 backdrop-blur-md rounded-xl p-6 shadow-xl"
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                    <Award className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">10+ Years</h3>
                    <p className="text-navy-300 text-sm">Of Excellence</p>
                  </div>
                </div>
                <p className="text-navy-200 text-sm">
                  Delivering world-class construction and engineering solutions
                </p>
              </motion.div>
            </div>

            {/* Floating Element */}
            <motion.div
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-6 -right-6 w-24 h-24 bg-primary rounded-full opacity-20 blur-xl"
            />
          </motion.div>

          {/* Mission & Vision */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            {/* Mission */}
            <div className="bg-navy-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-navy-700">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Target className="text-primary" size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-heading font-bold text-white mb-3">
                    Our Mission
                  </h3>
                  <p className="text-navy-300 leading-relaxed">
                    {companyData.mission}
                  </p>
                </div>
              </div>
            </div>

            {/* Vision */}
            <div className="bg-navy-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-navy-700">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Eye className="text-primary" size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-heading font-bold text-white mb-3">
                    Our Vision
                  </h3>
                  <p className="text-navy-300 leading-relaxed">
                    {companyData.vision}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Core Values */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          <h3 className="text-3xl font-heading font-bold text-center text-white mb-12">
            Our Core Values
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {companyData.coreValues.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.8 + index * 0.1, duration: 0.5 }}
                className="bg-navy-800 rounded-xl p-6 text-center shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 border border-navy-700 group"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Award className="text-white" size={28} />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">
                  {value.title}
                </h4>
                <p className="text-navy-300 text-sm">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </Container>
    </section>
  )
}
