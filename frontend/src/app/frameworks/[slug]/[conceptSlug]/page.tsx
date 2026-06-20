"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { staticFrameworks } from "@/lib/staticData"
import { explainConcept, generateWhyItMatters, buildWhyItMattersPrompt, generateHowToApply, buildHowToApplyPrompt, generateCommonPitfalls, buildCommonPitfallsPrompt, generateConnectedConcepts, buildConnectedConceptsPrompt, generateCaseStudy, buildCaseStudyPrompt, generateTestYourself, buildTestYourselfPrompt, generateRealWorldExamples, buildRealWorldExamplesPrompt, generateExplainFurther, buildExplainPrompt, checkCache, slugify } from "@/lib/ollama"
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
  const [aiEnrichmentError, setAiEnrichmentError] = useState("")
  const [showEnrichPrompt, setShowEnrichPrompt] = useState(false)
  const [showExplainPrompt, setShowExplainPrompt] = useState(false)

  const [aiCaseStudy, setAiCaseStudy] = useState<any>(null)
  const [aiCaseStudyLoading, setAiCaseStudyLoading] = useState(false)
  const [aiCaseStudyCached, setAiCaseStudyCached] = useState(false)
  const [showCaseStudyPrompt, setShowCaseStudyPrompt] = useState(false)
  const [confirmCaseStudy, setConfirmCaseStudy] = useState(false)

  const [aiExercise, setAiExercise] = useState<any>(null)
  const [aiExerciseLoading, setAiExerciseLoading] = useState(false)
  const [aiExerciseCached, setAiExerciseCached] = useState(false)
  const [showExercisePrompt, setShowExercisePrompt] = useState(false)
  const [confirmExercise, setConfirmExercise] = useState(false)

  const [aiExample, setAiExample] = useState<any>(null)
  const [aiExampleLoading, setAiExampleLoading] = useState(false)
  const [aiExampleCached, setAiExampleCached] = useState(false)
  const [showExamplePrompt, setShowExamplePrompt] = useState(false)
  const [confirmExample, setConfirmExample] = useState(false)
  const [aiError, setAiError] = useState("")
  const [confirmEnrich, setConfirmEnrich] = useState(false)
  const [confirmExplain, setConfirmExplain] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [cooldown, setCooldown] = useState(0)
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current) }
  }, [])

  const startCooldown = () => {
    setConfirmEnrich(false)
    setConfirmExplain(false)
    setConfirmCaseStudy(false)
    setConfirmExercise(false)
    setConfirmExample(false)
    setCooldown(30)
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    cooldownTimerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
          cooldownTimerRef.current = null
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const startConfirm = (setter: (v: boolean) => void) => {
    if (cooldown > 0) return
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
    const [explainCached, whyCached, howCached, pitfallsCached, connectedCached, caseStudyCached, exerciseCached, exampleCached] = await Promise.all([
      checkCache(slug, conceptSlug, "explain_further"),
      checkCache(slug, conceptSlug, "why_it_matters_for_ceos"),
      checkCache(slug, conceptSlug, "how_to_apply"),
      checkCache(slug, conceptSlug, "common_pitfalls"),
      checkCache(slug, conceptSlug, "connected_concepts"),
      checkCache(slug, conceptSlug, "case_study"),
      checkCache(slug, conceptSlug, "test_yourself"),
      checkCache(slug, conceptSlug, "real_world_examples"),
    ])
    if (explainCached) {
      try {
        const parsed = JSON.parse(explainCached.result)
        setAiExplanation(parsed)
        setAiCached(true)
        setAiPromptText(explainCached.prompt || "")
      } catch {}
    }
    if (whyCached) {
      try { setAiEnrichment((prev: any) => ({ ...prev, ...JSON.parse(whyCached.result) })); setAiEnrichmentCached(true) } catch {}
    }
    if (howCached) {
      try { setAiEnrichment((prev: any) => ({ ...prev, ...JSON.parse(howCached.result) })); setAiEnrichmentCached(true) } catch {}
    }
    if (pitfallsCached) {
      try { setAiEnrichment((prev: any) => ({ ...prev, ...JSON.parse(pitfallsCached.result) })); setAiEnrichmentCached(true) } catch {}
    }
    if (connectedCached) {
      try { setAiEnrichment((prev: any) => ({ ...prev, ...JSON.parse(connectedCached.result) })); setAiEnrichmentCached(true) } catch {}
    }
    if (caseStudyCached) {
      try { setAiCaseStudy(JSON.parse(caseStudyCached.result)); setAiCaseStudyCached(true) } catch {}
    }
    if (exerciseCached) {
      try { setAiExercise(JSON.parse(exerciseCached.result)); setAiExerciseCached(true) } catch {}
    }
    if (exampleCached) {
      try { setAiExample(JSON.parse(exampleCached.result)); setAiExampleCached(true) } catch {}
    }
  }, [slug, conceptSlug])

  useEffect(() => {
    checkConceptCache()
  }, [checkConceptCache])

  // Eager prompts
  const eagerExplainPrompt = result ? buildExplainPrompt(result.concept.name, result.concept.definition, result.framework.title) : ""
  const eagerEnrichPrompt = result ? buildWhyItMattersPrompt(result.concept.name, result.concept.definition, result.framework.title, result.concept.tags) : ""
  const eagerCaseStudyPrompt = result ? buildCaseStudyPrompt(result.concept.name, result.concept.definition, result.framework.title) : ""
  const eagerExercisePrompt = result ? buildTestYourselfPrompt(result.concept.name, result.concept.definition, result.framework.title) : ""
  const eagerExamplePrompt = result ? buildRealWorldExamplesPrompt(result.concept.name, result.concept.definition, result.framework.title) : ""

  if (!result) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-dark-500 dark:text-dark-300">Concept not found</p>
      </div>
    )
  }

  const { framework, concept } = result

  // Build ordered concept list for prev/next navigation
  const allConcepts = (framework.concepts || []).map((c: any) => ({
    name: c.name,
    slug: slugify(c.name),
  }))
  const currentIdx = allConcepts.findIndex((c) => c.slug === conceptSlug)
  const prevConcept = currentIdx > 0 ? allConcepts[currentIdx - 1] : null
  const nextConcept = currentIdx < allConcepts.length - 1 ? allConcepts[currentIdx + 1] : null

  const mkHandler = (generator: Function, setter: Function, setCached: Function, setLoading: Function, setError?: Function, ...args: any[]) => async () => {
    setLoading(true)
    setter(null)
    if (setError) setError("")
    try {
      const { parsed, cached } = await generator(...args, true)
      setter(parsed)
      setCached(cached)
      startCooldown()
    } catch (err: any) {
      if (setError) setError(err.message || "Generation failed")
      startCooldown()
    }
    setLoading(false)
  }

  const handleExplain = mkHandler(explainConcept, (p: any) => { setAiExplanation(p); setAiCached(true); setEditingPrompt(false) }, () => {}, (v: boolean) => setAiLoading(v), (e: string) => setAiError(e), concept.name, concept.definition, slug, true)

  const handleWhyItMatters = mkHandler(generateWhyItMatters, (p: any) => setAiEnrichment((prev: any) => ({ ...prev, ...p })), () => setAiEnrichmentCached(true), (v: boolean) => setAiEnrichmentLoading(v), (e: string) => setAiEnrichmentError(e), concept.name, concept.definition, slug, framework.title, concept.tags)
  const handleHowToApply = mkHandler(generateHowToApply, (p: any) => setAiEnrichment((prev: any) => ({ ...prev, ...p })), () => setAiEnrichmentCached(true), (v: boolean) => setAiEnrichmentLoading(v), (e: string) => setAiEnrichmentError(e), concept.name, concept.definition, slug, framework.title)
  const handleCommonPitfalls = mkHandler(generateCommonPitfalls, (p: any) => setAiEnrichment((prev: any) => ({ ...prev, ...p })), () => setAiEnrichmentCached(true), (v: boolean) => setAiEnrichmentLoading(v), (e: string) => setAiEnrichmentError(e), concept.name, concept.definition, slug, framework.title)
  const handleConnectedConcepts = mkHandler(generateConnectedConcepts, (p: any) => setAiEnrichment((prev: any) => ({ ...prev, ...p })), () => setAiEnrichmentCached(true), (v: boolean) => setAiEnrichmentLoading(v), (e: string) => setAiEnrichmentError(e), concept.name, concept.definition, slug, framework.title)
  const handleCaseStudy = mkHandler(generateCaseStudy, setAiCaseStudy, () => setAiCaseStudyCached(true), (v: boolean) => setAiCaseStudyLoading(v), undefined, concept.name, concept.definition, slug, framework.title)
  const handleExercise = mkHandler(generateTestYourself, setAiExercise, () => setAiExerciseCached(true), (v: boolean) => setAiExerciseLoading(v), undefined, concept.name, concept.definition, slug, framework.title)
  const handleExample = mkHandler(generateRealWorldExamples, setAiExample, () => setAiExampleCached(true), (v: boolean) => setAiExampleLoading(v), undefined, concept.name, concept.definition, slug, framework.title)

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

      <div className="mb-6 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {allConcepts.length > 1 && prevConcept && (
            <button onClick={() => router.push(`/frameworks/${slug}/${prevConcept.slug}`)}
              className="inline-flex items-center gap-1 text-dark-500 hover:text-primary-600 transition dark:text-dark-300"
            ><span>&larr;</span> {prevConcept.name}</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cooldown > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">AI cooldown {cooldown}s</span>
          )}
          {allConcepts.length > 1 && (
            <span className="text-dark-400 dark:text-dark-500">{currentIdx + 1} / {allConcepts.length}</span>
          )}
          {allConcepts.length > 1 && nextConcept && (
            <button onClick={() => router.push(`/frameworks/${slug}/${nextConcept.slug}`)}
              className="inline-flex items-center gap-1 text-dark-500 hover:text-primary-600 transition dark:text-dark-300"
            >{nextConcept.name} <span>&rarr;</span></button>
          )}
        </div>
      </div>

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

      {aiEnrichmentError && (
        <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-2 text-xs text-red-600 dark:text-red-400">{aiEnrichmentError}</div>
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
            <button onClick={() => { setConfirmEnrich(false); handleWhyItMatters(); handleHowToApply(); handleCommonPitfalls(); handleConnectedConcepts() }}
              className="rounded-full bg-violet-100 dark:bg-violet-900/30 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition animate-pulse"
>Regenerate?</button>
              <button onClick={() => setConfirmEnrich(false)}
              className="rounded-full border border-dark-200 dark:border-dark-700 px-2 py-1 text-xs text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition"
            >&times;</button>
          </>
        ) : (
          <button onClick={() => startConfirm(setConfirmEnrich)}
            className="rounded-full border border-violet-200 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-900/10 px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition"
          >More Information</button>
        )}
        <button onClick={() => setShowEnrichPrompt(!showEnrichPrompt)}
          className="text-xs text-dark-400 dark:text-dark-500 hover:text-dark-600 dark:hover:text-dark-300 transition"
        >{showEnrichPrompt ? "Hide prompt" : "Show prompt"}</button>
        {showEnrichPrompt && (
          <pre className="mt-2 w-full rounded-lg bg-dark-800 p-3 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">{eagerEnrichPrompt}</pre>
        )}
      </div>

      {(aiCaseStudy || concept.case_study) && (
        <div className="mb-4 rounded-lg border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800/50 p-4">
          {aiCaseStudyCached && <span className="mb-2 inline-block rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">Cached</span>}
          <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide mb-3">Case Study: {(aiCaseStudy || concept.case_study).company}</p>
          <div className="space-y-2 text-sm">
            <div><p className="font-medium text-dark-700 dark:text-dark-300">Situation</p><p className="text-dark-600 dark:text-dark-400">{(aiCaseStudy || concept.case_study).situation}</p></div>
            <div><p className="font-medium text-dark-700 dark:text-dark-300">Application</p><p className="text-dark-600 dark:text-dark-400">{(aiCaseStudy || concept.case_study).application}</p></div>
            <div><p className="font-medium text-dark-700 dark:text-dark-300">Result</p><p className="text-dark-600 dark:text-dark-400">{(aiCaseStudy || concept.case_study).result}</p></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {aiCaseStudyLoading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-dark-200 dark:border-dark-700 px-3 py-1 text-xs text-dark-500"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Generating...</span>
            ) : confirmCaseStudy ? (
              <>
                <button onClick={() => { setConfirmCaseStudy(false); handleCaseStudy() }} className="rounded-full bg-dark-100 dark:bg-dark-800 px-3 py-1 text-xs font-medium text-dark-700 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-700 transition animate-pulse">Regenerate?</button>
                <button onClick={() => setConfirmCaseStudy(false)} className="rounded-full border border-dark-200 dark:border-dark-700 px-2 py-1 text-xs text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition">&times;</button>
              </>
            ) : (
              <button onClick={() => startConfirm(setConfirmCaseStudy)} className="rounded-full border border-dark-200 dark:border-dark-700 px-3 py-1 text-xs text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition">{aiCaseStudyCached ? "Regenerate" : "Generate with AI"}</button>
            )}
            <button onClick={() => setShowCaseStudyPrompt(!showCaseStudyPrompt)} className="text-xs text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition">{showCaseStudyPrompt ? "Hide" : "Prompt"}</button>
          </div>
          {showCaseStudyPrompt && <pre className="mt-2 rounded-lg bg-dark-800 p-3 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">{eagerCaseStudyPrompt}</pre>}
        </div>
      )}

      {(aiExercise || concept.exercise) && (
        <div className="mb-4 rounded-lg border border-primary-200 dark:border-primary-800/40 bg-primary-50/30 dark:bg-primary-900/10 p-4">
          {aiExerciseCached && <span className="mb-2 inline-block rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">Cached</span>}
          <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-3">Test Yourself</p>
          <p className="text-sm text-dark-700 dark:text-dark-300 mb-3 leading-relaxed">{(aiExercise || concept.exercise).scenario}</p>
          <div className="space-y-1.5 mb-3">{(aiExercise || concept.exercise).options.map((opt: string, i: number) => (
            <button key={i} onClick={() => { const el = document.getElementById(`exercise-feedback-${concept.name.replace(/\s+/g, '-')}`); if (el) { const c = i === (aiExercise || concept.exercise).correct; el.innerHTML = c ? '<span class="text-green-600 dark:text-green-400 font-medium">&#10003; Correct!</span>' : '<span class="text-red-600 dark:text-red-400 font-medium">&#10007; Not quite.</span>'; el.className = `mt-2 text-xs ${c ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}` } }}
              className="w-full text-left rounded-lg border border-dark-200 dark:border-dark-700 px-3 py-2 text-xs text-dark-600 dark:text-dark-400 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition"
            >{String.fromCharCode(65 + i)}. {opt}</button>
          ))}</div>
          <div id={`exercise-feedback-${concept.name.replace(/\s+/g, '-')}`} className="text-xs"></div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {aiExerciseLoading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-dark-200 dark:border-dark-700 px-3 py-1 text-xs text-dark-500"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Generating...</span>
            ) : confirmExercise ? (
              <>
                <button onClick={() => { setConfirmExercise(false); handleExercise() }} className="rounded-full bg-primary-100 dark:bg-primary-900/30 px-3 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition animate-pulse">Regenerate?</button>
                <button onClick={() => setConfirmExercise(false)} className="rounded-full border border-dark-200 dark:border-dark-700 px-2 py-1 text-xs text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition">&times;</button>
              </>
            ) : (
              <button onClick={() => startConfirm(setConfirmExercise)} className="rounded-full border border-primary-200 dark:border-primary-800/40 px-3 py-1 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition">{aiExerciseCached ? "Regenerate" : "Generate with AI"}</button>
            )}
            <button onClick={() => setShowExercisePrompt(!showExercisePrompt)} className="text-xs text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition">{showExercisePrompt ? "Hide" : "Prompt"}</button>
          </div>
          {showExercisePrompt && <pre className="mt-2 rounded-lg bg-dark-800 p-3 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">{eagerExercisePrompt}</pre>}
        </div>
      )}

      {(aiExample || concept.example) && (
        <div className="mb-4">
          {aiExampleCached && <span className="mb-2 inline-block rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">Cached</span>}
          <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide mb-3 dark:text-dark-300">Real-World Examples</p>
          <ul className="space-y-3">{(aiExample?.examples?.length ? aiExample.examples : (concept.example || "").split(" | ")).map((ex: string, i: number) => (
            <li key={i} className="flex items-start gap-3 text-sm text-dark-700 bg-dark-50 rounded-lg p-3 dark:bg-dark-900 dark:text-dark-300">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{i + 1}</span>
              <span className="leading-relaxed">{ex}</span>
            </li>
          ))}</ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {aiExampleLoading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-dark-200 dark:border-dark-700 px-3 py-1 text-xs text-dark-500"><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Generating...</span>
            ) : confirmExample ? (
              <>
                <button onClick={() => { setConfirmExample(false); handleExample() }} className="rounded-full bg-dark-100 dark:bg-dark-800 px-3 py-1 text-xs font-medium text-dark-700 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-700 transition animate-pulse">Regenerate?</button>
                <button onClick={() => setConfirmExample(false)} className="rounded-full border border-dark-200 dark:border-dark-700 px-2 py-1 text-xs text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition">&times;</button>
              </>
            ) : (
              <button onClick={() => startConfirm(setConfirmExample)} className="rounded-full border border-dark-200 dark:border-dark-700 px-3 py-1 text-xs text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition">{aiExampleCached ? "Regenerate" : "Generate with AI"}</button>
            )}
            <button onClick={() => setShowExamplePrompt(!showExamplePrompt)} className="text-xs text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition">{showExamplePrompt ? "Hide" : "Prompt"}</button>
          </div>
          {showExamplePrompt && <pre className="mt-2 rounded-lg bg-dark-800 p-3 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">{eagerExamplePrompt}</pre>}
        </div>
      )}

      {concept.tags && concept.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">{concept.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{tag}</span>
        ))}</div>
      )}

      <div className="mb-4 mt-6">
        {aiCached && <span className="mb-2 inline-block rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">Cached</span>}
        {aiError && (
          <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-2 text-xs text-red-600 dark:text-red-400">{aiError}</div>
        )}
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
              >Regenerate?</button>
              <button onClick={() => setConfirmExplain(false)}
                className="rounded-full border border-dark-200 dark:border-dark-700 px-2 py-1 text-xs text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 transition"
              >&times;</button>
            </>
          ) : (
            <button onClick={() => startConfirm(setConfirmExplain)}
              className="rounded-full border border-primary-200 dark:border-primary-800/40 bg-primary-50/30 dark:bg-primary-900/10 px-3 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-100/50 dark:hover:bg-primary-900/20 transition"
            >Explain Further</button>
          )}
        </div>

        <button onClick={() => setShowExplainPrompt(!showExplainPrompt)}
          className="mt-2 text-xs text-dark-400 dark:text-dark-500 hover:text-dark-600 dark:hover:text-dark-300 transition"
        >{showExplainPrompt ? "Hide prompt" : "Show prompt"}</button>

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
        {showExplainPrompt && (
          <pre className="mt-2 rounded-lg bg-dark-800 p-3 text-xs text-green-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">{(aiPromptText || eagerExplainPrompt)}</pre>
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
