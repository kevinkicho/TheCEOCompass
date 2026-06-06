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
          <p>Static demo — <a href="https://github.com/kevinkicho/TheCEOCompass" className="text-primary-500 hover:underline">run locally</a> for full interactive experience</p>
        </footer>
      </body>
    </html>
  )
}