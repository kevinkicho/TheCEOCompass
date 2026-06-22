"use client"

interface PastAttempt {
  attemptId: string
  stages: { stageId: string; choice: string; score: number }[]
  completed_at: string
}

export function ScenarioPastAttempts({ pastAttempts }: { pastAttempts: PastAttempt[] }) {
  if (pastAttempts.length === 0) return null
  return (
    <div className="mt-8">
      <h3 className="mb-3 text-sm font-semibold text-dark-500 dark:text-dark-400 uppercase tracking-wide">Past Attempts ({pastAttempts.length})</h3>
      <div className="space-y-2">
        {pastAttempts.map((a) => (
          <div key={a.attemptId} className="rounded-lg border border-dark-200 dark:border-dark-700 p-3">
            <p className="text-xs text-dark-500 dark:text-dark-400">
              {new Date(a.completed_at).toLocaleDateString()} &middot; {a.stages.length} stages
            </p>
            <p className="text-xs text-dark-400 dark:text-dark-500 mt-1">
              {a.stages.map((s) => `${s.stageId}: ${Math.round(s.score * 10)}%`).join(" → ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
