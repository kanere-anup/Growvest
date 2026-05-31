'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Camera as InstagramIcon, ExternalLink } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import companyData from '@/data/company.json'

export function Instagram() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  // Placeholder images - In production, these would be fetched from Instagram API
  const placeholderImages = [
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400',
    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400',
    'https://images.unsplash.com/photo-1448630360428-65456885c650?w=400',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400',
  ]

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-navy-900 to-navy">
      <Container>
        <SectionHeading
          subtitle="Follow Our Journey"
          title={
            <span className="flex items-center justify-center gap-3">
              <InstagramIcon className="text-primary" size={40} />
              Follow Our Projects
            </span>
          }
          description="Stay updated with our latest projects, behind-the-scenes, and construction insights"
        />

        <div ref={ref} className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
          {placeholderImages.map((image, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="group relative aspect-square overflow-hidden rounded-2xl shadow-lg cursor-pointer"
            >
              <div
                className="absolute inset-0 bg-cover bg-center group-hover:scale-110 transition-transform duration-500"
                style={{ backgroundImage: `url(${image})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <InstagramIcon className="text-white" size={24} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-center"
        >
          <a
            href={companyData.social.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-4 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <InstagramIcon size={24} />
            Follow @srbuildtec
            <ExternalLink size={20} />
          </a>
        </motion.div>
      </Container>
    </section>
  )
}
