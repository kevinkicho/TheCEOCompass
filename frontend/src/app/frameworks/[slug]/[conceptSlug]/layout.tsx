import type { Metadata } from "next"
import frameworkMeta from "@/data/framework-meta.json"

export function generateStaticParams() {
  const params: { slug: string; conceptSlug: string }[] = []
  for (const fw of frameworkMeta as any[]) {
    for (const c of fw.concepts || []) {
      params.push({ slug: fw.slug, conceptSlug: c.slug })
    }
  }
  return params
}

export function generateMetadata({ params }: { params: { slug: string; conceptSlug: string } }): Metadata {
  const fw = (frameworkMeta as any[]).find((f: any) => f.slug === params.slug)
  if (!fw) return { title: "Concept - CEO Compass" }
  const concept = fw.concepts?.find((c: any) => c.slug === params.conceptSlug)
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
