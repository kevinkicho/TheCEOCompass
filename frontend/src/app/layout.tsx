import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Navbar } from "@/components/Navbar"
import { DemoFooter } from "@/components/DemoFooter"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CEO Compass",
  description: "Navigate every leadership decision with 57 frameworks, interactive scenarios, and AI-powered coaching",
  icons: { icon: "/favicon.svg" },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <Navbar />
          <main className="pt-14">{children}</main>
          <DemoFooter />
        </ThemeProvider>
      </body>
    </html>
  )
}