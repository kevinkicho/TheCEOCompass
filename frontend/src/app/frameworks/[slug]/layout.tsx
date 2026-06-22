import type { Metadata } from "next"
import slugs from "@/data/slugs.json"
import { staticFrameworks } from "@/lib/staticData"

export function generateStaticParams() {
  return (slugs as any).frameworks.map((slug: string) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const fw = (staticFrameworks as any[]).find((f: any) => f.slug === params.slug)
  if (!fw) return { title: "Framework - CEO Compass" }
  return {
    title: `${fw.title} - CEO Compass`,
    description: fw.description || `${fw.title}: ${fw.category} framework for CEOs`,
    openGraph: {
      title: `${fw.title} - CEO Compass`,
      description: fw.description,
    },
  }
}

export default function FrameworkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
