export interface FeedbackEntry {
  id: string
  timestamp: string
  managerName: string
  messages: { role: string; content: string }[]
  summary: string
}

const memoryStore = new Map<string, FeedbackEntry>()

function hasRedis(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  )
}

async function getRedis() {
  const { Redis } = await import("@upstash/redis")
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

export async function saveFeedback(
  id: string,
  data: FeedbackEntry
): Promise<void> {
  if (hasRedis()) {
    const redis = await getRedis()
    await redis.set(`feedback:${id}`, JSON.stringify(data))
    const ids: string[] =
      (await redis.get<string[]>("feedback:ids")) || []
    await redis.set("feedback:ids", [...ids, id])
  } else {
    memoryStore.set(id, data)
  }
}

export async function getAllFeedback(): Promise<FeedbackEntry[]> {
  if (hasRedis()) {
    const redis = await getRedis()
    const ids: string[] =
      (await redis.get<string[]>("feedback:ids")) || []
    const results = await Promise.all(
      ids.map((id) => redis.get<FeedbackEntry>(`feedback:${id}`))
    )
    return results.filter((r): r is FeedbackEntry => r !== null)
  }
  return Array.from(memoryStore.values())
}
