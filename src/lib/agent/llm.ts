import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function llmAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Thin wrapper around a single Claude completion. Every caller in
 * lib/agent/* has a deterministic, well-reasoned fallback for when no API
 * key is configured — the LLM is used to make the agent's language sharper
 * (reminder tone, rationale wording) and smarter (discount negotiation),
 * never to make Pocket CFO "require" an API key to function or to decide
 * whether money moves.
 */
export async function complete(system: string, prompt: string, maxTokens = 400): Promise<string | null> {
  if (!llmAvailable()) return null;

  try {
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
    const res = await getClient().messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content.find((c) => c.type === "text");
    return block && block.type === "text" ? block.text.trim() : null;
  } catch (err) {
    console.error("[agent/llm] Claude call failed, falling back to heuristics:", err);
    return null;
  }
}
