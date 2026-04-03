import OpenAI from "openai"
import {
  isConfigured,
  getRecentActivity,
  searchPRs,
  getPRDetails,
} from "@/lib/github"

const BASE_PROMPT = `You are a professional feedback collector for a workplace setting. You are gathering brief, candid feedback from a manager about their intern.

Flow:
1. First message: Greet them warmly (1 sentence), mention this takes under 2 minutes, and ask for their name.
2. Once they give their name, address them as [Name]-san for the rest of the conversation (e.g. "Thank you, Tanaka-san!"). ALWAYS use the -san honorific, even in English.
3. Ask exactly 4 feedback questions, ONE at a time: (1) strongest contribution, (2) biggest area for growth, (3) how they communicate/collaborate, (4) one piece of advice for the intern.
4. After the 4th answer, thank [Name]-san sincerely and give a 2-3 sentence summary of the key themes.
5. Append the exact token [COMPLETE] at the very end of your final message. Do not explain this token.

Rules:
- Keep every response under 3 sentences.
- Be professional, warm, and respectful of their time.
- If they give short answers, accept them gracefully — do not push for more detail.
- ALWAYS use -san when addressing the manager by name. Never drop the honorific.`

const GITHUB_PROMPT = `

You have access to the intern's recent GitHub contributions (listed below) and tools to look up more.
- Weave specific PRs naturally into your questions (e.g. "I see they worked on the auth refactor — how did that go?")
- When the manager mentions a topic, use search_pull_requests to find related PRs
- Do NOT dump raw data on the manager — be conversational, reference 1-2 PRs max per question`

const LANG: Record<string, string> = {
  ja: `\n\nIMPORTANT: Conduct the ENTIRE conversation in Japanese (日本語). All your questions, responses, and the final summary must be in Japanese. Use polite/formal language (敬語).`,
  en: `\n\nConduct the entire conversation in English.`,
}

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_pull_requests",
      description:
        "Search the intern's pull requests by keyword. Use when the manager mentions a topic and you want to find related work.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Keywords to search in PR titles and descriptions",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pull_request_details",
      description:
        "Get full details of a specific PR — description, size, and review comments.",
      parameters: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Repository name" },
          number: { type: "number", description: "PR number" },
        },
        required: ["repo", "number"],
      },
    },
  },
]

async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  try {
    switch (name) {
      case "search_pull_requests":
        return await searchPRs(args.query as string | undefined)
      case "get_pull_request_details":
        return await getPRDetails(args.repo as string, args.number as number)
      default:
        return { error: "Unknown tool" }
    }
  } catch {
    return { error: "GitHub API request failed" }
  }
}

interface ToolCallAccum {
  id: string
  name: string
  arguments: string
}

async function streamWithTools(
  openai: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  depth = 0
) {
  if (depth > 2) return

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    ...(tools ? { tools } : {}),
    stream: true,
    temperature: 0.7,
    max_tokens: 500,
  })

  let content = ""
  const toolCalls = new Map<number, ToolCallAccum>()

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta

    if (delta?.content) {
      content += delta.content
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`)
      )
    }

    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const existing = toolCalls.get(tc.index) || {
          id: "",
          name: "",
          arguments: "",
        }
        if (tc.id) existing.id = tc.id
        if (tc.function?.name) existing.name = tc.function.name
        if (tc.function?.arguments)
          existing.arguments += tc.function.arguments
        toolCalls.set(tc.index, existing)
      }
    }
  }

  if (toolCalls.size === 0) return

  // Let the client know we're looking things up
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify({ status: "searching" })}\n\n`)
  )

  const updated: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    ...messages,
    {
      role: "assistant" as const,
      content: content || null,
      tool_calls: Array.from(toolCalls.values()).map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    },
  ]

  for (const tc of Array.from(toolCalls.values())) {
    const args = JSON.parse(tc.arguments || "{}")
    const result = await executeTool(tc.name, args)
    updated.push({
      role: "tool" as const,
      tool_call_id: tc.id,
      content: JSON.stringify(result),
    })
  }

  await streamWithTools(openai, updated, tools, controller, encoder, depth + 1)
}

export async function POST(req: Request) {
  const { messages, lang = "en" } = await req.json()
  const openai = new OpenAI()

  const useGitHub = isConfigured()
  const activity = useGitHub ? await getRecentActivity() : null

  let system = BASE_PROMPT + (LANG[lang] || LANG.en)
  if (activity?.length) {
    system +=
      GITHUB_PROMPT +
      "\n\nRecent contributions:\n" +
      JSON.stringify(activity, null, 2)
  }

  const allMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...messages,
  ]

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        await streamWithTools(
          openai,
          allMessages,
          useGitHub ? TOOLS : undefined,
          controller,
          encoder
        )
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
