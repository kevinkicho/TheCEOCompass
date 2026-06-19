"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { staticFrameworks } from "@/lib/staticData"
import { slugify } from "@/lib/ollama"
import { useAuth } from "@/lib/useAuth"

const NAV_ITEMS = [
  { href: "/frameworks", label: "Frameworks", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
  { href: "/scenarios", label: "Scenarios", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> },
  { href: "/quiz", label: "Quiz", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  { href: "/journal", label: "Journal", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
  { href: "/pathway", label: "Pathway", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { href: "/cheatsheet", label: "Cheatsheet", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { href: "/profile", label: "Profile", icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
]

function getFrameworkData(slug: string) {
  return (staticFrameworks as any[]).find((f) => f.slug === slug)
}

export function AppSidebar() {
  const pathname = usePathname()
  const { slug } = useParams<{ slug?: string }>() as { slug?: string }
  const { user, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")

  const isOnFramework = slug && !!getFrameworkData(slug)

  const framework = useMemo(() => (slug ? getFrameworkData(slug) : null), [slug])

  const concepts = useMemo(() => {
    if (!framework || !framework.concepts) return []
    const seen = new Set<string>()
    return framework.concepts.filter((c: any) => {
      const cs = slugify(c.name)
      if (seen.has(cs)) return false
      seen.add(cs)
      return true
    }).map((c: any) => ({ slug: slugify(c.name), name: c.name }))
  }, [framework])

  const conceptSlug = pathname.startsWith(`/frameworks/${slug}/`) && slug ? pathname.split("/").pop() || "" : ""

  const filteredConcepts = useMemo(() => {
    if (!filter.trim()) return concepts
    const q = filter.toLowerCase()
    return concepts.filter((c: any) => c.name.toLowerCase().includes(q) || c.slug.includes(q))
  }, [concepts, filter])

  const isActiveNav = (href: string) => {
    if (href === "/frameworks") return pathname.startsWith("/frameworks")
    return pathname === href
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed bottom-4 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white shadow-lg hover:bg-primary-700 active:scale-95 transition"
        aria-label="Toggle menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-14 bottom-0 left-0 z-40 w-64 overflow-y-auto
          border-r border-dark-200 bg-white dark:bg-dark-950 dark:border-dark-800
          shadow-xl md:shadow-none
          transition-transform duration-300 ease-out
          md:sticky md:top-0 md:block md:h-[calc(100vh-3.5rem)] md:border-r md:dark:border-dark-800
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Main navigation */}
        <div className="p-3 pb-0">
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-dark-400 dark:text-dark-500">Navigate</p>
          <nav className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  isActiveNav(item.href)
                    ? "bg-primary-100 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                    : "text-dark-600 hover:bg-dark-100 dark:text-dark-400 dark:hover:bg-dark-800/60"
                }`}
              >
                <span className={isActiveNav(item.href) ? "text-primary-600 dark:text-primary-400" : "text-dark-400 dark:text-dark-500"}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Concepts section (only on framework pages) */}
        {isOnFramework && (
          <div className="mt-3 border-t border-dark-100 dark:border-dark-800">
            <div className="p-3 pb-0">
              <Link
                href={`/frameworks/${slug}`}
                onClick={() => setOpen(false)}
                className={`block text-xs font-semibold uppercase tracking-wider transition ${pathname === `/frameworks/${slug}` ? "text-primary-600 dark:text-primary-400" : "text-dark-400 dark:text-dark-500 hover:text-dark-600 dark:hover:text-dark-300"}`}
              >
                {framework?.title || slug}
              </Link>
              <p className="mt-0.5 text-[11px] text-dark-400 dark:text-dark-500 mb-2">{concepts.length} concepts</p>
            </div>
            <div className="px-3 pb-1">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-dark-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search concepts..." className="w-full rounded-lg border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800 py-1.5 pl-7 pr-3 text-xs text-dark-700 dark:text-dark-300 placeholder:text-dark-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400/30 transition" />
                {filter && <button onClick={() => setFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
              </div>
            </div>
            <nav className="p-3 pt-1.5 space-y-0.5 max-h-60 overflow-y-auto">
              {filteredConcepts.length === 0 && <p className="px-3 py-4 text-xs text-center text-dark-400">No matches.</p>}
              {filteredConcepts.map((c: any, i: number) => {
                const active = slug && conceptSlug === c.slug
                return (
                  <Link key={c.slug} href={`/frameworks/${slug}/${c.slug}`} onClick={() => setOpen(false)}
                    className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${active ? "bg-primary-100 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300" : "text-dark-600 hover:bg-dark-100 dark:text-dark-400 dark:hover:bg-dark-800/60"}`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold ${active ? "bg-primary-200 text-primary-700 dark:bg-primary-800/40 dark:text-primary-300" : "bg-dark-100 text-dark-500 dark:bg-dark-800 dark:text-dark-500"}`}>{i + 1}</span>
                    <span className="truncate">{c.name}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        )}

        {/* Account */}
        <div className="mt-auto border-t border-dark-100 dark:border-dark-800 p-3">
          {user ? (
            <div className="flex items-center gap-2.5">
              {user.photoURL && <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-dark-700 dark:text-dark-300 truncate">{user.displayName || user.email}</p>
                <p className="text-[10px] text-dark-400">{isAdmin ? "Admin" : "Signed in"}</p>
              </div>
            </div>
          ) : (
            <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-800/60 transition">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Sign in
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}
