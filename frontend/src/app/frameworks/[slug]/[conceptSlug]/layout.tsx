import slugs from "@/data/slugs.json"

export function generateStaticParams() {
  const params: { slug: string; conceptSlug: string }[] = []
  for (const fw of (slugs as any).frameworks as string[]) {
    const concepts = (slugs as any).concepts?.[fw] as string[] | undefined
    if (concepts) {
      for (const cs of concepts) {
        params.push({ slug: fw, conceptSlug: cs })
      }
    }
  }
  return params
}

export default function ConceptLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
