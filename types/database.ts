/**
 * Hand-written subset of the Supabase schema.
 * Regenerate with `supabase gen types typescript` once the CLI is installed.
 */

export type VideoRow = {
  id: string;
  youtube_id: string;
  title: string;
  description: string | null;
  channel_id: string;
  published_at: string;
  duration_sec: number | null;
  thumbnail_url: string | null;
  language: string | null;
  view_count: number | null;
  is_active: boolean;
  ingested_at: string;
  updated_at: string;
};

export type TranscriptChunkRow = {
  id: string;
  video_id: string;
  chunk_index: number;
  content: string;
  start_sec: number;
  end_sec: number;
  token_count: number | null;
  embedding: number[];
  created_at: string;
};

export type QueryCacheRow = {
  id: string;
  query_hash: string;
  query_text: string;
  query_embedding: number[] | null;
  answer: string;
  sources: unknown;
  hit_count: number;
  created_at: string;
  last_accessed_at: string;
};
