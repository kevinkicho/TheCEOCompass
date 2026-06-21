import { loadJournalEntries } from "./firebase-crud"
import type { JournalEntry } from "./types"

export interface CalibrationBucket {
  label: string
  range: string
  count: number
  rightCount: number
  accuracy: number
}

export interface CalibrationResult {
  buckets: CalibrationBucket[]
  overall: number
  entriesUsed: number
}

export async function computeCalibration(): Promise<CalibrationResult> {
  const entries = await loadJournalEntries()
  const withOutcome = entries.filter(
    (e) => e.outcome_captured && e.outcomes && e.outcomes.length > 0
  )

  const buckets: { min: number; max: number; label: string; range: string }[] = [
    { min: 1, max: 3, label: "Low (1-3)", range: "1-3" },
    { min: 4, max: 6, label: "Medium (4-6)", range: "4-6" },
    { min: 7, max: 8, label: "High (7-8)", range: "7-8" },
    { min: 9, max: 10, label: "Very High (9-10)", range: "9-10" },
  ]

  const result: CalibrationBucket[] = buckets.map((b) => {
    const inBucket = withOutcome.filter((e) => e.confidence >= b.min && e.confidence <= b.max)
    const right = inBucket.filter((e) => e.outcomes![0].was_right === "yes").length
    return {
      label: b.label,
      range: b.range,
      count: inBucket.length,
      rightCount: right,
      accuracy: inBucket.length > 0 ? Math.round((right / inBucket.length) * 100) : 0,
    }
  })

  const totalRight = result.reduce((s, b) => s + b.rightCount, 0)
  const total = result.reduce((s, b) => s + b.count, 0)

  return {
    buckets: result,
    overall: total > 0 ? Math.round((totalRight / total) * 100) : 0,
    entriesUsed: total,
  }
}

export function getCalibrationAdvice(overall: number, buckets: CalibrationBucket[]): string {
  const last = buckets[buckets.length - 1]
  if (overall > 80 && last.accuracy >= 80) return "Well-calibrated. Your confidence matches your accuracy."
  if (last.count > 0 && last.accuracy < 50) return "Overconfident in high-confidence decisions. Consider more rigorous validation before rating 9-10."
  if (buckets[0].accuracy > 60 && buckets[0].count > 0) return "Underconfident — your low-confidence choices fare better than expected. Trust your judgment more."
  if (overall < 50) return "Significant miscalibration. Review past outcomes and look for recurring biases."
  return "Review the gaps between confidence and accuracy to refine your judgment."
}
