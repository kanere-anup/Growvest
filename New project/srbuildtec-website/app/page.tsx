'use client'

import React, { Suspense } from 'react'
import { Navbar } from '@/components/sections/Navbar'
import { Hero } from '@/components/sections/Hero'
import { About } from '@/components/sections/About'
import { Services } from '@/components/sections/Services'
import { Projects } from '@/components/sections/Projects'
import { BuildingAnimation } from '@/components/sections/BuildingAnimation'
import { Features } from '@/components/sections/Features'
import { Testimonials } from '@/components/sections/Testimonials'
import { Instagram } from '@/components/sections/Instagram'
import { Contact } from '@/components/sections/Contact'
import { Footer } from '@/components/sections/Footer'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'

export default function Home() {
  return (
    <>
      <LoadingScreen />
      <Navbar />
      <main className="overflow-x-hidden">
        <Hero />
        <About />
        <Services />
        <Projects />
        <BuildingAnimation />
        <Features />
        <Testimonials />
        <Instagram />
        <Contact />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  )
}
