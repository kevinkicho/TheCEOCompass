import slugs from "@/data/slugs.json"

export function generateStaticParams() {
  return slugs.scenarios.map((slug) => ({ slug }))
}

export default function ScenarioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}