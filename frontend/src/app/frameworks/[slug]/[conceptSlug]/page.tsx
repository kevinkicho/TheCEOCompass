"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { loadFrameworks, getCachedFrameworks, slugify } from "@/lib/rtdb-cache"
import { explainConcept, generateWhyItMatters, buildWhyItMattersPrompt, generateHowToApply, buildHowToApplyPrompt, generateCommonPitfalls, buildCommonPitfallsPrompt, generateConnectedConcepts, buildConnectedConceptsPrompt, generateCaseStudy, buildCaseStudyPrompt, generateTestYourself, buildTestYourselfPrompt, generateRealWorldExamples, buildRealWorldExamplesPrompt, buildExplainPrompt, loadCategoryEntries } from "@/lib/ollama"
import { db, ref, set, get, onChildAdded } from "@/lib/firebase"
import { markConceptViewed } from "@/lib/firebase-crud"
import { useAuth } from "@/lib/useAuth"
import { CatPageNav } from "@/components/CatPageNav"
import { PromptTooltip } from "@/components/PromptTooltip"
import { SparkleBtn } from "@/components/SparkleBtn"
import { SkeletonCard } from "@/components/SkeletonCard"
import { ConceptHeader } from "@/components/concept/ConceptHeader"
import { ConceptComparePanel } from "@/components/concept/ConceptComparePanel"
import { SpacedReviewBar } from "@/components/concept/SpacedReviewBar"
import { LearningToolsPanel } from "@/components/concept/LearningToolsPanel"
import type { FrameworkConcept, Framework } from "@/lib/types"

function findConcept(slug: string, conceptSlug: string): { framework: Framework; concept: FrameworkConcept } | null {
  const frameworks = getCachedFrameworks()
  if (!frameworks) return null
  const fw = frameworks.find((f: any) => f.slug === slug) as Framework | undefined
  if (!fw) return null
  const concept = fw.concepts?.find((c) => slugify(c.name) === conceptSlug)
  if (!concept) return null
  return { framework: fw, concept }
}

