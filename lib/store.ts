export interface FeedbackEntry {
  id: string
  timestamp: string
  managerName: string
  messages: { role: string; content: string }[]
  summary: string
}

const memoryStore = new Map<string, FeedbackEntry>()

function hasKV(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

export async function saveFeedback(
  id: string,
  data: FeedbackEntry
): Promise<void> {
  if (hasKV()) {
    const { kv } = await import("@vercel/kv")
    await kv.set(`feedback:${id}`, data)
    const ids: string[] = (await kv.get("feedback:ids")) || []
    await kv.set("feedback:ids", [...ids, id])
  } else {
    memoryStore.set(id, data)
  }
}

export async function getAllFeedback(): Promise<FeedbackEntry[]> {
  if (hasKV()) {
    const { kv } = await import("@vercel/kv")
    const ids: string[] = (await kv.get("feedback:ids")) || []
    const results = await Promise.all(
      ids.map((id) => kv.get<FeedbackEntry>(`feedback:${id}`))
    )
    return results.filter((r): r is FeedbackEntry => r !== null)
  }
  return Array.from(memoryStore.values())
}
