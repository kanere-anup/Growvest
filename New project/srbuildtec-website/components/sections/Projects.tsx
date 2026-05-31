'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { MapPin, Calendar, Maximize2 } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { PROJECT_CATEGORIES } from '@/lib/constants'
import projectsData from '@/data/projects.json'

export function Projects() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.05,
  })

  const filteredProjects =
    selectedCategory === 'All'
      ? projectsData
      : projectsData.filter((project) => project.category === selectedCategory)

  return (
    <section id="projects" className="py-20 md:py-32 bg-gradient-to-b from-navy to-navy-900">
      <Container>
        <SectionHeading
          subtitle="Our Projects"
          title="Building Landmarks, Creating Legacies"
          description="Explore our portfolio of successful projects across residential, commercial, and industrial sectors"
        />

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {PROJECT_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
                selectedCategory === category
                  ? 'bg-primary text-white shadow-lg shadow-primary/50 scale-105'
                  : 'bg-navy-800 text-white border border-navy-700 hover:border-primary hover:text-primary'
              }`}
            >
              {category}
            </button>
          ))}
        </motion.div>

        {/* Projects Grid */}
        <div ref={ref} className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="wait">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                className="group cursor-pointer"
              >
                <div className="relative h-full bg-navy-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-navy-700">
                  {/* Image */}
                  <div className="relative h-64 overflow-hidden bg-navy-100 dark:bg-navy-900">
                    <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/50 to-transparent z-10" />
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1448630360428-65456885c650?q=80&w=2867')] bg-cover bg-center group-hover:scale-110 transition-transform duration-700" />

                    {/* Status Badge */}
                    <div className="absolute top-4 right-4 z-20">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          project.status === 'Completed'
                            ? 'bg-green-500 text-white'
                            : 'bg-yellow-500 text-navy'
                        }`}
                      >
                        {project.status}
                      </span>
                    </div>

                    {/* Category Badge */}
                    <div className="absolute top-4 left-4 z-20">
                      <span className="px-3 py-1 bg-primary/90 backdrop-blur-sm text-white rounded-full text-xs font-semibold">
                        {project.category}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">
                      {project.title}
                    </h3>

                    <p className="text-navy-300 text-sm mb-4 line-clamp-2">
                      {project.description}
                    </p>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-navy-400">
                        <MapPin size={16} className="text-primary" />
                        {project.location}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-navy-400">
                        <Maximize2 size={16} className="text-primary" />
                        {project.area}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-navy-400">
                        <Calendar size={16} className="text-primary" />
                        {project.year}
                      </div>
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2">
                      {project.features.slice(0, 3).map((feature, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-navy-900 text-navy dark:text-navy-300 text-xs rounded-md"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredProjects.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <p className="text-navy-400 text-lg">
              No projects found in this category.
            </p>
          </motion.div>
        )}
      </Container>
    </section>
  )
}
