import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { DemoFooter } from "@/components/DemoFooter"

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
            <a href="/TheCEOCompass/" className="text-xl font-bold text-dark-900">
              CEO<span className="text-primary-600">Compass</span>
            </a>
            <div className="flex items-center gap-6">
              <a href="/TheCEOCompass/frameworks/" className="text-sm text-dark-600 hover:text-dark-900">Frameworks</a>
              <a href="/TheCEOCompass/scenarios/" className="text-sm text-dark-600 hover:text-dark-900">Scenarios</a>
              <a href="/TheCEOCompass/quiz/" className="text-sm text-dark-600 hover:text-dark-900">Quiz</a>
              <a href="/TheCEOCompass/journal/" className="text-sm text-dark-600 hover:text-dark-900">Journal</a>
              <a href="/TheCEOCompass/pathway/" className="text-sm text-dark-600 hover:text-dark-900">Pathway</a>
              <a href="/TheCEOCompass/cheatsheet/" className="text-sm text-dark-600 hover:text-dark-900">Cheatsheet</a>
              <a href="/TheCEOCompass/profile/" className="text-sm text-dark-600 hover:text-dark-900">Profile</a>
            </div>
          </div>
        </nav>
        <main className="pt-14">{children}</main>
        <DemoFooter />
      </body>
    </html>
  )
}