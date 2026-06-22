import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Navbar } from "@/components/Navbar"
import { AppSidebar } from "@/components/AppSidebar"
import { DemoFooter } from "@/components/DemoFooter"
import { ErrorBoundary } from "@/components/ErrorBoundary"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CEO Compass",
  description: "Navigate every leadership decision with 57 frameworks, interactive scenarios, and AI-powered coaching",
  icons: { 
    icon: (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/favicon.svg",
    shortcut: (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/favicon.ico",
  },
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
          <ErrorBoundary>
          <Navbar />
          <div className="flex pt-14">
            <AppSidebar />
            <main className="flex-1 min-w-0">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>
          <DemoFooter />
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  )
}
