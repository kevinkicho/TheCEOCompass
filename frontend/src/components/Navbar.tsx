"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "@/components/ThemeProvider"
import { useAuth } from "@/lib/useAuth"

type NavGroup = {
  id: string
  label: string
  href: string
  children: { href: string; label: string }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "learn",
    label: "Learn",
    href: "/frameworks",
    children: [
      { href: "/frameworks", label: "Frameworks" },
      { href: "/pathway", label: "Pathway" },
      { href: "/cheatsheet", label: "Cheatsheet" },
    ],
  },
  {
    id: "practice",
    label: "Practice",
    href: "/scenarios",
    children: [
      { href: "/scenarios", label: "Scenarios" },
      { href: "/quiz", label: "Quiz" },
      { href: "/simulator", label: "Simulator" },
      { href: "/quotes", label: "Quotes" },
    ],
  },
  {
    id: "reflect",
    label: "Reflect",
    href: "/review",
    children: [
      { href: "/review", label: "Weekly review" },
      { href: "/journal", label: "Journal" },
      { href: "/calibration", label: "Calibration" },
    ],
  },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const { theme, toggle } = useTheme()
  const { user, loading, isAnonymous, signInWithGoogle, signOut } = useAuth()
  const pathname = usePathname() || ""
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const isActiveGroup = (g: NavGroup) =>
    g.children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))

  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-dark-200 bg-white/80 backdrop-blur dark:border-dark-700 dark:bg-dark-950/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4" ref={navRef}>
          <Link href="/" className="text-xl font-bold text-dark-900 dark:text-dark-100" onClick={() => setOpen(false)}>
            CEO<span className="text-primary-600 dark:text-primary-400">Compass</span>
          </Link>

          {/* Desktop: Learn / Practice / Reflect + Profile */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_GROUPS.map((g) => (
              <div key={g.id} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenGroup(openGroup === g.id ? null : g.id)}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    isActiveGroup(g)
                      ? "text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 font-medium"
                      : "text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50 hover:bg-dark-100 dark:hover:bg-dark-800"
                  }`}
                >
                  {g.label}
                  <span className="ml-1 text-[10px] opacity-60">▾</span>
                </button>
                {openGroup === g.id && (
                  <div className="absolute left-0 top-full mt-1 min-w-[11rem] rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900 shadow-lg py-1 z-50">
                    {g.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={() => setOpenGroup(null)}
                        className={`block px-3 py-2 text-sm hover:bg-dark-50 dark:hover:bg-dark-800 ${
                          pathname === c.href || pathname.startsWith(c.href + "/")
                            ? "text-primary-700 dark:text-primary-300 font-medium"
                            : "text-dark-700 dark:text-dark-300"
                        }`}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Link
              href="/profile"
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                pathname.startsWith("/profile")
                  ? "text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 font-medium"
                  : "text-dark-600 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50 hover:bg-dark-100 dark:hover:bg-dark-800"
              }`}
            >
              Profile
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {!loading && (
              <div className="hidden sm:flex items-center gap-1.5">
                {user && isAnonymous && (
                  <button
                    onClick={() => signInWithGoogle().catch(console.error)}
                    className="px-2.5 py-1.5 text-xs rounded-md font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50"
                  >
                    Link Google
                  </button>
                )}
                {user && !isAnonymous && (
                  <button
                    onClick={() => signOut().catch(console.error)}
                    className="px-2.5 py-1.5 text-xs rounded-md text-dark-500 hover:bg-dark-100 dark:text-dark-300 dark:hover:bg-dark-800 max-w-[9rem] truncate"
                    title={user.email || "Signed in"}
                  >
                    {user.email?.split("@")[0] || "Account"}
                  </button>
                )}
                {!user && (
                  <button
                    onClick={() => signInWithGoogle().catch(console.error)}
                    className="px-2.5 py-1.5 text-xs rounded-md font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300"
                  >
                    Sign in
                  </button>
                )}
              </div>
            )}
            <button
              onClick={toggle}
              className="h-9 w-9 flex items-center justify-center rounded-md text-dark-500 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-50 hover:bg-dark-100 dark:hover:bg-dark-800 transition-colors"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

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

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed top-14 left-0 right-0 z-40 border-b border-dark-200 bg-white/95 backdrop-blur dark:border-dark-700 dark:bg-dark-950/95 md:hidden animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="px-4 py-3 space-y-3">
              {NAV_GROUPS.map((g) => (
                <div key={g.id}>
                  <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-dark-400 dark:text-dark-500 mb-1">
                    {g.label}
                  </p>
                  {g.children.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 rounded-md text-sm font-medium text-dark-700 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-800"
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              ))}
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-md text-sm font-medium text-dark-700 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-800"
              >
                Profile
              </Link>
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
