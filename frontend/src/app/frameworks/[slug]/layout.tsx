import slugs from "@/data/slugs.json"

export function generateStaticParams() {
  return (slugs as any).frameworks.map((slug: string) => ({ slug }))
}

export default function FrameworkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
