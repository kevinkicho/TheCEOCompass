"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { staticFrameworks } from "@/lib/staticData"
import { explainConcept, regenerateEnrichment, checkCache, slugify } from "@/lib/ollama"
import { db, ref, set, query, orderByChild, limitToLast, get } from "@/lib/firebase"
import { useAuth } from "@/lib/useAuth"
import type { FrameworkConcept, Framework } from "@/lib/types"

function findConcept(slug: string, conceptSlug: string): { framework: Framework; concept: FrameworkConcept } | null {
  const fw = (staticFrameworks as any).find((f: any) => f.slug === slug) as Framework | undefined
  if (!fw) return null
  const concept = fw.concepts?.find((c) => slugify(c.name) === conceptSlug)
  if (!concept) return null
  return { framework: fw, concept }
}

export default function ConceptDetailPage() {
  const { slug, conceptSlug } = useParams<{ slug: string; conceptSlug: string }>()
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [aiExplanation, setAiExplanation] = useState<Record<string, string> | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCached, setAiCached] = useState(false)
  const [aiElapsed, setAiElapsed] = useState(0)
  const [showAiPrompt, setShowAiPrompt] = useState(false)
  const [aiPromptText, setAiPromptText] = useState("")
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [editPromptValue, setEditPromptValue] = useState("")
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [currentResponseId, setCurrentResponseId] = useState<string | null>(null)
  const aiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [aiEnrichment, setAiEnrichment] = useState<any>(null)
  const [aiEnrichmentLoading, setAiEnrichmentLoading] = useState(false)
  const [aiEnrichmentCached, setAiEnrichmentCached] = useState(false)
  const [confirmEnrich, setConfirmEnrich] = useState(false)
  const [confirmExplain, setConfirmExplain] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startConfirm = (setter: (v: boolean) => void) => {
    setter(true)
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    confirmTimerRef.current = setTimeout(() => setter(false), 5000)
  }

  const result = findConcept(slug, conceptSlug)

  useEffect(() => {
    if (aiLoading) {
      setAiElapsed(0)
      aiTimerRef.current = setInterval(() => setAiElapsed((e) => e + 1), 1000)
    } else {
      if (aiTimerRef.current) clearInterval(aiTimerRef.current)
      aiTimerRef.current = null
    }
    return () => { if (aiTimerRef.current) clearInterval(aiTimerRef.current) }
  }, [aiLoading])

  const checkConceptCache = useCallback(async () => {
    const cached = await checkCache(slug, conceptSlug)
    if (cached) {
      try {
        const parsed = JSON.parse(cached.result)
        setAiExplanation(parsed)
        setAiCached(true)
        setAiPromptText(cached.prompt || "")
      } catch {}
    }
  }, [slug, conceptSlug])

  useEffect(() => {
    checkConceptCache()
  }, [checkConceptCache])

  if (!result) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-dark-500 dark:text-dark-300">Concept not found</p>
      </div>
    )
  }

  const { framework, concept } = result

  const handleExplain = async () => {
    setAiLoading(true)
    setAiExplanation(null)
    try {
      const { parsed, cached, prompt } = await explainConcept(concept.name, concept.definition, slug, true)
      setAiExplanation(parsed)
      setAiCached(cached)
      setAiPromptText(prompt)
      setEditingPrompt(false)
    } catch (err) {
      console.error(err)
    }
    setAiLoading(false)
  }

  const handleRegenerateEnrichment = async () => {
    setAiEnrichmentLoading(true)
    setAiEnrichment(null)
    try {
      const { parsed, cached } = await regenerateEnrichment(
        concept.name, concept.definition, slug, framework.title, concept.tags, true,
      )
      setAiEnrichment(parsed)
      setAiEnrichmentCached(cached)
    } catch (err) {
      console.error(err)
    }
    setAiEnrichmentLoading(false)
  }

  const handleSavePrompt = async () => {
    if (!db || !editPromptValue.trim()) return
    setSavingPrompt(true)
    try {
      const cachePath = `framework/${slug}/${conceptSlug}/responses`
      const q = query(ref(db, cachePath), orderByChild("created_at"), limitToLast(1))
      const snap = await get(q)
      if (snap.exists()) {
        const entries = snap.val()
        const id = Object.keys(entries)[0]
        await set(ref(db, `${cachePath}/${id}/prompt`), editPromptValue.trim())
        setAiPromptText(editPromptValue.trim())
      }
    } catch (err) {
      console.error(err)
    }
    setEditingPrompt(false)
    setSavingPrompt(false)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <button onClick={() => router.push(`/frameworks/${slug}`)}
        className="mb-6 inline-flex items-center gap-1 text-sm text-dark-500 hover:text-primary-600 transition dark:text-dark-300"
      ><span className="text-lg leading-none">&larr;</span> Back to {framework.title}</button>

      <h1 className="mb-2 text-2xl sm:text-3xl font-bold text-dark-900 dark:text-dark-100">{concept.name}</h1>

      <p className="mb-6 text-base leading-relaxed text-dark-800 font-medium bg-primary-50 rounded-lg p-4 border-l-4 border-primary-400 dark:text-dark-200 dark:bg-primary-900/20">{concept.definition}</p>

      {concept.formula && <div className="mb-4 rounded-lg bg-dark-800 px-4 py-3 font-mono text-sm text-green-300">{concept.formula}</div>}

      <div className="flex items-center gap-3 mb-3">
        {aiEnrichmentCached && <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">Cached</span>}
        {aiEnrichment && <span className="rounded-full bg-violet-100 dark:bg-violet-900/30 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">Regenerated</span>}
      </div>

      {(aiEnrichment?.why_it_matters || concept.why_it_matters) && (
        <div className="mb-4 rounded-lg border border-primary-200 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/10 p-4">
          <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-2">Why It Matters for CEOs</p>
          <p className="text-sm text-dark-700 dark:text-dark-300 leading-relaxed">{aiEnrichment?.why_it_matters || concept.why_it_matters}</p>
        </div>
      )}

      {((aiEnrichment?.steps?.length) || (concept.steps && concept.steps.length > 0)) && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-3">How to Apply</p>
          <ol className="space-y-2.5">{(aiEnrichment?.steps || concept.steps).map((step: any, i: number) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-xs font-bold text-primary-700 dark:text-primary-300 mt-0.5">{i + 1}</span>
              <div><p className="font-semibold text-dark-800 dark:text-dark-200">{step.title}</p><p className="text-dark-600 dark:text-dark-400">{step.description}</p></div>
            </li>
          ))}</ol>
        </div>
      )}

      {((aiEnrichment?.pitfalls?.length) || (concept.pitfalls && concept.pitfalls.length > 0)) && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-3">Common Pitfalls</p>
          <div className="space-y-2">{(aiEnrichment?.pitfalls || concept.pitfalls).map((pf: any, i: number) => (
            <div key={i} className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-3">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">{pf.title}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400/80 leading-relaxed">{pf.description}</p>
            </div>
          ))}</div>
        </div>
      )}

      {((aiEnrichment?.related_concepts?.length) || (concept.related_concepts && concept.related_concepts.length > 0)) && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-3">Connected Concepts</p>
          <div className="space-y-1.5">{(aiEnrichment?.related_concepts || concept.related_concepts).map((rc: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-primary-500 mt-0.5">&#8594;</span>
              <div><span className="font-medium text-dark-800 dark:text-dark-200">{rc.name}</span><span className="text-dark-500 dark:text-dark-400"> &mdash; {rc.relationship}</span></div>
            </div>
          ))}</div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {aiEnrichmentLoading ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-900/10 px-3 py-1 text-xs text-violet-600 dark:text-violet-400">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating...
          </span>
        ) : confirmEnrich ? (
          <>
            <button onClick={() => { setConfirmEnrich(false); handleRegenerateEnrichment() }}
              className="rounded-full bg-violet-100 dark:bg-violet-900/30 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition animate-pulse"
            >Confirm?</button>
            <button onClick={() => setConfirmEnrich(false)}
              className="rounded-full border border-dark-200 dark:border-dark-700 px-2 py-1 text-xs text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition"
            >&times;</button>
          </>
        ) : (
          <button onClick={() => startConfirm(setConfirmEnrich)}
            className="rounded-full border border-violet-200 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-900/10 px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition"
          >{aiEnrichment ? "Re-gen" : "Regenerate Enrich"}</button>
        )}
      </div>

      {concept.case_study && (
        <div className="mb-4 rounded-lg border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800/50 p-4">
          <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-3">Case Study: {concept.case_study.company}</p>
          <div className="space-y-2 text-sm">
            <div><p className="font-medium text-dark-700 dark:text-dark-300">Situation</p><p className="text-dark-600 dark:text-dark-400">{concept.case_study.situation}</p></div>
            <div><p className="font-medium text-dark-700 dark:text-dark-300">Application</p><p className="text-dark-600 dark:text-dark-400">{concept.case_study.application}</p></div>
            <div><p className="font-medium text-dark-700 dark:text-dark-300">Result</p><p className="text-dark-600 dark:text-dark-400">{concept.case_study.result}</p></div>
          </div>
        </div>
      )}

      {concept.exercise && (
        <div className="mb-4 rounded-lg border border-primary-200 dark:border-primary-800/40 bg-primary-50/30 dark:bg-primary-900/10 p-4">
          <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-3">Test Yourself</p>
          <p className="text-sm text-dark-700 dark:text-dark-300 mb-3 leading-relaxed">{concept.exercise.scenario}</p>
          <div className="space-y-1.5 mb-3">{concept.exercise.options.map((opt, i) => (
            <button key={i} onClick={() => { const el = document.getElementById(`exercise-feedback-${concept.name.replace(/\s+/g, '-')}`); if (el) { const c = i === concept.exercise!.correct; el.innerHTML = c ? '<span class="text-green-600 dark:text-green-400 font-medium">&#10003; Correct!</span>' : '<span class="text-red-600 dark:text-red-400 font-medium">&#10007; Not quite.</span>'; el.className = `mt-2 text-xs ${c ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}` } }}
              className="w-full text-left rounded-lg border border-dark-200 dark:border-dark-700 px-3 py-2 text-xs text-dark-600 dark:text-dark-400 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition"
            >{String.fromCharCode(65 + i)}. {opt}</button>
          ))}</div>
          <div id={`exercise-feedback-${concept.name.replace(/\s+/g, '-')}`} className="text-xs"></div>
        </div>
      )}

      {concept.example && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide mb-3 dark:text-dark-300">Real-World Examples</p>
          <ul className="space-y-3">{concept.example.split(" | ").map((ex, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-dark-700 bg-dark-50 rounded-lg p-3 dark:bg-dark-900 dark:text-dark-300">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{i + 1}</span>
              <span className="leading-relaxed">{ex}</span>
            </li>
          ))}</ul>
        </div>
      )}

      {concept.tags && concept.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">{concept.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{tag}</span>
        ))}</div>
      )}

      <div className="mb-4 mt-6">
        {aiCached && <span className="mb-2 inline-block rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">Cached</span>}
        <div className="flex flex-wrap items-center gap-2">
          {aiLoading ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 dark:border-primary-800/40 bg-primary-50/30 dark:bg-primary-900/10 px-3 py-1 text-xs text-primary-600 dark:text-primary-400">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating... {aiElapsed}s
            </span>
          ) : confirmExplain ? (
            <>
              <button onClick={() => { setConfirmExplain(false); handleExplain() }}
                className="rounded-full bg-primary-100 dark:bg-primary-900/30 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition animate-pulse"
              >Confirm?</button>
              <button onClick={() => setConfirmExplain(false)}
                className="rounded-full border border-dark-200 dark:border-dark-700 px-2 py-1 text-xs text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition"
              >&times;</button>
            </>
          ) : (
            <button onClick={() => startConfirm(setConfirmExplain)}
              className="rounded-full border border-primary-200 dark:border-primary-800/40 bg-primary-50/30 dark:bg-primary-900/10 px-3 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-100/50 dark:hover:bg-primary-900/20 transition"
            >{aiExplanation ? "Re-explain" : "Explain Further"}</button>
          )}
        </div>

        {aiPromptText && <button onClick={() => setShowAiPrompt(!showAiPrompt)}
          className="mt-2 text-xs text-dark-400 dark:text-dark-500 hover:text-dark-600 dark:hover:text-dark-300 transition"
        >{showAiPrompt ? "Hide prompt" : "Show prompt"}</button>}

        {isAdmin && aiPromptText && !editingPrompt && (
          <button onClick={() => { setEditPromptValue(aiPromptText); setEditingPrompt(true) }}
            className="ml-2 text-xs text-primary-500 hover:text-primary-600 transition"
          >Edit</button>
        )}

        {editingPrompt && (
          <div className="mt-2 space-y-2">
            <textarea value={editPromptValue} onChange={(e) => setEditPromptValue(e.target.value)}
              className="w-full rounded-lg border border-dark-200 dark:border-dark-700 bg-dark-800 p-3 text-xs text-green-300 font-mono h-32 resize-y"
            />
            <div className="flex gap-2">
              <button onClick={handleSavePrompt} disabled={savingPrompt}
                className="rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition disabled:opacity-50"
              >{savingPrompt ? "Saving..." : "Save"}</button>
              <button onClick={() => setEditingPrompt(false)}
                className="rounded-lg border border-dark-200 dark:border-dark-700 px-4 py-1.5 text-xs text-dark-600 dark:text-dark-400 hover:bg-dark-50 dark:hover:bg-dark-800 transition"
              >Cancel</button>
            </div>
          </div>
        )}
        {showAiPrompt && aiPromptText && (
          <pre className="mt-2 rounded-lg bg-dark-800 p-3 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">{aiPromptText}</pre>
        )}

        {aiExplanation && (
          <div className="mt-4 space-y-4 animate-slide-up">
            {[
              { key: "real_world_example", label: "Real-World Example",
                cls: "border-sky-400 dark:border-sky-500 bg-sky-50/60 dark:bg-sky-900/10 border-sky-100 dark:border-sky-900/20",
                iconCls: "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400",
                labelCls: "text-sky-700 dark:text-sky-300",
                icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
              { key: "ceo_insight", label: "CEO Insight",
                cls: "border-violet-400 dark:border-violet-500 bg-violet-50/60 dark:bg-violet-900/10 border-violet-100 dark:border-violet-900/20",
                iconCls: "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
                labelCls: "text-violet-700 dark:text-violet-300",
                icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
              { key: "common_mistake", label: "Common Mistake",
                cls: "border-amber-400 dark:border-amber-500 bg-amber-50/60 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20",
                iconCls: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
                labelCls: "text-amber-700 dark:text-amber-300",
                icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
              { key: "related_tip", label: "Quick Tip",
                cls: "border-emerald-400 dark:border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20",
                iconCls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
                labelCls: "text-emerald-700 dark:text-emerald-300",
                icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
              ].filter((c) => aiExplanation[c.key]).map((c) => (
              <div key={c.key} className={`rounded-xl border-l-4 ${c.cls} p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full ${c.iconCls}`}>{c.icon}</span>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${c.labelCls}`}>{c.label}</span>
                </div>
                <p className="text-sm text-dark-700 dark:text-dark-300 leading-relaxed">{aiExplanation[c.key]}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
