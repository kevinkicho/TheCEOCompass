"use client"

export function SparkleBtn({ loading, confirm, onSparkle, onConfirm, onCancel }: {
  loading: boolean; confirm: boolean;
  onSparkle: () => void; onConfirm: () => void; onCancel: () => void;
}) {
  if (loading) return (
    <svg className="animate-spin h-3.5 w-3.5 text-dark-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
  if (confirm) return (
    <span className="inline-flex items-center gap-1">
      <button onClick={onConfirm}
        className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition animate-pulse"
      >Regenerate?</button>
      <button onClick={onCancel}
        className="text-[10px] text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition"
      >&times;</button>
    </span>
  )
  return (
    <button onClick={onSparkle}
      className="inline-flex items-center justify-center rounded-full p-0.5 text-dark-400/60 hover:text-dark-600 dark:hover:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-800 transition"
      title="Generate with AI"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/>
        <path d="M18 14l1 2.5L21.5 18l-2.5 1-1 2.5-1-2.5L14.5 18l2.5-1z"/>
      </svg>
    </button>
  )
}
