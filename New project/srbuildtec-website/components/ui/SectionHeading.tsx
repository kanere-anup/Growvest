'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'

interface SectionHeadingProps {
  title: string | React.ReactNode
  subtitle?: string
  description?: string
  centered?: boolean
}

export function SectionHeading({
  title,
  subtitle,
  description,
  centered = true,
}: SectionHeadingProps) {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
      className={cn('mb-12 md:mb-16', centered && 'text-center')}
    >
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-primary font-semibold text-sm md:text-base uppercase tracking-wider mb-3"
        >
          {subtitle}
        </motion.p>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-navy dark:text-white mb-4"
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.4, duration: 0.6 }}
          className={cn(
            'text-navy-600 dark:text-navy-300 text-base md:text-lg max-w-3xl',
            centered && 'mx-auto'
          )}
        >
          {description}
        </motion.p>
      )}
    </motion.div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
