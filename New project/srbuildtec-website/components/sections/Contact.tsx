'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Phone, Mail, MapPin, MessageCircle } from 'lucide-react'
import { FaInstagram, FaFacebook, FaYoutube } from 'react-icons/fa'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import companyData from '@/data/company.json'

export function Contact() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section id="contact" className="py-20 md:py-32 bg-gradient-to-b from-navy via-navy-900 to-navy relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />

      <Container>
        <SectionHeading
          subtitle="Get In Touch"
          title="Let's Build Something Amazing Together"
          description="Ready to start your construction project? Reach out to us directly"
        />

        <div ref={ref} className="max-w-5xl mx-auto">
          {/* Main Contact Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-br from-navy to-navy-800 rounded-3xl p-8 md:p-12 shadow-2xl mb-12"
          >
            <div className="text-center mb-12">
              <h3 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
                Contact Information
              </h3>
              <p className="text-navy-300 text-lg max-w-2xl mx-auto">
                Get in touch with us for any inquiries or project discussions. We're here to help bring your vision to life.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Phone */}
              <motion.a
                href={`tel:${companyData.contact.phone}`}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-6 bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-all group"
              >
                <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Phone size={32} className="text-white" />
                </div>
                <div>
                  <p className="text-navy-400 text-sm mb-1">Call Us</p>
                  <p className="text-2xl font-bold text-white">+91 {companyData.contact.phone}</p>
                </div>
              </motion.a>

              {/* WhatsApp */}
              <motion.a
                href={`https://wa.me/${companyData.contact.whatsapp}?text=Hello! I'm interested in your construction services.`}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: 20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-6 bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-all group"
              >
                <div className="w-16 h-16 bg-green-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageCircle size={32} className="text-white" />
                </div>
                <div>
                  <p className="text-navy-400 text-sm mb-1">WhatsApp</p>
                  <p className="text-2xl font-bold text-white">Chat Now</p>
                </div>
              </motion.a>

              {/* Email */}
              <motion.a
                href={`mailto:${companyData.contact.email}`}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-6 bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-all group"
              >
                <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Mail size={32} className="text-white" />
                </div>
                <div>
                  <p className="text-navy-400 text-sm mb-1">Email Us</p>
                  <p className="text-xl font-bold text-white break-all">{companyData.contact.email}</p>
                </div>
              </motion.a>

              {/* Location */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-6 bg-white/10 backdrop-blur-sm rounded-2xl p-6"
              >
                <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
                  <MapPin size={32} className="text-white" />
                </div>
                <div>
                  <p className="text-navy-400 text-sm mb-1">Location</p>
                  <p className="text-xl font-bold text-white">{companyData.contact.address}</p>
                </div>
              </motion.div>
            </div>

            {/* Social Media */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.6 }}
              className="text-center relative z-10"
            >
              <p className="text-white font-semibold mb-6 text-lg">Connect With Us</p>
              <div className="flex justify-center gap-3">
                <a
                  href={companyData.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 bg-white/10 hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-500 rounded-lg flex items-center justify-center transition-all hover:scale-110 cursor-pointer relative z-10"
                  aria-label="Instagram"
                >
                  <FaInstagram className="text-white pointer-events-none" size={24} />
                </a>
                <a
                  href={companyData.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 bg-white/10 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-all hover:scale-110 cursor-pointer relative z-10"
                  aria-label="Facebook"
                >
                  <FaFacebook className="text-white pointer-events-none" size={24} />
                </a>
                <a
                  href={companyData.social.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 bg-white/10 hover:bg-red-600 rounded-lg flex items-center justify-center transition-all hover:scale-110 cursor-pointer relative z-10"
                  aria-label="YouTube"
                >
                  <FaYoutube className="text-white pointer-events-none" size={24} />
                </a>
              </div>
            </motion.div>
          </motion.div>

          {/* CTA Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.7 }}
              className="bg-navy-800/95 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-navy-700"
            >
              <h4 className="text-2xl font-bold text-white mb-3">Get a Free Consultation</h4>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Call us or send a WhatsApp message to discuss your project requirements and get expert advice.
              </p>
              <a
                href={`tel:${companyData.contact.phone}`}
                className="inline-block bg-primary hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
              >
                Call Now
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.8 }}
              className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 border border-primary/20"
            >
              <h4 className="text-2xl font-bold text-white mb-3">Business Hours</h4>
              <div className="space-y-2 text-gray-600 dark:text-gray-300">
                <p className="flex justify-between">
                  <span className="font-semibold">Monday - Saturday:</span>
                  <span>9:00 AM - 7:00 PM</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-semibold">Sunday:</span>
                  <span>10:00 AM - 5:00 PM</span>
                </p>
                <p className="text-sm text-primary font-semibold mt-4">
                  WhatsApp available 24/7
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </Container>
    </section>
  )
}
