'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import companyData from '@/data/company.json'

export function WhatsAppButton() {
  const message = encodeURIComponent(
    'Hello! I would like to inquire about your construction and engineering services.'
  )
  const whatsappUrl = `https://wa.me/${companyData.contact.whatsapp}?text=${message}`

  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-24 right-8 w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full shadow-2xl flex items-center justify-center z-50 group"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, duration: 0.5 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <MessageCircle className="text-white" size={28} />

      {/* Pulse Animation */}
      <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-20" />

      {/* Tooltip */}
      <span className="absolute right-full mr-3 bg-navy dark:bg-white text-white dark:text-navy px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
        Chat with us on WhatsApp
      </span>
    </motion.a>
  )
}
