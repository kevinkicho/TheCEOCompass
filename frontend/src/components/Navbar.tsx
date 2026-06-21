"use client"

import { useState } from "react"
import Link from "next/link"
import { useTheme } from "@/components/ThemeProvider"

const NAV_ITEMS = [
  { href: "/frameworks", label: "Frameworks" },
  { href: "/calibration", label: "Calibration" },
  { href: "/quotes", label: "Quotes" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/quiz", label: "Quiz" },
  { href: "/journal", label: "Journal" },
  { href: "/pathway", label: "Pathway" },
  { href: "/cheatsheet", label: "Cheatsheet" },
  { href: "/profile", label: "Profile" },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const { theme, toggle } = useTheme()

  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-dark-200 bg-white/80 backdrop-blur dark:border-dark-700 dark:bg-dark-950/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold text-dark-900 dark:text-dark-100" onClick={() => setOpen(false)}>
            CEO<span className="text-primary-600 dark:text-primary-400">Compass</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm rounded-md text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50 hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggle}
              className="h-9 w-9 flex items-center justify-center rounded-md text-dark-500 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50 hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Hamburger */}
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden h-9 w-9 flex items-center justify-center rounded-md text-dark-500 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50 hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
              aria-label="Toggle menu"
            >
              {open ? <XIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed top-14 left-0 right-0 z-40 border-b border-dark-200 bg-white/95 backdrop-blur dark:border-dark-700 dark:bg-dark-950/95 md:hidden animate-slide-up">
            <div className="px-4 py-3 space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2.5 rounded-md text-sm font-medium text-dark-700 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50 hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}

function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}
