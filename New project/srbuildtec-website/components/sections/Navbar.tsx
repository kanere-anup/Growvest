'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Phone, Mail } from 'lucide-react'
import { NAV_LINKS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import companyData from '@/data/company.json'

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (href: string) => {
    const id = href.replace('#', '')
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setIsMobileMenuOpen(false)
    }
  }

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isScrolled
            ? 'bg-navy/95 backdrop-blur-md shadow-lg'
            : 'bg-transparent'
        }`}
      >
        {/* Top Bar */}
        <div className={`border-b border-navy-700/30 ${isScrolled ? 'hidden' : 'block'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-10 text-sm">
              <div className="flex items-center gap-4">
                <a
                  href={`tel:${companyData.contact.phone}`}
                  className="flex items-center gap-2 text-navy-300 hover:text-primary transition-colors"
                >
                  <Phone size={14} />
                  <span className="hidden sm:inline">{companyData.contact.phone}</span>
                </a>
                <a
                  href={`mailto:${companyData.contact.email}`}
                  className="flex items-center gap-2 text-navy-300 hover:text-primary transition-colors"
                >
                  <Mail size={14} />
                  <span className="hidden md:inline">{companyData.contact.email}</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Main Navbar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <motion.a
              href="#home"
              onClick={(e) => {
                e.preventDefault()
                scrollToSection('#home')
              }}
              className="flex items-center gap-3"
              whileHover={{ scale: 1.05 }}
            >
              <div className="w-14 h-14 bg-white rounded-lg p-1.5 shadow-md">
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
                <h1 className="text-xl font-heading font-bold text-white">
                  SR BUILDTEC
                </h1>
                <p className="text-xs text-primary">Building Excellence</p>
              </div>
            </motion.a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToSection(link.href)
                  }}
                  className="text-navy-200 hover:text-primary font-medium transition-colors relative group"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
                </a>
              ))}
              <Button size="sm" asChild href="#contact">
                Get Quote
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-white"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ duration: 0.3 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-navy shadow-2xl lg:hidden"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b border-navy-700">
                <div className="w-14 h-14 bg-white rounded-lg p-1.5 shadow-md">
                  <Image
                    src="/company-logo.jpeg"
                    alt="SR BUILDTEC Logo"
                    width={50}
                    height={50}
                    className="w-full h-full object-contain"
                    priority
                  />
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-white"
                  aria-label="Close menu"
                >
                  <X size={24} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-6">
                <div className="flex flex-col gap-4">
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => {
                        e.preventDefault()
                        scrollToSection(link.href)
                      }}
                      className="text-lg font-medium text-navy-200 hover:text-primary transition-colors py-2"
                    >
                      {link.label}
                    </a>
                  ))}
                  <Button className="mt-4" onClick={() => scrollToSection('#contact')}>
                    Get Free Consultation
                  </Button>
                </div>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
