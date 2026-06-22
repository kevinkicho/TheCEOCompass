"use client"

import { useState, useEffect, useRef } from "react"

export function PromptTooltip({ children, prompt }: { children: React.ReactNode; prompt: string }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!visible || !ref.current) return
    const el = ref.current.nextElementSibling as HTMLElement | null
    if (!el) return
    const handleClickOutside = (e: MouseEvent) => {
      if (!el.contains(e.target as Node) && !ref.current?.contains(e.target as Node)) {
        setVisible(false)
      }
    }
    setTimeout(() => document.addEventListener("click", handleClickOutside), 0)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [visible])

  return (
    <span className="relative inline-flex">
      <span ref={ref} onClick={() => setVisible(!visible)}
        className="text-[10px] text-dark-400/50 dark:text-dark-500/50 hover:text-dark-400 dark:hover:text-dark-400 cursor-pointer transition"
      >{children}</span>
      {visible && (
        <pre className="absolute z-50 mt-5 left-0 rounded-lg bg-dark-800 p-3 text-[10px] text-green-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto shadow-xl border border-dark-700 min-w-[280px]"
        >{prompt}</pre>
      )}
    </span>
  )
}
