import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Link from "next/link"
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
            <Link href="/" className="text-xl font-bold text-dark-900">
              CEO<span className="text-primary-600">Compass</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/frameworks" className="text-sm text-dark-600 hover:text-dark-900">Frameworks</Link>
              <Link href="/scenarios" className="text-sm text-dark-600 hover:text-dark-900">Scenarios</Link>
              <Link href="/quiz" className="text-sm text-dark-600 hover:text-dark-900">Quiz</Link>
              <Link href="/journal" className="text-sm text-dark-600 hover:text-dark-900">Journal</Link>
              <Link href="/pathway" className="text-sm text-dark-600 hover:text-dark-900">Pathway</Link>
              <Link href="/cheatsheet" className="text-sm text-dark-600 hover:text-dark-900">Cheatsheet</Link>
              <Link href="/profile" className="text-sm text-dark-600 hover:text-dark-900">Profile</Link>
            </div>
          </div>
        </nav>
        <main className="pt-14">{children}</main>
        <DemoFooter />
      </body>
    </html>
  )
}