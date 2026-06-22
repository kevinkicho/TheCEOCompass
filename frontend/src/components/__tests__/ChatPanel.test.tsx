import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ChatPanel } from "../ChatPanel"

const mockSendMessage = vi.fn().mockResolvedValue("assistant response")

describe("ChatPanel", () => {
  it("renders title and subtitle", () => {
    render(
      <ChatPanel
        title="Concept Tutor"
        subtitle="Ask anything"
        storageKey="test:key"
        sendMessage={mockSendMessage}
      />,
    )
    expect(screen.getByText("Concept Tutor")).toBeInTheDocument()
    expect(screen.getByText("Ask anything")).toBeInTheDocument()
  })

  it("renders placeholder text in input", () => {
    render(
      <ChatPanel
        title="Test"
        storageKey="test:key"
        sendMessage={mockSendMessage}
        placeholder="Type your question..."
      />,
    )
    expect(screen.getByPlaceholderText("Type your question...")).toBeInTheDocument()
  })

  it("shows empty state message when no messages", () => {
    render(
      <ChatPanel
        title="Test"
        storageKey="test:key"
        sendMessage={mockSendMessage}
      />,
    )
    expect(screen.getByText(/Ask a follow-up question/)).toBeInTheDocument()
  })

  it("shows empty state message when disabled", () => {
    render(
      <ChatPanel
        title="Test"
        storageKey="test:key"
        sendMessage={mockSendMessage}
        disabled={true}
      />,
    )
    expect(screen.getByText(/GitHub Pages/)).toBeInTheDocument()
  })

  it("renders without crashing with minimal props", () => {
    render(
      <ChatPanel
        title="Minimal"
        storageKey="test:minimal"
        sendMessage={mockSendMessage}
      />,
    )
    expect(screen.getByText("Minimal")).toBeInTheDocument()
  })

  it("Clear button is hidden when no messages", () => {
    render(
      <ChatPanel
        title="Test"
        storageKey="test:key"
        sendMessage={mockSendMessage}
      />,
    )
    expect(screen.queryByText("Clear")).not.toBeInTheDocument()
  })
})
