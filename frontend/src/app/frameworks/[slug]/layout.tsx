import slugs from "@/data/slugs.json"

export function generateStaticParams() {
  return slugs.frameworks.map((slug) => ({ slug }))
}

export default function FrameworkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}