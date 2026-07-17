/**
 * Quotes catalog: prefer RTDB `quotes/catalog` + `quotes/categories`,
 * fall back to bundled quotes.json (seed for scripts/seed-catalog-rtdb.mjs).
 * AI-generated quotes stay at `quotes/generated` (live only).
 */

import { db, ref, get } from "./firebase"
import type { QuoteEntry } from "./types"
import quotesData from "@/data/quotes.json"

export type QuoteCategory = {
  id: string
  name: string
  icon: string
  color: string
}

type QuotesFile = {
  version?: string
  categories: QuoteCategory[]
  quotes: QuoteEntry[]
}

const bundled = quotesData as QuotesFile

let cachedQuotes: QuoteEntry[] | null = null
let cachedCategories: QuoteCategory[] | null = null
let loadPromise: Promise<{ quotes: QuoteEntry[]; categories: QuoteCategory[] }> | null = null
let source: "rtdb" | "static" | null = null

function normalizeQuote(raw: unknown, key?: string): QuoteEntry | null {
  if (!raw || typeof raw !== "object") return null
  const q = raw as QuoteEntry
  const id = q.id || key
  if (!id || !q.text) return null
  return {
    ...q,
    id,
    person: q.person || "Unknown",
    role: q.role || "",
    text: q.text,
    category: q.category || "decision-making",
  }
}

async function tryLoadFromRtdb(): Promise<{
  quotes: QuoteEntry[]
  categories: QuoteCategory[]
} | null> {
  if (!db) return null
  try {
    const [catSnap, quoteSnap] = await Promise.all([
      get(ref(db!, "quotes/categories")),
      get(ref(db!, "quotes/catalog")),
    ])

    const categories: QuoteCategory[] = []
    if (catSnap.exists()) {
      const val = catSnap.val() as Record<string, QuoteCategory>
      for (const [id, c] of Object.entries(val)) {
        if (c && typeof c === "object") {
          categories.push({
            id: c.id || id,
            name: c.name || id,
            icon: c.icon || "quote",
            color: c.color || "blue",
          })
        }
      }
    }

    const quotes: QuoteEntry[] = []
    if (quoteSnap.exists()) {
      const val = quoteSnap.val() as Record<string, unknown>
      for (const [key, raw] of Object.entries(val)) {
        const q = normalizeQuote(raw, key)
        if (q) quotes.push(q)
      }
    }

    if (quotes.length === 0 && categories.length === 0) return null
    return {
      quotes,
      categories: categories.length > 0 ? categories : bundled.categories,
    }
  } catch {
    return null
  }
}

export async function loadQuotesCatalog(): Promise<{
  quotes: QuoteEntry[]
  categories: QuoteCategory[]
}> {
  if (cachedQuotes && cachedCategories) {
    return { quotes: cachedQuotes, categories: cachedCategories }
  }
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const fromRtdb = await tryLoadFromRtdb()
    if (fromRtdb) {
      cachedQuotes = fromRtdb.quotes
      cachedCategories = fromRtdb.categories
      source = "rtdb"
      return fromRtdb
    }
    cachedQuotes = (bundled.quotes || []).map((q) => normalizeQuote(q)!).filter(Boolean)
    cachedCategories = bundled.categories || []
    source = "static"
    return { quotes: cachedQuotes, categories: cachedCategories }
  })().catch((err) => {
    loadPromise = null
    throw err
  })

  return loadPromise
}

export function getQuotesCatalogSource(): "rtdb" | "static" | null {
  return source
}

export function getBundledQuoteCategories(): QuoteCategory[] {
  return bundled.categories || []
}

/** Sync categories for components that only need tab metadata before load. */
export function getBundledQuotes(): QuoteEntry[] {
  return (bundled.quotes || []).map((q) => normalizeQuote(q)!).filter(Boolean)
}

export function clearQuotesCatalogCache(): void {
  cachedQuotes = null
  cachedCategories = null
  loadPromise = null
  source = null
}
