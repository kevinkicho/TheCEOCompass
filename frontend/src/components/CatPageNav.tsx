"use client"

export function CatPageNav({ cat, catEntries, catPage, goToCatPage }: {
  cat: string; catEntries: Record<string, any[]>; catPage: Record<string, number>; goToCatPage: (c: string, i: number) => void
}) {
  const entries = catEntries[cat]
  if (!entries || entries.length <= 1) return null
  const cur = catPage[cat] || 0
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-dark-400 dark:text-dark-500">
      <button onClick={() => goToCatPage(cat, cur - 1)} disabled={cur === 0}
        className="hover:text-dark-600 dark:hover:text-dark-300 disabled:opacity-30 transition px-0.5">&lt;</button>
      <span className="tabular-nums">{cur + 1}/{entries.length}</span>
      <button onClick={() => goToCatPage(cat, cur + 1)} disabled={cur >= entries.length - 1}
        className="hover:text-dark-600 dark:hover:text-dark-300 disabled:opacity-30 transition px-0.5">&gt;</button>
    </span>
  )
}
