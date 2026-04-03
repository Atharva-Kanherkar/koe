"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { FeedbackEntry } from "@/lib/store"

export default function Dashboard() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch("/api/feedback")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function copyLink() {
    const url = `${window.location.origin}/chat`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-6 py-12">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          koe
        </h1>
        <p className="text-zinc-600 text-sm mt-1">feedback, distilled</p>
      </div>

      <div
        className="mt-10 p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/30 animate-fade-up"
        style={{ animationDelay: "100ms" }}
      >
        <p className="text-xs text-zinc-500 mb-3">
          Share this with your manager
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="text-sm text-violet-400 hover:text-violet-300 transition-colors truncate flex-1"
          >
            /chat
          </Link>
          <button
            onClick={copyLink}
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors shrink-0"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>

      <div className="mt-12">
        <h2
          className="text-[11px] text-zinc-600 uppercase tracking-widest mb-4 animate-fade-up"
          style={{ animationDelay: "200ms" }}
        >
          Responses
        </h2>

        {loading ? (
          <p className="text-zinc-700 text-sm">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-zinc-700 text-sm py-8 text-center">
            No feedback yet.
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, i) => (
              <details
                key={entry.id}
                className="group rounded-xl border border-zinc-800/40 bg-zinc-900/20 animate-fade-up"
                style={{ animationDelay: `${(i + 3) * 80}ms` }}
              >
                <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-sm hover:bg-zinc-900/40 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-300">
                      {entry.managerName || "Anonymous"}-san
                    </span>
                    <span className="text-zinc-700 text-xs">
                      {new Date(entry.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <span className="text-zinc-700 text-xs group-open:rotate-90 transition-transform">
                    &rsaquo;
                  </span>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  {entry.summary && (
                    <p className="text-sm text-zinc-400 border-l-2 border-violet-500/30 pl-3">
                      {entry.summary}
                    </p>
                  )}
                  <div className="space-y-2 pt-2">
                    {entry.messages
                      .filter((m) => m.role !== "system")
                      .map((msg, j) => (
                        <p
                          key={j}
                          className={`text-xs ${msg.role === "assistant" ? "text-zinc-600" : "text-zinc-400"}`}
                        >
                          <span className="text-zinc-700 mr-1">
                            {msg.role === "assistant" ? "Q:" : "A:"}
                          </span>
                          {msg.content}
                        </p>
                      ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
