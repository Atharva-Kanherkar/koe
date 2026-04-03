import { saveFeedback, getAllFeedback } from "@/lib/store"

export async function POST(req: Request) {
  const { messages } = await req.json()
  const id =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

  // First user message is the manager's name
  const firstUserMsg = messages.find(
    (m: { role: string }) => m.role === "user"
  )
  const managerName = firstUserMsg ? firstUserMsg.content.trim() : "Anonymous"

  const lastAssistant = [...messages]
    .reverse()
    .find((m: { role: string }) => m.role === "assistant")
  const summary = lastAssistant
    ? lastAssistant.content.replace(/\[COMPLETE\]/g, "").trim()
    : ""

  await saveFeedback(id, {
    id,
    timestamp: new Date().toISOString(),
    managerName,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content.replace(/\[COMPLETE\]/g, "").trim(),
    })),
    summary,
  })

  return Response.json({ ok: true, id })
}

export async function GET() {
  const feedbacks = await getAllFeedback()
  return Response.json(feedbacks)
}
