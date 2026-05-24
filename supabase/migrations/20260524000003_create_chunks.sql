-- Transcript chunks with embeddings.
-- Embedding dimension: 1536 (matches text-embedding-3-small).

create table public.transcript_chunks (
  id              uuid primary key default gen_random_uuid(),
  video_id        uuid not null references public.videos(id) on delete cascade,
  chunk_index     int not null,
  content         text not null,
  start_sec       numeric(10,2) not null,
  end_sec         numeric(10,2) not null,
  token_count     int,
  embedding       vector(1536) not null,
  created_at      timestamptz default now(),
  unique (video_id, chunk_index)
);

-- HNSW index for cosine-distance ANN search.
-- m=16 / ef_construction=64 are pgvector defaults: balanced recall / build time.
create index idx_chunks_embedding on public.transcript_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index idx_chunks_video_id on public.transcript_chunks (video_id);

-- Trigram index for hybrid (keyword) search fallback on Japanese-mixed text.
create index idx_chunks_content_trgm on public.transcript_chunks
  using gin (content gin_trgm_ops);
