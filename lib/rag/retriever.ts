import { getServerSupabase } from '@/lib/supabase/server';
import { embed } from '@/lib/openai/embeddings';
import type { RetrievedChunk } from '@/types/rag';

export type RetrieveOptions = {
  matchCount?: number;
  matchThreshold?: number;
  recencyWeight?: number;
  recencyHalfLifeDays?: number;
};

/**
 * Embed a user query and pull the top-N transcript chunks via the
 * `match_chunks_weighted` RPC (Step 1 design — similarity + recency).
 *
 * Phase B will plug in MMR re-ranking and query rewriting here.
 */
export async function retrieveChunks(
  query: string,
  opts: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const matchCount = opts.matchCount ?? Number(process.env.RAG_MATCH_COUNT ?? 5);
  const matchThreshold =
    opts.matchThreshold ?? Number(process.env.RAG_MATCH_THRESHOLD ?? 0.5);
  const recencyWeight =
    opts.recencyWeight ?? Number(process.env.RAG_RECENCY_WEIGHT ?? 0.15);
  const recencyHalfLifeDays =
    opts.recencyHalfLifeDays ??
    Number(process.env.RAG_RECENCY_HALF_LIFE_DAYS ?? 180);

  const queryEmbedding = await embed(query);
  const supabase = getServerSupabase();

  const { data, error } = await supabase.rpc('match_chunks_weighted', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    recency_weight: recencyWeight,
    recency_half_life_days: recencyHalfLifeDays,
  });

  if (error) throw new Error(`match_chunks_weighted failed: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}
