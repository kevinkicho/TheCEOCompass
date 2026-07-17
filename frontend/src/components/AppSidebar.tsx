"use client"

import Image from "next/image"
import { useState, useMemo, useCallback, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { loadFrameworks, getCachedFrameworks, slugify } from "@/lib/rtdb-cache"
import { useAuth } from "@/lib/useAuth"

type ConceptItem = { slug: string; name: string }
type FrameworkItem = { slug: string; title: string; concepts: ConceptItem[] }

export function AppSidebar() {
  const pathname = usePathname()
  const { user, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [frameworksList, setFrameworksList] = useState<any[]>(getCachedFrameworks() || [])

  useEffect(() => {
    if (getCachedFrameworks()) { setFrameworksList(getCachedFrameworks()!); return }
    loadFrameworks().then((fw) => setFrameworksList(fw)).catch(() => {})
  }, [])

  const treeData: FrameworkItem[] = useMemo(() =>
    (frameworksList || []).map((fw: any) => ({
      slug: fw.slug,
      title: fw.title,
      concepts: (() => {
        const seen = new Set<string>()
        return (fw.concepts || []).filter((c: any) => {
          const cs = slugify(c.name)
          if (seen.has(cs)) return false
          seen.add(cs)
          return true
        }).map((c: any) => ({ slug: slugify(c.name), name: c.name }))
      })(),
    })),
  [frameworksList])

  const pathParts = pathname.split("/").filter(Boolean)
  const currentSlug = pathParts[0] === "frameworks" ? pathParts[1] || "" : ""
  const conceptSlug = pathParts[0] === "frameworks" && pathParts.length >= 3 ? pathParts[2] : ""

  const toggleExpand = useCallback((fwSlug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(fwSlug)) next.delete(fwSlug)
      else next.add(fwSlug)
      return next
    })
  }, [])

  const [filteredFws, filteredMap] = useMemo(() => {
    if (!filter.trim()) return [true, null as Record<string, ConceptItem[]> | null]
    const q = filter.toLowerCase()
    const map: Record<string, ConceptItem[]> = {}
    for (const fw of treeData) {
      if (fw.title.toLowerCase().includes(q)) {
        map[fw.slug] = fw.concepts
      } else {
        const matched = fw.concepts.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q))
        if (matched.length > 0) map[fw.slug] = matched
      }
    }
    return [false, map]
  }, [filter, treeData])

  const displayItems = filteredFws
    ? treeData
    : treeData.filter((fw) => filteredMap && (filteredMap[fw.slug] || fw.title.toLowerCase().includes(filter.toLowerCase())))

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed bottom-4 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white shadow-lg hover:bg-primary-700 active:scale-95 transition"
        aria-label="Toggle menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`
          fixed top-14 bottom-0 left-0 z-40 w-72 overflow-y-auto
          border-r border-dark-200 bg-white dark:bg-dark-950 dark:border-dark-800
          shadow-xl md:shadow-none
          transition-transform duration-300 ease-out
          md:sticky md:top-0 md:block md:h-[calc(100vh-3.5rem)] md:border-r md:dark:border-dark-800
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-dark-100 dark:border-dark-800 bg-white/90 dark:bg-dark-950/90 backdrop-blur-sm">
          <div className="px-4 py-3">
            <Link href="/" onClick={() => setOpen(false)} className="text-sm font-bold text-dark-900 dark:text-dark-100">
              CEO<span className="text-primary-600 dark:text-primary-400">Compass</span>
            </Link>
          </div>
          <div className="px-3 pb-2.5">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search frameworks & concepts..." className="w-full rounded-lg border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800 py-1.5 pl-8 pr-3 text-xs text-dark-700 dark:text-dark-300 placeholder:text-dark-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400/30 transition" />
              {filter && <button onClick={() => setFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
            </div>
          </div>
        </div>

        {/* Tree navigation */}
        <nav className="p-2 pb-0">
          {displayItems.length === 0 && (
            <p className="px-3 py-8 text-xs text-center text-dark-400 dark:text-dark-500">No results for &ldquo;{filter}&rdquo;</p>
          )}
          {displayItems.map((fw) => {
            const concepts = filteredFws ? fw.concepts : (filteredMap?.[fw.slug] || [])
            const isFwActive = !filter && pathname === `/frameworks/${fw.slug}`
            const isExpanded = expanded.has(fw.slug)

            return (
                <div key={fw.slug} className="mb-0.5">
                  {/* Framework row */}
                  <div className="group flex items-center rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800/60 transition">
                    <button
                      onClick={() => toggleExpand(fw.slug)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    <Link
                      href={`/frameworks/${fw.slug}`}
                      onClick={() => setOpen(false)}
                      className={`flex-1 min-w-0 py-1.5 pr-2 text-sm transition ${isFwActive ? "font-medium text-primary-700 dark:text-primary-300" : "text-dark-700 dark:text-dark-300 hover:text-dark-900 dark:hover:text-dark-100"}`}
                    >
                      <span className="truncate block">{fw.title}</span>
                    </Link>
                    <span className="pr-2 text-[10px] text-dark-400 dark:text-dark-500 tabular-nums">{fw.concepts.length}</span>
                  </div>

                  {/* Concepts (collapsible) */}
                  {(isExpanded || filter) && concepts.length > 0 && (
                    <div className="ml-4 border-l border-dark-200 dark:border-dark-700 pl-2 space-y-0.5 mb-0.5">
                      {concepts.map((c) => {
                        const active = conceptSlug === c.slug
                        return (
                          <Link
                            key={c.slug}
                            href={`/frameworks/${fw.slug}/${c.slug}`}
                            onClick={() => setOpen(false)}
                            className={`flex items-center rounded-md px-2.5 py-1.5 text-sm transition ${active ? "bg-primary-100 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300" : "text-dark-500 hover:text-dark-700 dark:text-dark-400 dark:hover:text-dark-200 hover:bg-dark-50 dark:hover:bg-dark-800/40"}`}
                          >
                            {c.name}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
            )
          })}
        </nav>

        <div className="h-3" />

        {/* Account */}
        <div className="sticky bottom-0 border-t border-dark-100 dark:border-dark-800 bg-white/90 dark:bg-dark-950/90 backdrop-blur-sm p-3">
          {user ? (
            <div className="flex items-center gap-2.5">
              {user.photoURL && <Image src={user.photoURL} alt="" width={28} height={28} className="h-7 w-7 rounded-full" unoptimized />}
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
