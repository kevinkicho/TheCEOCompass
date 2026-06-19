"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import slugs from "@/data/slugs.json"

export function ConceptSidebar() {
  const { slug } = useParams<{ slug: string }>()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const conceptSlugs = (slugs as any).concepts?.[slug]
  if (!conceptSlugs || conceptSlugs.length === 0) return null

  const frameworkSlug = slug
  const isActive = (cs: string) => pathname === `/frameworks/${frameworkSlug}/${cs}`

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg"
        aria-label="Toggle concept menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-14 bottom-0 left-0 z-40 w-64 overflow-y-auto border-r border-dark-200 
          bg-white dark:bg-dark-950 dark:border-dark-700
          transition-transform duration-200
          md:sticky md:top-14 md:block md:h-[calc(100vh-3.5rem)]
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="p-3">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-dark-400 dark:text-dark-500">
            Concepts
          </p>
          <nav className="space-y-0.5">
            {conceptSlugs.map((cs: string) => (
              <Link
                key={cs}
                href={`/frameworks/${frameworkSlug}/${cs}`}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  isActive(cs)
                    ? "bg-primary-100 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                    : "text-dark-600 hover:bg-dark-100 dark:text-dark-400 dark:hover:bg-dark-800"
                }`}
              >
                {cs.replace(/-/g, " ")}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
    </>
  )
}
