"use client"

import { useState, useRef, useEffect } from "react"

interface Message {
  role: "assistant" | "user"
  content: string
}

export default function Chat() {
  const [lang, setLang] = useState<"en" | "ja" | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [searching, setSearching] = useState(false)
  const [done, setDone] = useState(false)
  const [saved, setSaved] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function chooseLang(l: "en" | "ja") {
    setLang(l)
    streamResponse([], l)
  }

  async function streamResponse(history: Message[], overrideLang?: string) {
    setStreaming(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, lang: overrideLang || lang }),
      })
      if (!res.body) return

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ""
      let buffer = ""

      setMessages((prev) => [...prev, { role: "assistant", content: "" }])

      for (;;) {
        const { done: readerDone, value } = await reader.read()
        if (readerDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data: ")) continue
          const payload = trimmed.slice(6)
          if (payload === "[DONE]") continue
          try {
            const parsed = JSON.parse(payload)
            if (parsed.status === "searching") {
              setSearching(true)
              continue
            }
            if (parsed.text) {
              setSearching(false)
              full += parsed.text
              const display = full.replace(/\[COMPLETE\]/g, "").trim()
              setMessages((prev) => {
                const next = [...prev]
                next[next.length - 1] = { role: "assistant", content: display }
                return next
              })
            }
          } catch {
            // partial chunk
          }
        }
      }

      if (full.includes("[COMPLETE]")) {
        setDone(true)
        const allMessages: Message[] = [
          ...history,
          {
            role: "assistant",
            content: full.replace(/\[COMPLETE\]/g, "").trim(),
          },
        ]
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: allMessages }),
        })
        setSaved(true)
      }
    } catch (err) {
      console.error("Stream error:", err)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please refresh and try again.",
        },
      ])
    }
    setStreaming(false)
  }

  function send() {
    const text = input.trim()
    if (!text || streaming || done) return
    setInput("")
    const userMsg: Message = { role: "user", content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    streamResponse(updated)
  }

  if (!lang) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-up">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent mb-2">
            koe
          </h1>
          <p className="text-zinc-600 text-xs mb-10">
            Choose your language / 言語を選択
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => chooseLang("en")}
              className="px-6 py-3 rounded-xl border border-zinc-800/60 bg-zinc-900/30 text-sm text-zinc-300 hover:border-violet-500/40 hover:bg-zinc-900/60 transition-all"
            >
              English
            </button>
            <button
              onClick={() => chooseLang("ja")}
              className="px-6 py-3 rounded-xl border border-zinc-800/60 bg-zinc-900/30 text-sm text-zinc-300 hover:border-violet-500/40 hover:bg-zinc-900/60 transition-all"
            >
              日本語
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col max-w-xl mx-auto">
      <div className="px-6 py-5 border-b border-zinc-800/30 flex items-center justify-between">
        <h1 className="text-lg font-semibold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          koe
        </h1>
        <span className="text-[11px] text-zinc-700">
          {lang === "ja" ? "日本語" : "English"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`animate-fade-up ${msg.role === "user" ? "pl-10" : "pr-10"}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className={
                msg.role === "assistant"
                  ? "text-sm text-zinc-300 leading-relaxed"
                  : "text-sm text-zinc-400 bg-zinc-900/50 border border-zinc-800/40 rounded-xl px-4 py-3 text-right"
              }
            >
              {msg.content || "\u00A0"}
            </div>
          </div>
        ))}

        {streaming && messages[messages.length - 1]?.content === "" && (
          <div className="pr-10 animate-fade-up space-y-2">
            <div className="flex gap-1.5">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 rounded-full bg-violet-400/50"
                  style={{
                    animation: `pulse-dot 1.2s ease-in-out ${delay}ms infinite`,
                  }}
                />
              ))}
            </div>
            {searching && (
              <p className="text-[11px] text-zinc-600 animate-fade-up">
                {lang === "ja"
                  ? "GitHubの貢献を確認中..."
                  : "Looking up contributions..."}
              </p>
            )}
          </div>
        )}

        {saved && (
          <div className="animate-fade-up text-center pt-4">
            <p className="text-xs text-zinc-600">
              {lang === "ja"
                ? "フィードバックを保存しました。このページを閉じて大丈夫です。"
                : "Feedback saved. You may close this page."}
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {!done && (
        <div className="px-6 py-4 border-t border-zinc-800/30">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder={lang === "ja" ? "回答を入力..." : "Type your response..."}
              rows={1}
              disabled={streaming}
              className="flex-1 bg-zinc-900/40 border border-zinc-800/50 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-violet-500/40 resize-none transition-colors disabled:opacity-40"
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              className="px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-20 disabled:hover:bg-violet-600 text-white text-sm font-medium transition-all"
            >
              &rarr;
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
