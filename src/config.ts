import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set in production');

/**
 * Provider-agnostic AI settings. 'openai' = any OpenAI-compatible endpoint (Groq, Gemini, OpenRouter,
 * Ollama...), 'anthropic' = Claude. Defaults target Groq's free tier.
 */
function aiConfig() {
  const provider = (process.env.AI_PROVIDER ?? 'openai') as 'openai' | 'anthropic';
  const anthropic = provider === 'anthropic';
  return {
    provider,
    apiKey: process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.AI_MODEL ?? (anthropic ? 'claude-haiku-5-5' : 'llama-3.3-70b-versatile'),
    baseUrl: (process.env.AI_BASE_URL ?? (anthropic ? 'https://api.anthropic.com' : 'https://api.groq.com/openai/v1')).replace(/\/$/, ''),
    timeoutMs: 20_000,
  };
}

/** All secrets come from the environment and are only ever read server-side. */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  dbPath: process.env.DB_PATH ?? './data/bookleaf.db',
  uploadDir: process.env.UPLOAD_DIR ?? './data/uploads',
  ai: aiConfig(),
};
