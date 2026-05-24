import { getServerSupabase } from '@/lib/supabase/server';
import { hashQuery } from '@/lib/utils/hash';
import type { Source } from '@/types/rag';

/**
 * Three-tier cache helpers (Step 4 design).
 * Phase B will wire these into the /api/chat route.
 */

export type CachedAnswer = {
  answer: string;
  sources: Source[];
};

/** L2 — exact-match (hash) lookup. */
export async function checkExactCache(query: string): Promise<CachedAnswer | null> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('query_cache')
    .select('answer, sources')
    .eq('query_hash', hashQuery(query))
    .maybeSingle();
  if (!data) return null;
  return { answer: data.answer, sources: data.sources as Source[] };
}

/** L3 — semantic similarity lookup against query embeddings. */
export async function checkSemanticCache(
  queryEmbedding: number[],
  threshold = Number(process.env.RAG_CACHE_SIMILARITY_THRESHOLD ?? 0.95),
): Promise<CachedAnswer | null> {
  const supabase = getServerSupabase();
  const { data } = await supabase.rpc('match_cache', {
    query_embedding: queryEmbedding,
    similarity_threshold: threshold,
  });
  if (!data || data.length === 0) return null;
  const hit = data[0];
  return { answer: hit.answer, sources: hit.sources as Source[] };
}

export async function saveCache(args: {
  query: string;
  queryEmbedding: number[];
  answer: string;
  sources: Source[];
}): Promise<void> {
  const supabase = getServerSupabase();
  await supabase.from('query_cache').upsert(
    {
      query_hash: hashQuery(args.query),
      query_text: args.query,
      query_embedding: args.queryEmbedding,
      answer: args.answer,
      sources: args.sources,
    },
    { onConflict: 'query_hash' },
  );
}
