import type { Metadata } from "next"
import frameworkMeta from "@/data/framework-meta.json"
import slugs from "@/data/slugs.json"

export function generateStaticParams() {
  return (slugs as any).frameworks.map((slug: string) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const fw = (frameworkMeta as any[]).find((f: any) => f.slug === params.slug)
  if (!fw) return { title: "Framework - CEO Compass" }
  return {
    title: `${fw.title} - CEO Compass`,
    description: `${fw.title}: leadership framework for CEOs`,
    openGraph: {
      title: `${fw.title} - CEO Compass`,
      description: `${fw.title}: leadership framework for CEOs`,
    },
  }
}

export default function FrameworkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
