'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Container } from '@/components/ui/Container'

export function TransformAnimation() {
  const [ref, inView] = useInView({ triggerOnce: false, threshold: 0.3 })

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-navy-900 via-navy-800 to-navy-900 relative overflow-hidden">
      <Container>
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            className="text-primary font-semibold uppercase tracking-wider mb-4 text-sm"
          >
            Transformation Process
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="text-4xl md:text-6xl font-heading font-bold text-white mb-6"
          >
            From Blueprint to Reality
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            className="text-gray-300 text-lg max-w-3xl mx-auto"
          >
            Watch as your vision transforms into a stunning architectural masterpiece
          </motion.p>
        </div>

        <div ref={ref} className="max-w-6xl mx-auto">
          {/* Main Continuous Animation */}
          <motion.div
            className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl shadow-2xl overflow-hidden"
            style={{
              height: '700px',
              perspective: '1500px',
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 1 }}
          >
            {/* Animated Background */}
            <div className="absolute inset-0">
              <motion.div
                className="absolute inset-0"
                animate={{
                  background: [
                    'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    'linear-gradient(135deg, #334155 0%, #475569 100%)',
                    'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                  ]
                }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              />

              {/* Grid that fades */}
              <motion.div
                className="absolute inset-0"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(255, 107, 0, 0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255, 107, 0, 0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: '50px 50px'
                }}
                animate={{
                  opacity: [0.3, 0, 0, 0.3]
                }}
                transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            {/* Main Building Animation Container */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                style={{
                  transformStyle: 'preserve-3d',
                  width: '600px',
                  height: '600px',
                }}
                animate={{
                  rotateY: [0, 360],
                  rotateX: [0, 15, -15, 0],
                  scale: [0.8, 1, 1.1, 0.8],
                }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  times: [0, 0.33, 0.66, 1]
                }}
              >
                <svg
                  width="600"
                  height="600"
                  viewBox="0 0 600 600"
                  style={{
                    filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.5))'
                  }}
                >
                  <defs>
                    {/* Premium Gradients */}
                    <linearGradient id="premiumGold" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFD700"/>
                      <stop offset="50%" stopColor="#FFA500"/>
                      <stop offset="100%" stopColor="#FF6B00"/>
                    </linearGradient>

                    <linearGradient id="buildingFace" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFE8DB"/>
                      <stop offset="100%" stopColor="#FFAC8D"/>
                    </linearGradient>

                    <linearGradient id="glassEffect" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.1"/>
                    </linearGradient>

                    {/* Glow Effects */}
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>

                    <filter id="shadow">
                      <feDropShadow dx="0" dy="30" stdDeviation="20" floodOpacity="0.6"/>
                    </filter>
                  </defs>

                  {/* Isometric Building - Continuous Transformation */}
                  <g transform="translate(300, 300)" filter="url(#shadow)">
                    {/* Foundation - Animates in/out */}
                    <motion.polygon
                      points="-150,100 150,100 180,80 -120,80"
                      fill="#64748B"
                      animate={{
                        opacity: [0, 1, 1, 0.5],
                        y: [50, 0, 0, 0]
                      }}
                      transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                    />

                    {/* Main Building Front Face */}
                    <motion.polygon
                      points="-150,-100 -150,100 150,100 150,-100"
                      fill="url(#buildingFace)"
                      stroke="#FF6B00"
                      strokeWidth="3"
                      animate={{
                        opacity: [0, 0.5, 1, 1, 0.5],
                        scaleY: [0, 1, 1, 1, 1],
                      }}
                      transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ transformOrigin: 'center bottom' }}
                    />

                    {/* Right Side Face */}
                    <motion.polygon
                      points="150,-100 150,100 220,60 220,-140"
                      fill="#FFAC8D"
                      stroke="#FF6B00"
                      strokeWidth="3"
                      animate={{
                        opacity: [0, 0, 0.8, 1, 0.8],
                        x: [50, 0, 0, 0, 0]
                      }}
                      transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                    />

                    {/* Top Face/Roof */}
                    <motion.polygon
                      points="-150,-100 -80,-140 220,-140 150,-100"
                      fill="url(#premiumGold)"
                      stroke="#CC5600"
                      strokeWidth="3"
                      filter="url(#glow)"
                      animate={{
                        opacity: [0, 0, 0, 1, 1],
                        y: [-50, -50, 0, 0, 0]
                      }}
                      transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                    />

                    {/* Windows with Glass Effect - Grid Pattern */}
                    {[0, 1, 2, 3, 4, 5].map((floor) => (
                      <g key={floor}>
                        {[0, 1, 2, 3, 4].map((col) => (
                          <motion.g key={`${floor}-${col}`}>
                            {/* Window Frame */}
                            <rect
                              x={-130 + col * 55}
                              y={-80 + floor * 30}
                              width="45"
                              height="25"
                              fill="#0F172A"
                              opacity="0.7"
                              stroke="#FF6B00"
                              strokeWidth="1"
                            />
                            {/* Glass Reflection */}
                            <motion.rect
                              x={-125 + col * 55}
                              y={-75 + floor * 30}
                              width="15"
                              height="15"
                              fill="url(#glassEffect)"
                              animate={{
                                opacity: [0.2, 0.8, 0.2],
                                x: [-125 + col * 55, -120 + col * 55, -125 + col * 55]
                              }}
                              transition={{
                                duration: 4,
                                repeat: Infinity,
                                delay: (floor + col) * 0.3,
                                ease: 'easeInOut'
                              }}
                            />
                            {/* Window Light */}
                            <motion.rect
                              x={-130 + col * 55}
                              y={-80 + floor * 30}
                              width="45"
                              height="25"
                              fill="#FFD700"
                              animate={{
                                opacity: [0, 0.3, 0.6, 0.3, 0]
                              }}
                              transition={{
                                duration: 20,
                                repeat: Infinity,
                                delay: (floor * 5 + col) * 0.5
                              }}
                            />
                          </motion.g>
                        ))}
                      </g>
                    ))}

                    {/* Logo/Signage on Top */}
                    <motion.text
                      x="0"
                      y="-110"
                      textAnchor="middle"
                      fill="#FF6B00"
                      fontSize="24"
                      fontWeight="bold"
                      filter="url(#glow)"
                      animate={{
                        opacity: [0, 0, 0, 1, 1],
                        scale: [0.5, 0.5, 1, 1, 1]
                      }}
                      transition={{ duration: 20, repeat: Infinity }}
                    >
                      SR BUILDTEC
                    </motion.text>

                    {/* Entrance/Door */}
                    <motion.rect
                      x="-30"
                      y="60"
                      width="60"
                      height="40"
                      fill="#8B4513"
                      stroke="#FF6B00"
                      strokeWidth="2"
                      animate={{
                        opacity: [0, 0, 1, 1, 1]
                      }}
                      transition={{ duration: 20, repeat: Infinity }}
                    />
                  </g>

                  {/* Blueprint Lines - Fade in/out */}
                  <motion.g
                    animate={{
                      opacity: [1, 0, 0, 0, 0],
                      strokeDashoffset: [1000, 0, 0, 0, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <path
                      d="M 150 400 L 150 200 L 300 150 L 450 200 L 450 400 Z"
                      fill="none"
                      stroke="#FF6B00"
                      strokeWidth="2"
                      strokeDasharray="1000"
                    />
                  </motion.g>
                </svg>
              </motion.div>
            </div>

            {/* Floating Particles */}
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-primary rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -100, 0],
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0]
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: 'easeInOut'
                }}
              />
            ))}

            {/* Animated Text Overlay */}
            <div className="absolute bottom-12 left-0 right-0 text-center z-10">
              <motion.div
                className="inline-block bg-black/40 backdrop-blur-xl px-12 py-6 rounded-full border border-primary/50"
                animate={{
                  scale: [1, 1.05, 1],
                  borderColor: ['rgba(255,107,0,0.5)', 'rgba(255,107,0,1)', 'rgba(255,107,0,0.5)']
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <motion.div
                  className="text-3xl font-bold text-white mb-2"
                  animate={{
                    backgroundImage: [
                      'linear-gradient(90deg, #FF6B00, #FFD700)',
                      'linear-gradient(90deg, #FFD700, #FF6B00)',
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent'
                  }}
                >
                  Transforming Dreams Into Reality
                </motion.div>
                <div className="text-sm text-gray-300">
                  Premium Construction & Engineering
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Feature Cards Below */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              { title: '2D Planning', desc: 'Detailed architectural blueprints', delay: 0.2 },
              { title: '3D Modeling', desc: 'Photorealistic visualizations', delay: 0.4 },
              { title: 'Construction', desc: 'Expert execution & delivery', delay: 0.6 }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: item.delay, duration: 0.6 }}
                className="bg-navy-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-navy-700 hover:border-primary transition-all hover:shadow-xl"
              >
                <div className="text-5xl font-bold text-primary mb-3">0{i + 1}</div>
                <h4 className="text-xl font-bold text-white mb-2">{item.title}</h4>
                <p className="text-gray-300">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
