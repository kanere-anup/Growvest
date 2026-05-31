import type { Metadata } from 'next'
import { Inter, Raleway } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const raleway = Raleway({
  subsets: ['latin'],
  variable: '--font-raleway',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SR BUILDTEC - Building Excellence, Engineering The Future',
  description: 'Your Trusted Partner in Construction, Design, Project Management & Engineering Solutions. Specializing in residential and commercial construction, structural and architectural design.',
  keywords: 'construction, engineering, architecture, building, SR BUILDTEC, Bangalore construction, residential construction, commercial construction, structural design, architectural design, project management',
  authors: [{ name: 'SR BUILDTEC' }],
  openGraph: {
    title: 'SR BUILDTEC - Building Excellence, Engineering The Future',
    description: 'Your Trusted Partner in Construction, Design, Project Management & Engineering Solutions',
    type: 'website',
    locale: 'en_IN',
    siteName: 'SR BUILDTEC',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SR BUILDTEC - Building Excellence, Engineering The Future',
    description: 'Your Trusted Partner in Construction, Design, Project Management & Engineering Solutions',
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        <link rel="icon" href="/logo.jpeg" />
      </head>
      <body className={`${inter.variable} ${raleway.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
