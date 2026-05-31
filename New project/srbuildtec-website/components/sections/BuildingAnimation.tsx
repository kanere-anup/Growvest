'use client'

import React from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { FileText, Hammer, Building2, Sparkles } from 'lucide-react'
import { Container } from '@/components/ui/Container'

const stages = [
  {
    id: 'blueprint',
    title: 'Blueprint',
    icon: FileText,
    description: 'Detailed planning and architectural design',
    color: 'from-blue-500 to-blue-600',
    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&q=80',
  },
  {
    id: 'foundation',
    title: 'Foundation',
    icon: Hammer,
    description: 'Strong foundation for lasting structures',
    color: 'from-amber-500 to-amber-600',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80',
  },
  {
    id: 'structure',
    title: 'Structure',
    icon: Building2,
    description: 'Precision engineering and construction',
    color: 'from-primary to-primary-600',
    image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&q=80',
  },
  {
    id: 'finishing',
    title: 'Finishing',
    icon: Sparkles,
    description: 'Premium materials and perfect execution',
    color: 'from-green-500 to-green-600',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80',
  },
]

export function BuildingAnimation() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.2,
  })

  const sectionRef = React.useRef(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })

  return (
    <section ref={sectionRef} className="py-32 bg-navy relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      <motion.div
        className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-primary-600 to-primary origin-left"
        style={{ scaleX: scrollYProgress }}
      />

      <Container>
        <div ref={ref} className="text-center mb-20">
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            className="text-primary font-semibold text-sm md:text-base uppercase tracking-wider mb-4"
          >
            Our Process
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="text-4xl md:text-5xl font-heading font-bold text-white mb-6"
          >
            From Vision to Reality
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            className="text-navy-300 text-lg max-w-2xl mx-auto"
          >
            Every great structure begins with a vision. Watch how we transform ideas into iconic buildings.
          </motion.p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Center Line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-navy-700 -translate-x-1/2 hidden lg:block" />

          <div className="space-y-24">
            {stages.map((stage, index) => {
              const Icon = stage.icon
              const isEven = index % 2 === 0

              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, x: isEven ? -100 : 100 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: index * 0.8, duration: 1.2, ease: 'easeOut' }}
                  className={`relative grid lg:grid-cols-2 gap-8 items-center ${
                    isEven ? '' : 'lg:flex-row-reverse'
                  }`}
                >
                  {/* Content */}
                  <div className={`${isEven ? 'lg:text-right lg:pr-12' : 'lg:pl-12 lg:col-start-2'}`}>
                    <div className="inline-block">
                      <div className={`inline-flex items-center gap-3 bg-gradient-to-r ${stage.color} rounded-full px-6 py-2 mb-4`}>
                        <Icon className="text-white" size={24} />
                        <span className="text-white font-bold text-lg">
                          Step {index + 1}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-3xl font-heading font-bold text-white mb-3">
                      {stage.title}
                    </h3>
                    <p className="text-navy-300 text-lg mb-6">
                      {stage.description}
                    </p>
                  </div>

                  {/* Visual */}
                  <div className={`${isEven ? 'lg:col-start-2' : 'lg:col-start-1 lg:row-start-1'}`}>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.3 }}
                      className="relative h-80 rounded-2xl overflow-hidden shadow-2xl"
                    >
                      {/* Image */}
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${stage.image})` }}
                      />

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/50 to-transparent opacity-80" />

                      {/* Icon Badge */}
                      <div className="absolute top-4 right-4">
                        <div className={`w-16 h-16 bg-gradient-to-br ${stage.color} rounded-full flex items-center justify-center shadow-lg`}>
                          <Icon className="text-white" size={32} />
                        </div>
                      </div>

                      {/* Step Number */}
                      <div className="absolute bottom-4 left-4">
                        <div className="text-6xl font-bold text-white/20">
                          0{index + 1}
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Timeline Dot */}
                  <div className="absolute left-1/2 -translate-x-1/2 w-6 h-6 bg-primary rounded-full border-4 border-navy hidden lg:block" />
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1, duration: 0.6 }}
          className="text-center mt-20"
        >
          <h3 className="text-2xl font-heading font-bold text-white mb-4">
            Ready to Start Your Project?
          </h3>
          <button
            onClick={() => {
              const element = document.getElementById('contact')
              if (element) element.scrollIntoView({ behavior: 'smooth' })
            }}
            className="bg-gradient-to-r from-primary to-primary-600 text-white px-8 py-4 rounded-lg font-semibold hover:shadow-xl hover:shadow-primary/50 transition-all hover:scale-105"
          >
            Let's Build Together
          </button>
        </motion.div>
      </Container>
    </section>
  )
}
