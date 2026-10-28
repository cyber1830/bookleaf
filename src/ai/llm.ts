import { config } from '../config.js';

export class AiUnavailable extends Error {}

// Tiny circuit breaker: after 3 consecutive failures stop calling the API for 60s,
// so an outage doesn't add latency to every ticket.
let failures = 0;
let openUntil = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface CompleteArgs { system: string; user: string; maxTokens: number; jsonMode?: boolean; reasoningEffort?: 'low' | 'medium' | 'high' }

function buildRequest({ system, user, maxTokens, jsonMode, reasoningEffort }: CompleteArgs): {
  url: string; headers: Record<string, string>; body: unknown; read: (d: any) => string | undefined;
} {
  const { provider, apiKey, model, baseUrl } = config.ai;
  if (provider === 'anthropic')
    return {
      url: `${baseUrl}/v1/messages`,
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: { model, max_tokens: maxTokens, temperature: 0.2, system, messages: [{ role: 'user', content: user }] },
      read: (d: any): string | undefined => d.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(''),
    };
  // OpenAI-compatible chat completions (Groq, Gemini, OpenRouter, Ollama, OpenAI...)
  return {
    url: `${baseUrl}/chat/completions`,
    headers: { authorization: `Bearer ${apiKey}` },
      body: {
        model,
        max_tokens: maxTokens,
        temperature: 0.2,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      },
    read: (d: any): string | undefined => d.choices?.[0]?.message?.content,
  };
}

/** Single text completion against the configured LLM provider. Server-side only. */
export async function complete(args: CompleteArgs): Promise<string> {
  if (!config.ai.apiKey) throw new AiUnavailable('AI_API_KEY is not configured');
  if (Date.now() < openUntil) throw new AiUnavailable('AI temporarily paused after repeated failures');

  let lastError = 'unknown error';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const req = buildRequest(args);
      const res = await fetch(req.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...req.headers },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(config.ai.timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = `AI API returned ${res.status}`;
        await sleep(800 * (attempt + 1)); // retry once on rate limit / server error
        continue;
      }
      if (!res.ok) throw new AiUnavailable(`AI API returned ${res.status}`); // 4xx: retrying won't help
      const text = req.read(await res.json())?.trim();
      if (!text) throw new AiUnavailable('AI returned an empty response');
      failures = 0;
      return text;
    } catch (e) {
      if (e instanceof AiUnavailable) { failures++; if (failures >= 3) openUntil = Date.now() + 60_000; throw e; }
      lastError = e instanceof Error ? e.message : String(e); // network error / timeout
    }
  }
  failures++;
  if (failures >= 3) openUntil = Date.now() + 60_000;
  throw new AiUnavailable(lastError);
}
