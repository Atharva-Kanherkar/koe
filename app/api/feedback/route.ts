import { saveFeedback, getAllFeedback } from "@/lib/store"

export async function POST(req: Request) {
  const { messages } = await req.json()
  const id =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

  const lastAssistant = [...messages]
    .reverse()
    .find((m: { role: string }) => m.role === "assistant")
  const summary = lastAssistant
    ? lastAssistant.content.replace(/\[COMPLETE\]/g, "").trim()
    : ""

  await saveFeedback(id, {
    id,
    timestamp: new Date().toISOString(),
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
