'use client'

import React from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Phone, Mail, MapPin, ArrowUp } from 'lucide-react'
import { FaInstagram, FaFacebook, FaYoutube } from 'react-icons/fa'
import { Container } from '@/components/ui/Container'
import { NAV_LINKS } from '@/lib/constants'
import companyData from '@/data/company.json'
import servicesData from '@/data/services.json'

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToSection = (href: string) => {
    const id = href.replace('#', '')
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <footer className="bg-navy text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />

      <Container>
        {/* Main Footer Content */}
        <div className="relative z-10 py-16 grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-white rounded-lg p-1.5 shadow-md flex-shrink-0">
                <Image
                  src="/company-logo.jpeg"
                  alt="SR BUILDTEC Logo"
                  width={50}
                  height={50}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <div>
                <h3 className="text-xl font-heading font-bold">{companyData.name}</h3>
                <p className="text-primary text-xs">Building Excellence</p>
              </div>
            </div>
            <p className="text-navy-300 text-sm mb-6 leading-relaxed">
              Your trusted partner in construction, design, project management & engineering solutions.
            </p>
            <div className="flex gap-3">
              <a
                href={companyData.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 bg-white/10 hover:bg-gradient-to-br hover:from-purple-500 hover:to-pink-500 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                aria-label="Instagram"
              >
                <FaInstagram className="text-white" size={24} />
              </a>
              <a
                href={companyData.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 bg-white/10 hover:bg-blue-600 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                aria-label="Facebook"
              >
                <FaFacebook className="text-white" size={24} />
              </a>
              <a
                href={companyData.social.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 bg-white/10 hover:bg-red-600 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                aria-label="YouTube"
              >
                <FaYoutube className="text-white" size={24} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-heading font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault()
                      scrollToSection(link.href)
                    }}
                    className="text-navy-300 hover:text-primary transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-lg font-heading font-bold mb-4">Our Services</h4>
            <ul className="space-y-2">
              {servicesData.slice(0, 6).map((service) => (
                <li key={service.id}>
                  <a
                    href="#services"
                    onClick={(e) => {
                      e.preventDefault()
                      scrollToSection('#services')
                    }}
                    className="text-navy-300 hover:text-primary transition-colors text-sm"
                  >
                    {service.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-heading font-bold mb-4">Contact Us</h4>
            <div className="space-y-4">
              <a
                href={`tel:${companyData.contact.phone}`}
                className="flex items-start gap-3 text-navy-300 hover:text-primary transition-colors group"
              >
                <Phone size={18} className="text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">+91 {companyData.contact.phone}</span>
              </a>
              <a
                href={`mailto:${companyData.contact.email}`}
                className="flex items-start gap-3 text-navy-300 hover:text-primary transition-colors group"
              >
                <Mail size={18} className="text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm break-all">{companyData.contact.email}</span>
              </a>
              <div className="flex items-start gap-3 text-navy-300">
                <MapPin size={18} className="text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">{companyData.contact.address}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="relative z-10 border-t border-navy-700 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-navy-400 text-sm text-center md:text-left">
              © {new Date().getFullYear()} {companyData.name}. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-navy-400 hover:text-primary transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-navy-400 hover:text-primary transition-colors">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </Container>

      {/* Back to Top Button */}
      <motion.button
        onClick={scrollToTop}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="fixed bottom-8 right-8 w-12 h-12 bg-primary hover:bg-primary-600 rounded-full shadow-lg flex items-center justify-center z-50 transition-all hover:scale-110"
        whileHover={{ y: -5 }}
      >
        <ArrowUp size={24} />
      </motion.button>
    </footer>
  )
}