export default function ConceptDetailPage() {
  const { slug, conceptSlug } = useParams<{ slug: string; conceptSlug: string }>()
  const { isAdmin } = useAuth()
  const [frameworksReady, setFrameworksReady] = useState(!!getCachedFrameworks())
  const [pageError, setPageError] = useState("")

  useEffect(() => {
    if (getCachedFrameworks()) { setFrameworksReady(true); return }
    loadFrameworks()
      .then(() => setFrameworksReady(true))
      .catch((err) => { setPageError(err.message || "Failed to load frameworks"); setFrameworksReady(true) })
  }, [])
  const [aiExplanation, setAiExplanation] = useState<Record<string, string> | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCached, setAiCached] = useState(false)
  const [aiElapsed, setAiElapsed] = useState(0)
  const [showAiPrompt, setShowAiPrompt] = useState(false)
  const [aiPromptText, setAiPromptText] = useState("")
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [editPromptValue, setEditPromptValue] = useState("")
  const [savingPrompt, setSavingPrompt] = useState(false)
  const aiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [aiEnrichment, setAiEnrichment] = useState<any>(null)
  const [aiEnrichmentCached, setAiEnrichmentCached] = useState(false)
  const [showExplainPrompt, setShowExplainPrompt] = useState(false)

  const [aiCaseStudy, setAiCaseStudy] = useState<any>(null)
  const [aiCaseStudyLoading, setAiCaseStudyLoading] = useState(false)
  const [aiCaseStudyCached, setAiCaseStudyCached] = useState(false)
  const [confirmCaseStudy, setConfirmCaseStudy] = useState(false)

  const [aiExercise, setAiExercise] = useState<any>(null)
  const [aiExerciseLoading, setAiExerciseLoading] = useState(false)
  const [aiExerciseCached, setAiExerciseCached] = useState(false)
  const [confirmExercise, setConfirmExercise] = useState(false)

  const [aiExample, setAiExample] = useState<any>(null)
  const [aiExampleLoading, setAiExampleLoading] = useState(false)
  const [aiExampleCached, setAiExampleCached] = useState(false)
  const [confirmExample, setConfirmExample] = useState(false)
  const [aiError, setAiError] = useState("")

  // Per-category pagination through multiple AI responses
  const [catEntries, setCatEntries] = useState<Record<string, any[]>>({})
  const [catPage, setCatPage] = useState<Record<string, number>>({})

  // Per-category confirm state for enrich sub-sections
  const [catConfirm, setCatConfirm] = useState<Record<string, boolean>>({})
  const [confirmExplain, setConfirmExplain] = useState(false)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearConfirms = () => {
    setCatConfirm({})
    setConfirmExplain(false)
    setConfirmCaseStudy(false)
    setConfirmExercise(false)
    setConfirmExample(false)
  }

  const startConfirm = (setter: (v: boolean) => void) => {
    setter(true)
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    confirmTimerRef.current = setTimeout(() => setter(false), 5000)
  }

  const goToCatPage = (cat: string, idx: number) => {
    const entries = catEntries[cat]
    if (!entries || idx < 0 || idx >= entries.length) return
    setCatPage((d) => ({ ...d, [cat]: idx }))
    const entry = entries[idx]
    try {
      const parsed = JSON.parse(entry.result)
      if (cat === "explain_further") {
        setAiExplanation(parsed)
      } else if (["why_it_matters_for_ceos", "how_to_apply", "common_pitfalls", "connected_concepts"].includes(cat)) {
        setAiEnrichment((prev: any) => ({ ...prev, ...parsed }))
      } else if (cat === "case_study") {
        setAiCaseStudy(parsed)
      } else if (cat === "test_yourself") {
        setAiExercise(parsed)
      } else if (cat === "real_world_examples") {
        setAiExample(parsed)
      }
    } catch {}
  }

  const handleNewEntry = useCallback((cat: string, id: string, data: any) => {
    if (!data?.result && !data?.real_world_example) return
    const entry = {
      id,
      result: data.result || JSON.stringify({
        real_world_example: data.real_world_example || "",
        ceo_insight: data.ceo_insight || "",
        common_mistake: data.common_mistake || "",
        related_tip: data.related_tip || "",
      }),
      prompt: data.prompt || "",
      created_at: data.created_at,
    }
    setCatEntries((d) => {
      const prev = d[cat] || []
      const exists = prev.some((e: any) => e.id === id)
      if (exists) return d
      const updated = [entry, ...prev].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      return { ...d, [cat]: updated }
    })
  }, [])

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
    const cats = ["explain_further", "why_it_matters_for_ceos", "how_to_apply", "common_pitfalls", "connected_concepts", "case_study", "test_yourself", "real_world_examples"]
    const all = await Promise.all(cats.map((c) => loadCategoryEntries(slug, conceptSlug, c)))
    for (let i = 0; i < cats.length; i++) {
      const entries = all[i]
      if (entries.length === 0) continue
      const cat = cats[i]
      const latest = entries[0]
      setCatEntries((d) => ({ ...d, [cat]: entries }))
      setCatPage((d) => ({ ...d, [cat]: 0 }))
      if (cat === "explain_further") {
        try { setAiExplanation(JSON.parse(latest.result)); setAiCached(true); setAiPromptText(latest.prompt || "") } catch {}
      } else if (["why_it_matters_for_ceos", "how_to_apply", "common_pitfalls", "connected_concepts"].includes(cat)) {
        try { setAiEnrichment((prev: any) => ({ ...prev, ...JSON.parse(latest.result) })); setAiEnrichmentCached(true) } catch {}
      } else if (cat === "case_study") {
        try { setAiCaseStudy(JSON.parse(latest.result)); setAiCaseStudyCached(true) } catch {}
      } else if (cat === "test_yourself") {
        try { setAiExercise(JSON.parse(latest.result)); setAiExerciseCached(true) } catch {}
      } else if (cat === "real_world_examples") {
        try { setAiExample(JSON.parse(latest.result)); setAiExampleCached(true) } catch {}
      }
    }
  }, [slug, conceptSlug])

  useEffect(() => {
    checkConceptCache().catch((err) => console.error("Cache load failed:", err))
    if (slug && result?.concept?.id) markConceptViewed(slug, result.concept.id)
  }, [checkConceptCache, slug, result?.concept?.id])


  // Real-time listeners for new AI responses
  useEffect(() => {
    if (!db || !slug || !conceptSlug) return
    const database = db!
    const cats = ["explain_further", "why_it_matters_for_ceos", "how_to_apply", "common_pitfalls", "connected_concepts", "case_study", "test_yourself", "real_world_examples"]
    const unsubs = cats.map((cat) => {
      const path = `framework/${slug}/${conceptSlug}/${cat}`
      return onChildAdded(ref(database, path), (snap) => {
        handleNewEntry(cat, snap.key || "", snap.val())
      }, (err) => {})
    })
    return () => { unsubs.forEach((u) => u()) }
  }, [slug, conceptSlug, handleNewEntry])

  // Eager prompts per category
  const promptWhy = result ? buildWhyItMattersPrompt(result.concept.name, result.concept.definition, result.framework.title, result.concept.tags) : ""
  const promptHow = result ? buildHowToApplyPrompt(result.concept.name, result.concept.definition, result.framework.title) : ""
  const promptPitfalls = result ? buildCommonPitfallsPrompt(result.concept.name, result.concept.definition, result.framework.title) : ""
  const promptConnected = result ? buildConnectedConceptsPrompt(result.concept.name, result.concept.definition, result.framework.title) : ""
  const promptCaseStudy = result ? buildCaseStudyPrompt(result.concept.name, result.concept.definition, result.framework.title) : ""
  const promptExercise = result ? buildTestYourselfPrompt(result.concept.name, result.concept.definition, result.framework.title) : ""
  const promptExample = result ? buildRealWorldExamplesPrompt(result.concept.name, result.concept.definition, result.framework.title) : ""
  const promptExplain = result ? buildExplainPrompt(result.concept.name, result.concept.definition, result.framework.title) : ""

  if (!result) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-dark-500 dark:text-dark-300">Concept not found</p>
      </div>
    )
  }

  const { framework, concept } = result


  const mkHandler = (generator: Function, setter: Function, setCached: Function, setLoading: Function, setError?: Function, ...args: any[]) => async () => {
    setLoading(true)
    setter(null)
    if (setError) setError("")
    try {
      const { parsed, cached } = await generator(...args)
      setter(parsed)
      setCached(cached)
      clearConfirms()
    } catch (err: any) {
      if (setError) setError(err.message || "Generation failed")
      clearConfirms()
    }
    setLoading(false)
  }

  const handleExplain = mkHandler(explainConcept, (p: any) => { setAiExplanation(p); setAiCached(true); setEditingPrompt(false) }, () => {}, (v: boolean) => setAiLoading(v), (e: string) => setAiError(e), concept.name, concept.definition, slug, framework.title, true)

  const handleWhyItMatters = mkHandler(generateWhyItMatters, (p: any) => setAiEnrichment((prev: any) => ({ ...prev, ...p })), () => setAiEnrichmentCached(true), (v: any) => {}, undefined, concept.name, concept.definition, slug, framework.title, true, concept.tags)
  const handleHowToApply = mkHandler(generateHowToApply, (p: any) => setAiEnrichment((prev: any) => ({ ...prev, ...p })), () => setAiEnrichmentCached(true), (v: any) => {}, undefined, concept.name, concept.definition, slug, framework.title, true)
  const handleCommonPitfalls = mkHandler(generateCommonPitfalls, (p: any) => setAiEnrichment((prev: any) => ({ ...prev, ...p })), () => setAiEnrichmentCached(true), (v: any) => {}, undefined, concept.name, concept.definition, slug, framework.title, true)
  const handleConnectedConcepts = mkHandler(generateConnectedConcepts, (p: any) => setAiEnrichment((prev: any) => ({ ...prev, ...p })), () => setAiEnrichmentCached(true), (v: any) => {}, undefined, concept.name, concept.definition, slug, framework.title, true)
  const handleCaseStudy = mkHandler(generateCaseStudy, setAiCaseStudy, () => setAiCaseStudyCached(true), (v: boolean) => setAiCaseStudyLoading(v), undefined, concept.name, concept.definition, slug, framework.title, true)
  const handleExercise = mkHandler(generateTestYourself, setAiExercise, () => setAiExerciseCached(true), (v: boolean) => setAiExerciseLoading(v), undefined, concept.name, concept.definition, slug, framework.title, true)
  const handleExample = mkHandler(generateRealWorldExamples, setAiExample, () => setAiExampleCached(true), (v: boolean) => setAiExampleLoading(v), undefined, concept.name, concept.definition, slug, framework.title, true)

  const handleSavePrompt = async () => {
    if (!db || !editPromptValue.trim()) return
    setSavingPrompt(true)
    try {
      const cachePath = `framework/${slug}/${conceptSlug}/explain_further`
      const snap = await get(ref(db, cachePath))
      if (snap.exists()) {
        const entries = snap.val()
        const ids = Object.keys(entries)
        if (ids.length > 0) {
          await set(ref(db, `${cachePath}/${ids[ids.length - 1]}/prompt`), editPromptValue.trim())
          setAiPromptText(editPromptValue.trim())
        }
      }
    } catch (err) {
      console.error(err)
    }
    setEditingPrompt(false)
    setSavingPrompt(false)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      {!frameworksReady && <div className="py-16"><SkeletonCard lines={4} /></div>}
      {(pageError || !result) && frameworksReady && (
        <p className="text-red-600 dark:text-red-400">Concept not found: {pageError || "Check that Firebase is configured and frameworks are seeded to RTDB"}</p>
      )}
      {result && frameworksReady && (<>

      <ConceptHeader framework={framework} concept={concept} frameworkSlug={slug} conceptSlug={conceptSlug} />

      {/* ── Enriched sections ── */}

      {(aiEnrichment?.why_it_matters || concept.why_it_matters) && (
        <div className="mb-4 rounded-lg border border-primary-200 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/10 p-4">
          <div className="flex items-center mb-2">
            <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide">Why It Matters for CEOs</p>
            <div className="flex items-center gap-1.5 ml-auto">
            <CatPageNav cat="why_it_matters_for_ceos" catEntries={catEntries} catPage={catPage} goToCatPage={goToCatPage} />
             <PromptTooltip prompt={promptWhy}>prompt</PromptTooltip>
            <SparkleBtn loading={false} confirm={!!catConfirm["why"]}
              onSparkle={() => startConfirm((v) => setCatConfirm((d) => ({ ...d, why: v })))}
              onConfirm={() => { setCatConfirm((d) => ({ ...d, why: false })); handleWhyItMatters() }}
              onCancel={() => setCatConfirm((d) => ({ ...d, why: false }))} />
            </div>
          </div>
          <p className="text-sm text-dark-700 dark:text-dark-300 leading-relaxed">{aiEnrichment?.why_it_matters || concept.why_it_matters}</p>
        </div>
      )}

      {((aiEnrichment?.steps?.length) || (concept.steps && concept.steps.length > 0)) && (
        <div className="mb-4">
          <div className="flex items-center mb-3">
            <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide">How to Apply</p>
            <div className="flex items-center gap-1.5 ml-auto">
            <CatPageNav cat="how_to_apply" catEntries={catEntries} catPage={catPage} goToCatPage={goToCatPage} />
             <PromptTooltip prompt={promptHow}>prompt</PromptTooltip>
            <SparkleBtn loading={false} confirm={!!catConfirm["how"]}
              onSparkle={() => startConfirm((v) => setCatConfirm((d) => ({ ...d, how: v })))}
              onConfirm={() => { setCatConfirm((d) => ({ ...d, how: false })); handleHowToApply() }}
               onCancel={() => setCatConfirm((d) => ({ ...d, how: false }))} />
            </div>
          </div>
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
          <div className="flex items-center mb-3">
            <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide">Common Pitfalls</p>
            <div className="flex items-center gap-1.5 ml-auto">
            <CatPageNav cat="common_pitfalls" catEntries={catEntries} catPage={catPage} goToCatPage={goToCatPage} />
             <PromptTooltip prompt={promptPitfalls}>prompt</PromptTooltip>
            <SparkleBtn loading={false} confirm={!!catConfirm["pitfalls"]}
              onSparkle={() => startConfirm((v) => setCatConfirm((d) => ({ ...d, pitfalls: v })))}
              onConfirm={() => { setCatConfirm((d) => ({ ...d, pitfalls: false })); handleCommonPitfalls() }}
               onCancel={() => setCatConfirm((d) => ({ ...d, pitfalls: false }))} />
            </div>
          </div>
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
          <div className="flex items-center mb-3">
            <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide">Connected Concepts</p>
            <div className="flex items-center gap-1.5 ml-auto">
            <CatPageNav cat="connected_concepts" catEntries={catEntries} catPage={catPage} goToCatPage={goToCatPage} />
             <PromptTooltip prompt={promptConnected}>prompt</PromptTooltip>
            <SparkleBtn loading={false} confirm={!!catConfirm["connected"]}
              onSparkle={() => startConfirm((v) => setCatConfirm((d) => ({ ...d, connected: v })))}
              onConfirm={() => { setCatConfirm((d) => ({ ...d, connected: false })); handleConnectedConcepts() }}
               onCancel={() => setCatConfirm((d) => ({ ...d, connected: false }))} />
            </div>
          </div>
          <div className="space-y-1.5">{(aiEnrichment?.related_concepts || concept.related_concepts).map((rc: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-primary-500 mt-0.5">&#8594;</span>
              <div><span className="font-medium text-dark-800 dark:text-dark-200">{rc.name}</span><span className="text-dark-500 dark:text-dark-400"> &mdash; {rc.relationship}</span></div>
            </div>
          ))}</div>
        </div>
      )}

      {(aiCaseStudy || concept.case_study) && (
        <div className="mb-4 rounded-lg border border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800/50 p-4">
          <div className="flex items-center mb-3">
            <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide">Case Study: {(aiCaseStudy || concept.case_study).company}</p>
            <div className="flex items-center gap-1.5 ml-auto">
            <CatPageNav cat="case_study" catEntries={catEntries} catPage={catPage} goToCatPage={goToCatPage} />
             <PromptTooltip prompt={promptCaseStudy}>prompt</PromptTooltip>
            <SparkleBtn loading={aiCaseStudyLoading} confirm={!!confirmCaseStudy}
              onSparkle={() => startConfirm(setConfirmCaseStudy)}
              onConfirm={() => { setConfirmCaseStudy(false); handleCaseStudy() }}
               onCancel={() => setConfirmCaseStudy(false)} />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div><p className="font-medium text-dark-700 dark:text-dark-300">Situation</p><p className="text-dark-600 dark:text-dark-400">{(aiCaseStudy || concept.case_study).situation}</p></div>
            <div><p className="font-medium text-dark-700 dark:text-dark-300">Application</p><p className="text-dark-600 dark:text-dark-400">{(aiCaseStudy || concept.case_study).application}</p></div>
            <div><p className="font-medium text-dark-700 dark:text-dark-300">Result</p><p className="text-dark-600 dark:text-dark-400">{(aiCaseStudy || concept.case_study).result}</p></div>
          </div>
        </div>
      )}

      {(aiExercise || concept.exercise) && (
        <div className="mb-4 rounded-lg border border-primary-200 dark:border-primary-800/40 bg-primary-50/30 dark:bg-primary-900/10 p-4">
          <div className="flex items-center mb-3">
            <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide">Test Yourself</p>
            <div className="flex items-center gap-1.5 ml-auto">
            <CatPageNav cat="test_yourself" catEntries={catEntries} catPage={catPage} goToCatPage={goToCatPage} />
             <PromptTooltip prompt={promptExercise}>prompt</PromptTooltip>
            <SparkleBtn loading={aiExerciseLoading} confirm={!!confirmExercise}
              onSparkle={() => startConfirm(setConfirmExercise)}
              onConfirm={() => { setConfirmExercise(false); handleExercise() }}
               onCancel={() => setConfirmExercise(false)} />
            </div>
          </div>
          <p className="text-sm text-dark-700 dark:text-dark-300 mb-3 leading-relaxed">{(aiExercise || concept.exercise).scenario}</p>
          <div className="space-y-1.5 mb-3">{(aiExercise || concept.exercise).options.map((opt: string, i: number) => {
            const feedbackId = `exercise-feedback-${concept.name.replace(/\s+/g, '-')}`
            const explainId = `exercise-explain-${concept.name.replace(/\s+/g, '-')}`
            return (
            <button key={i} onClick={() => {
              const el = document.getElementById(feedbackId)
              const expl = document.getElementById(explainId)
              if (el) {
                const c = i === (aiExercise || concept.exercise).correct
                el.innerHTML = c ? '<span class="text-green-600 dark:text-green-400 font-medium">&#10003; Correct!</span>' : '<span class="text-red-600 dark:text-red-400 font-medium">&#10007; Not quite.</span>'
                el.className = `mt-2 text-xs ${c ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`
              }
              if (expl) {
                const ex = (aiExercise || concept.exercise).explanation
                expl.innerHTML = ex ? `${ex}` : ''
                expl.className = 'mt-2 text-xs text-dark-600 dark:text-dark-400 leading-relaxed bg-primary-50 dark:bg-primary-900/10 rounded-lg p-3 border-l-2 border-primary-400'
              }
            }}
              className="w-full text-left rounded-lg border border-dark-200 dark:border-dark-700 px-3 py-2 text-xs text-dark-600 dark:text-dark-400 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition"
            >{String.fromCharCode(65 + i)}. {opt}</button>
            )
          })}</div>
          <div id={`exercise-feedback-${concept.name.replace(/\s+/g, '-')}`} className="text-xs"></div>
          <div id={`exercise-explain-${concept.name.replace(/\s+/g, '-')}`} className="text-xs"></div>
        </div>
      )}

      {(aiExample || concept.example) && (
        <div className="mb-4">
          <div className="flex items-center mb-3">
            <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide dark:text-dark-300">Real-World Examples</p>
            <div className="flex items-center gap-1.5 ml-auto">
            <CatPageNav cat="real_world_examples" catEntries={catEntries} catPage={catPage} goToCatPage={goToCatPage} />
             <PromptTooltip prompt={promptExample}>prompt</PromptTooltip>
            <SparkleBtn loading={aiExampleLoading} confirm={!!confirmExample}
              onSparkle={() => startConfirm(setConfirmExample)}
              onConfirm={() => { setConfirmExample(false); handleExample() }}
               onCancel={() => setConfirmExample(false)} />
            </div>
          </div>
          <ul className="space-y-3">{(aiExample?.examples?.length ? aiExample.examples : (concept.example || "").split(" | ")).map((ex: string, i: number) => (
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
          {aiError && (
          <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-2 text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
            <span>{aiError}</span>
            <button onClick={handleExplain}
              className="ml-3 shrink-0 rounded bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition"
            >Retry</button>
          </div>
        )}
        <div className="flex items-center mb-1">
          <p className="text-xs font-semibold text-dark-400 dark:text-dark-400 uppercase tracking-wide">Explain Further</p>
          <div className="flex items-center gap-1.5 ml-auto">
          <CatPageNav cat="explain_further" catEntries={catEntries} catPage={catPage} goToCatPage={goToCatPage} />
           <PromptTooltip prompt={aiPromptText || promptExplain}>prompt</PromptTooltip>
          <SparkleBtn loading={aiLoading} confirm={!!confirmExplain}
            onSparkle={() => startConfirm(setConfirmExplain)}
            onConfirm={() => { setConfirmExplain(false); handleExplain() }}
             onCancel={() => setConfirmExplain(false)} />
          {isAdmin && aiPromptText && !editingPrompt && (
            <button onClick={() => { setEditPromptValue(aiPromptText); setEditingPrompt(true) }}
              className="text-[10px] text-primary-500 hover:text-primary-600 transition"
            >Edit</button>
          )}
          </div>
        </div>

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
        </div>

        {(() => {
          const entries = catEntries["explain_further"] || []
          if (entries.length === 0) return null
          const idx = catPage["explain_further"] || 0
          const entry = entries[idx]
          if (!entry?.result) return null
          let data: Record<string, string> = {}
          try { data = JSON.parse(entry.result) } catch { return null }
          const cards = [
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
          ].filter((c) => data[c.key])
          if (cards.length === 0) return null
          return (
            <div className="mt-4 mb-4 space-y-3 animate-slide-up">
              {cards.map((c) => (
                <div key={c.key} className={`rounded-xl border-l-4 ${c.cls} p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${c.iconCls}`}>{c.icon}</span>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${c.labelCls}`}>{c.label}</span>
                  </div>
                  <p className="text-sm text-dark-700 dark:text-dark-300 leading-relaxed">{data[c.key]}</p>
                </div>
              ))}
            </div>
          )
        })()}

        {/* ── Concept Comparison ── */}
        <ConceptComparePanel framework={framework} concept={concept} frameworkSlug={slug} conceptSlug={conceptSlug} />

        <SpacedReviewBar
          frameworkSlug={slug}
          conceptId={concept.id}
          conceptName={concept.name}
          conceptSlug={conceptSlug}
          onError={(msg) => setAiError(msg)}
        />

        <LearningToolsPanel framework={framework} concept={concept} frameworkSlug={slug} conceptSlug={conceptSlug} />
      </>)}
    </div>
  )
}
