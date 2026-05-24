import OpenAI from 'openai';

let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  cached = new OpenAI({ apiKey });
  return cached;
}

export const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

export const CHAT_MODEL =
  process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini';
