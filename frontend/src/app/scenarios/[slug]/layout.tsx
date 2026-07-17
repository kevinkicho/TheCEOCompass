import scenarios from "@/data/scenarios.json"

/** SSG params derived from full scenarios catalog (not a stale slug list). */
export function generateStaticParams() {
  return (scenarios as Array<{ slug?: string }>)
    .map((s) => s.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0)
    .map((slug) => ({ slug }))
}

export default function ScenarioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
