"use client"

import { db } from "@/lib/firebase"
import { runDecisionSimulator } from "@/lib/ollama"
import { isStaticHosting, StaticHostingBanner } from "@/components/RequiresBackend"
import { ChatPanel } from "@/components/ChatPanel"

export default function SimulatorPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-dark-100">Decision Simulator</h1>
        <p className="mt-2 text-dark-500 dark:text-dark-400">
          Describe a real business challenge. AI identifies relevant frameworks, runs diagnostic questions, and produces a structured action memo.
        </p>
      </div>

      {isStaticHosting ? (
        <StaticHostingBanner
          feature="Decision Simulator"
          description="Describes a business challenge and returns framework-driven analysis and action plan"
        />
      ) : (
        <ChatPanel
          title="Decision Simulator"
          subtitle="Describe your challenge — get framework-driven analysis"
          storageKey="simulator:default"
          sendMessage={async (messages, userMessage) => {
            const allMessages = [...messages, { role: "user" as const, content: userMessage }]
              .map(m => ({ role: m.role, content: m.content }))
            return await runDecisionSimulator(userMessage, allMessages)
          }}
          disabled={!db}
          placeholder="Describe your business challenge (e.g. 'We're losing market share to a free-tier competitor and I need a strategy to respond')..."
        />
      )}
    </div>
  )
}
