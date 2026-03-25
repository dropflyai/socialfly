import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'SocialFly - AI-Powered Social Media Automation',
  description: 'Your brand\'s content on autopilot. AI-powered social media management for creators and businesses.',
  keywords: ['social media', 'automation', 'AI', 'scheduling', 'content creation', 'socialfly'],
  metadataBase: new URL('https://socialfly.io'),
  other: {
    'tiktok-developers-site-verification': '86ydRRIW34KPd9wLqgR2TAYV80n5CMf7',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
