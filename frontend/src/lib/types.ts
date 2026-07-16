export interface FrameworkListItem {
  id: string
  slug: string
  title: string
  description: string
  category: string
  difficulty: number
  estimated_time_minutes: number
}

export interface ConceptStep {
  title: string
  description: string
}

export interface ConceptPitfall {
  title: string
  description: string
}

export interface RelatedConcept {
  name: string
  relationship: string
}

export interface CaseStudy {
  company: string
  situation: string
  application: string
  result: string
}

export interface ConceptExercise {
  scenario: string
  options: string[]
  correct: number
  explanation: string
}

export interface FrameworkConcept {
  id: string
  name: string
  definition: string
  formula?: string
  example?: string
  tags: string[]
  order_index?: number
  why_it_matters?: string
  steps?: ConceptStep[]
  pitfalls?: ConceptPitfall[]
  related_concepts?: RelatedConcept[]
  case_study?: CaseStudy
  exercise?: ConceptExercise
}

export interface Framework extends FrameworkListItem {
  key_concepts: string[]
  use_cases: string[]
  content: string
  slug: string
  concepts: FrameworkConcept[]
}

export interface ScenarioListItem {
  id: string
  slug: string
  title: string
  description: string
  framework_id: string
  difficulty: number
  /** Optional scenario pack for filtering / grouping */
  pack_id?: string
  pack_title?: string
  concept_ids?: string[]
  framework_slugs?: string[]
}

export interface ScenarioOption {
  id: string
  label: string
  score: number
  rationale: string
}

export interface ScenarioStage {
  id: string
  type: "diagnosis" | "analysis" | "decision" | "communication" | "outcome"
  prompt: string
  options: ScenarioOption[]
  /** Omitted on multiple-choice stages (treated as false). */
  free_response?: boolean
  feedback_prompt_template: string
  sample_answer?: string
}

export interface ScenarioContext {
  company: string
  situation: string
  time_pressure: string
  data_provided: string[]
}

export interface OutcomeBranch {
  title: string
  description: string
}

export interface Scenario {
  id: string
  slug: string
  title: string
  description: string
  framework_id: string
  difficulty: number
  /** Optional scenario pack for filtering / grouping */
  pack_id?: string
  pack_title?: string
  /** Related concept slugs for SM-2 / mastery linking */
  concept_ids?: string[]
  /** Related framework slugs for browse / pathway linking */
  framework_slugs?: string[]
  context: ScenarioContext
  stages: ScenarioStage[]
  outcome_branches: Record<string, OutcomeBranch>
}

export interface ScenarioAttempt {
  id: string
  user_id: string
  scenario_id: string
  current_stage_id: string
  choices_made: Record<string, { choice_id?: string; free_response?: string }>
  score: number | null
  outcome_branch: string | null
  completed_at: string | null
}

export interface FeedbackResponse {
  feedback: string
  score: number
  next_framework_suggestion?: string
  key_insights: string[]
}

export interface StageResult {
  next_stage_id?: string
  feedback?: FeedbackResponse
  is_complete: boolean
  outcome_branch?: string
  final_score?: number
}

export interface JournalEntry {
  id: string
  user_id: string
  title: string
  context: string
  decision: string
  alternatives_considered: Array<{ name: string; description: string }>
  rationale: string
  key_assumptions: Array<{ assumption: string; test: string }>
  success_metrics: Array<{ metric: string; target: string }>
  confidence: number
  review_date: string
  outcome_captured: boolean
  scenario_id?: string
  created_at: string
  outcomes?: JournalOutcome[]
}

export interface JournalOutcome {
  id: string
  what_happened: string
  was_right: string
  metrics_actual: Array<{ metric: string; value: string }>
  what_missed: string
  what_got_right: string
  updated_confidence: number
  lesson: string
}

export interface Progress {
  user_id: string
  scenarios_completed: number
  scenarios_in_progress: number
  total_scenario_score: number
  average_scenario_score: number
  framework_mastery: Record<string, number>
  current_streak_days: number
  longest_streak_days: number
  current_module_id: string | null
  modules_completed: string[]
}

export interface QuoteEntry {
  id: string
  person: string
  role: string
  text: string
  context?: string
  source?: string
  year?: string
  category: string
  tags?: string[]
  generated?: boolean
  rtdbId?: string
}

export interface CalibrationSummary {
  total_predictions: number
  average_confidence: number
  accuracy: number
  average_brier_score: number
  calibration_by_confidence: Record<string, { count: number; accuracy: number; avg_confidence: number }>
  trend: Array<{ month: string; accuracy: number }>
}