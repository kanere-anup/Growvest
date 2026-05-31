'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

export function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(() => setIsLoading(false), 500)
          return 100
        }
        return prev + 2
      })
    }, 30)

    return () => clearInterval(interval)
  }, [])

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-navy"
        >
          {/* Building Animation */}
          <div className="relative mb-8">
            <Image
              src="/logo.jpeg"
              alt="SR BUILDTEC"
              width={150}
              height={150}
              className="rounded-xl"
            />
            <motion.div
              className="absolute inset-0 border-4 border-primary rounded-xl"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [1, 0.5, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>

          {/* Company Name */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-4xl font-heading font-bold text-white mb-4"
          >
            SR BUILDTEC
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-primary text-sm md:text-base mb-8"
          >
            Building Excellence, Engineering The Future
          </motion.p>

          {/* Progress Bar */}
          <div className="w-64 h-1 bg-navy-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Progress Percentage */}
          <motion.p
            className="mt-4 text-white text-sm"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {progress}%
          </motion.p>

          {/* Building Construction Animation */}
          <div className="absolute bottom-0 left-0 right-0 h-32 flex items-end justify-center gap-2 px-4 pb-8">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-12 bg-primary/20 rounded-t-lg"
                initial={{ height: 0 }}
                animate={{ height: `${Math.random() * 100 + 50}px` }}
                transition={{
                  duration: 1,
                  delay: i * 0.2,
                  repeat: Infinity,
                  repeatType: 'reverse',
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
