import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import ThemeProvider from '@/components/ui/ThemeProvider'
import AOSProvider from '@/components/AOSProvider' // Import the provider

// Google Analytics (gtag.js) measurement ID
const GA_MEASUREMENT_ID = 'G-LC7HKXPGHP'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title:
    'Distinguished Scholars Academy | JAMB, WAEC & Post-UTME Tutorial in Nigeria',
  description:
    'Distinguished Scholars Academy helps Nigerian students prepare for JAMB (UTME), WAEC and Post-UTME with structured lessons, CBT practice, weekly assessments and mentorship — online and on-campus in Ibadan.',
  keywords: [
    'JAMB tutorial in Nigeria',
    'WAEC lessons',
    'Post-UTME preparation',
    'Post-UTME coaching',
    'online JAMB classes',
    'CBT practice',
    'UTME preparation',
    'university tutorials',
    '100-level tutorials',
    'JAMB WAEC Post-UTME Ibadan',
  ],
  openGraph: {
    title:
      'Distinguished Scholars Academy | JAMB, WAEC & Post-UTME Tutorial in Nigeria',
    description:
      'Structured lessons, CBT practice, weekly assessments and mentorship to help students score higher in JAMB, WAEC and Post-UTME and secure university admission.',
    type: 'website',
  },
  icons: {
    icon: '/imges/DSA.jpg',
    shortcut: '/imges/DSA.jpg',
    apple: '/imges/DSA.jpg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        {/* Must come first and must block: fills in built-ins an old Chrome
            lacks before the app's own scripts run, and tells the student to
            update if the browser is beyond help. Plain ES5 — see the file. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src='/compat.js' />
        {/* Google tag (gtag.js) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy='afterInteractive'
        />
        <Script id='google-analytics' strategy='afterInteractive'>
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutralWhite dark:bg-neutralBlack text-neutralBlack dark:text-neutralWhite`}
      >
        {/* Wrap the content with AOSProvider */}
        <AOSProvider>
          <ThemeProvider>{children}</ThemeProvider>
          <SpeedInsights />
          <Analytics />
        </AOSProvider>
      </body>
    </html>
  )
}
