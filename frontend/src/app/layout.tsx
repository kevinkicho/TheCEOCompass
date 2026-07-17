import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import { AuthSessionProvider } from "@/lib/AuthSessionProvider"
import { AiStatusProvider } from "@/components/AiStatusProvider"
import { FeatureFlagsProvider } from "@/components/FeatureFlagsProvider"
import { AppInitProvider } from "@/components/AppInitProvider"
import { Navbar } from "@/components/Navbar"
import { AppSidebar } from "@/components/AppSidebar"
import { SiteFooter } from "@/components/SiteFooter"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { AppShellGate } from "@/components/auth/AppShellGate"

const inter = Inter({ subsets: ["latin"] })
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""

export const metadata: Metadata = {
  title: "CEO Compass",
  description: "Navigate every leadership decision with frameworks, interactive scenarios, and AI-powered coaching",
  metadataBase: new URL("https://kevinkicho.github.io/TheCEOCompass"),
  icons: {
    icon: basePath + "/favicon.svg",
    shortcut: basePath + "/favicon.ico",
    apple: basePath + "/icon-192.svg",
  },
  manifest: basePath + "/manifest.json",
}

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
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
          <AuthSessionProvider>
          <FeatureFlagsProvider>
          <AppInitProvider>
          <AiStatusProvider>
          <ErrorBoundary>
          <AppShellGate>
            <Navbar />
            <div className="flex pt-14">
              <AppSidebar />
              <main className="flex-1 min-w-0">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
            <SiteFooter />
          </AppShellGate>
          </ErrorBoundary>
          </AiStatusProvider>
          </AppInitProvider>
          </FeatureFlagsProvider>
          </AuthSessionProvider>
        </ThemeProvider>
        <Script src={basePath + "/sw-register.js"} strategy="afterInteractive" />
      </body>
    </html>
  )
}
