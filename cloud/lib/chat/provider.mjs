import { ChatError, LIMITS, usageSummary } from "./policy.mjs";

export async function* geminiText({ key, model, contents, signal, fetcher = fetch }) {
  const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "You are Jarvis, the user's personal assistant. Respond in Brazilian Portuguese (pt-BR), clearly and concisely. This chat has no tools, web search, external integrations or computer access. Never claim to have executed actions or accessed current information. Never ask for API keys, passwords or other credentials in chat. Use only the conversation provided; explain when earlier context is unavailable." }] },
      contents, generationConfig: { maxOutputTokens: LIMITS.output, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!response.ok || !response.body) throw new ChatError(502, response.status === 429 ? "provider_limit" : "provider_unavailable");
  let buffer = "", emitted = 0, finished = false;
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 1000000) throw new ChatError(502, "invalid_provider_response");
      const lines = buffer.split("\n"); buffer = done ? "" : lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = JSON.parse(line.slice(5).trim());
        if (data.error || data.promptFeedback?.blockReason) throw new ChatError(502, "response_blocked");
        const candidate = data.candidates?.[0];
        if (candidate?.finishReason) {
          if (!["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) throw new ChatError(502, "response_blocked");
          finished = true;
        }
        for (const part of candidate?.content?.parts || []) {
          if (typeof part.text === "string" && !part.thought) {
            emitted += part.text.length;
            if (emitted > 16000) throw new ChatError(502, "invalid_provider_response");
            yield { type: "delta", text: part.text };
          }
        }
        if (data.usageMetadata) yield { type: "usage", usage: usageSummary(data.usageMetadata) };
      }
      if (done) break;
    }
    if (!emitted || !finished) throw new ChatError(502, "incomplete_response");
  } finally { await reader.cancel(); reader.releaseLock(); }
}
