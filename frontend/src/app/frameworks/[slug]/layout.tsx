import slugs from "@/data/slugs.json"
import { ConceptSidebar } from "@/components/ConceptSidebar"

export function generateStaticParams() {
  return (slugs as any).frameworks.map((slug: string) => ({ slug }))
}

export default function FrameworkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <ConceptSidebar />
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
