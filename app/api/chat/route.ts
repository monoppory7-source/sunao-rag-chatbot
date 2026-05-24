import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getOpenAI, CHAT_MODEL } from '@/lib/openai/client';
import { embed } from '@/lib/openai/embeddings';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/openai/prompts';
import { retrieveChunks } from '@/lib/rag/retriever';
import { chunksToSources } from '@/lib/rag/formatter';
import { checkExactCache, checkSemanticCache, saveCache } from '@/lib/rag/cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({
  message: z.string().min(1).max(500),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      }),
    )
    .max(10)
    .optional(),
});

/**
 * POST /api/chat
 *
 * Response shape:
 *   - Hit: JSON { answer, sources, cached: true }     status 200
 *   - Miss: text/plain stream of answer tokens         status 200
 *           + `X-Sources` header (URL-encoded JSON)
 *           + `X-Cache: MISS`
 *   - Empty retrieval: JSON { answer, sources: [] }    status 200
 *   - Invalid:  JSON { error, issues }                 status 400
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { message, history = [] } = parsed.data;

  // ─── L2: exact-match cache ────────────────────────────────────
  const exact = await checkExactCache(message).catch(() => null);
  if (exact) {
    return NextResponse.json(
      { ...exact, cached: true },
      { headers: { 'X-Cache': 'HIT-EXACT' } },
    );
  }

  // ─── Embedding (used for both semantic cache and retrieval) ───
  const queryEmbedding = await embed(message);

  // ─── L3: semantic cache ──────────────────────────────────────
  const semantic = await checkSemanticCache(queryEmbedding).catch(() => null);
  if (semantic) {
    return NextResponse.json(
      { ...semantic, cached: true },
      { headers: { 'X-Cache': 'HIT-SEMANTIC' } },
    );
  }

  // ─── Retrieval ───────────────────────────────────────────────
  const chunks = await retrieveChunks(message);
  const sources = chunksToSources(chunks);

  // Hallucination guard — never call the LLM with empty context.
  if (chunks.length === 0) {
    return NextResponse.json(
      {
        answer:
          '申し訳ございません。動画内に該当する情報が見つかりませんでした。別の言い回しでお試しください。',
        sources: [],
        cached: false,
      },
      { headers: { 'X-Cache': 'MISS-EMPTY' } },
    );
  }

  // ─── Streaming chat completion ───────────────────────────────
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    stream: true,
    temperature: 0.3,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: buildUserPrompt(message, chunks) },
    ],
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = '';
      try {
        for await (const part of completion) {
          const delta = part.choices[0]?.delta?.content ?? '';
          if (delta) {
            full += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }
      } catch (err) {
        controller.error(err);
        return;
      }
      controller.close();

      // Background — never block the response on a cache write.
      saveCache({ query: message, queryEmbedding, answer: full, sources }).catch(
        (e) => console.error('[cache:save] failed', e),
      );
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Cache': 'MISS',
      'X-Sources': encodeURIComponent(JSON.stringify(sources)),
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
