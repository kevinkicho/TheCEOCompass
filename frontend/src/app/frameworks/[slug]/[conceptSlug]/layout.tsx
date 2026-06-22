import type { Metadata } from "next"
import { staticFrameworks } from "@/lib/staticData"
import { slugify } from "@/lib/ollama"

export function generateStaticParams() {
  const params: { slug: string; conceptSlug: string }[] = []
  for (const fw of staticFrameworks as any[]) {
    for (const c of fw.concepts || []) {
      params.push({ slug: fw.slug, conceptSlug: slugify(c.name) })
    }
  }
  return params
}

export function generateMetadata({ params }: { params: { slug: string; conceptSlug: string } }): Metadata {
  const fw = (staticFrameworks as any[]).find((f: any) => f.slug === params.slug)
  if (!fw) return { title: "Concept - CEO Compass" }
  const concept = fw.concepts?.find((c: any) => slugify(c.name) === params.conceptSlug)
  if (!concept) return { title: `${fw.title} - CEO Compass` }
  return {
    title: `${concept.name} - ${fw.title} - CEO Compass`,
    description: concept.definition || `${concept.name} concept in ${fw.title}`,
    openGraph: {
      title: `${concept.name} - ${fw.title} - CEO Compass`,
      description: concept.definition,
    },
  }
}

export default function ConceptLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
