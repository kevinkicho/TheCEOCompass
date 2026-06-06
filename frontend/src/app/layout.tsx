import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CEO Compass",
  description: "Navigate every leadership decision with 57 frameworks, interactive scenarios, and AI-powered coaching",
  icons: { icon: "/TheCEOCompass/favicon.svg" },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="fixed top-0 z-50 w-full border-b border-dark-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <a href="/" className="text-xl font-bold text-dark-900">
              CEO<span className="text-primary-600">Compass</span>
            </a>
            <div className="flex items-center gap-6">
              <a href="/frameworks" className="text-sm text-dark-600 hover:text-dark-900">Frameworks</a>
              <a href="/scenarios" className="text-sm text-dark-600 hover:text-dark-900">Scenarios</a>
              <a href="/quiz" className="text-sm text-dark-600 hover:text-dark-900">Quiz</a>
              <a href="/journal" className="text-sm text-dark-600 hover:text-dark-900">Journal</a>
              <a href="/pathway" className="text-sm text-dark-600 hover:text-dark-900">Pathway</a>
              <a href="/cheatsheet" className="text-sm text-dark-600 hover:text-dark-900">Cheatsheet</a>
              <a href="/profile" className="text-sm text-dark-600 hover:text-dark-900">Profile</a>
            </div>
          </div>
        </nav>
        <main className="pt-14">{children}</main>
        <footer className="border-t border-dark-200 py-6 text-center text-xs text-dark-400">
          <div className="flex flex-col items-center gap-3">
            <a
              href="https://github.com/kevinkicho/TheCEOCompass#quick-start"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-4 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100 transition border border-primary-200 shadow-sm"
              title="Full interactive experience with 6 scenarios, AI coaching, quiz engine, decision journal, and progress tracking"
            >
              <span className="h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
              Run locally for full experience
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
            <p>Full version: 6 interactive scenarios with AI feedback · 55 quiz questions · Decision journal with calibration · Progress tracking · 57 frameworks with 3 examples each</p>
          </div>
        </footer>
      </body>
    </html>
  )
}