"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { staticFrameworks } from "@/lib/staticData"
import { slugify } from "@/lib/ollama"

function getFrameworkData(slug: string) {
  return (staticFrameworks as any[]).find((f) => f.slug === slug)
}

export function ConceptSidebar() {
  const { slug } = useParams<{ slug: string }>()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")

  const framework = useMemo(() => getFrameworkData(slug), [slug])
  const isFrameworkPage = pathname === `/frameworks/${slug}`
  const isOnConceptPage = pathname.startsWith(`/frameworks/${slug}/`) && pathname !== `/frameworks/${slug}`
  const conceptSlug = isOnConceptPage ? pathname.split("/").pop() : ""

  const concepts = useMemo(() => {
    if (!framework || !framework.concepts) return []
    const seen = new Set<string>()
    const items: { slug: string; name: string }[] = []
    for (const c of framework.concepts) {
      const cs = slugify(c.name)
      if (!seen.has(cs)) {
        seen.add(cs)
        items.push({ slug: cs, name: c.name })
      }
    }
    return items
  }, [framework])

  const filteredConcepts = useMemo(() => {
    if (!filter.trim()) return concepts
    const q = filter.toLowerCase()
    return concepts.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q))
  }, [concepts, filter])

  const isActive = (cs: string) => conceptSlug === cs

  // Not on a framework page — show nothing (sidebar hidden)
  if (!framework) return null

  return (
    <>
      {/* Mobile toggle FAB */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white shadow-lg hover:bg-primary-700 active:scale-95 transition"
        aria-label="Open concept menu"
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
          md:sticky md:top-14 md:block md:h-[calc(100vh-3.5rem)]
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-dark-100 dark:border-dark-800 bg-white/90 dark:bg-dark-950/90 backdrop-blur-sm">
          <div className="px-4 py-3">
            <Link
              href={`/frameworks/${framework.slug}`}
              onClick={() => setOpen(false)}
              className={`block text-xs font-semibold uppercase tracking-wider transition ${
                isFrameworkPage
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-dark-400 dark:text-dark-500 hover:text-dark-600 dark:hover:text-dark-300"
              }`}
            >
              {framework.title}
            </Link>
            <p className="mt-0.5 text-[11px] text-dark-400 dark:text-dark-500">
              {concepts.length} concepts
            </p>
          </div>
          <div className="px-3 pb-2.5">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-400 dark:text-dark-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search concepts..."
                className="w-full rounded-lg border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800 py-1.5 pl-8 pr-3 text-xs text-dark-700 dark:text-dark-300 placeholder:text-dark-400 dark:placeholder:text-dark-500 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400/30 transition"
              />
              {filter && (
                <button onClick={() => setFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Concept list */}
        <nav className="p-3 pt-2 space-y-0.5">
          {filteredConcepts.length === 0 && (
            <p className="px-3 py-6 text-xs text-center text-dark-400 dark:text-dark-500">No concepts match your search.</p>
          )}
          {filteredConcepts.map((c, i) => {
            const active = isActive(c.slug)
            return (
              <Link
                key={c.slug}
                href={`/frameworks/${framework.slug}/${c.slug}`}
                onClick={() => setOpen(false)}
                className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-primary-100 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                    : "text-dark-600 hover:bg-dark-100 dark:text-dark-400 dark:hover:bg-dark-800/60"
                }`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold transition ${
                  active
                    ? "bg-primary-200 text-primary-700 dark:bg-primary-800/40 dark:text-primary-300"
                    : "bg-dark-100 text-dark-500 dark:bg-dark-800 dark:text-dark-500 group-hover:bg-dark-200 dark:group-hover:bg-dark-700"
                }`}>
                  {i + 1}
                </span>
                <span className="truncate">{c.name}</span>
                {active && (
                  <span className="ml-auto shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-500 dark:text-primary-400">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom spacer */}
        <div className="h-4" />
      </aside>
    </>
  )
}
