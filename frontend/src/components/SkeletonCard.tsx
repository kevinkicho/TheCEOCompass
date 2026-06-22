export function SkeletonCard({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl border border-dark-200 dark:border-dark-700 p-6 ${className}`}>
      <div className="h-4 w-2/3 rounded bg-dark-100 dark:bg-dark-800 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-3 rounded bg-dark-100 dark:bg-dark-800 mb-2 ${i === lines - 1 ? "w-1/2" : ""}`} />
      ))}
    </div>
  )
}
