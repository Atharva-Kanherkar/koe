import OpenAI from "openai"

const BASE_PROMPT = `You are a professional feedback collector for a workplace setting. You are gathering brief, candid feedback from a manager about their intern.

Rules:
- Greet them warmly in one sentence. Mention this will take under 2 minutes.
- Ask ONE question at a time. Keep questions short and specific.
- Ask exactly 4 questions covering: (1) strongest contribution, (2) biggest area for growth, (3) how they communicate/collaborate, (4) one piece of advice for the intern.
- After the 4th answer, thank them sincerely and give a 2-3 sentence summary of the key themes.
- Append the exact token [COMPLETE] at the very end of your final message (after the thank-you and summary). Do not explain this token.
- Keep every response under 3 sentences.
- Be professional, warm, and respectful of their time.
- If they give short answers, accept them gracefully — do not push for more detail.`

const LANG: Record<string, string> = {
  ja: `\n\nIMPORTANT: Conduct the ENTIRE conversation in Japanese (日本語). All your questions, responses, and the final summary must be in Japanese. Use polite/formal language (敬語).`,
  en: `\n\nConduct the entire conversation in English.`,
}

export async function POST(req: Request) {
  const { messages, lang = "en" } = await req.json()

  const openai = new OpenAI()

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: BASE_PROMPT + (LANG[lang] || LANG.en) },
      ...messages,
    ],
    stream: true,
    temperature: 0.7,
    max_tokens: 300,
  })

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || ""
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            )
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
