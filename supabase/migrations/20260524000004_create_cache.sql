-- Two-tier semantic + exact-match query cache (cost optimisation, Step 4).

create table public.query_cache (
  id                uuid primary key default gen_random_uuid(),
  query_hash        text not null unique,
  query_text        text not null,
  query_embedding   vector(1536),
  answer            text not null,
  sources           jsonb not null,
  hit_count         int default 1,
  created_at        timestamptz default now(),
  last_accessed_at  timestamptz default now()
);

create index idx_query_cache_embedding on public.query_cache
  using hnsw (query_embedding vector_cosine_ops);

-- Marker table: bumped whenever new videos are ingested so cache entries
-- older than the latest invalidation timestamp can be treated as stale.
create table public.cache_invalidation_log (
  id              bigserial primary key,
  invalidated_at  timestamptz default now(),
  reason          text
);

create index idx_cache_invalidation_at on public.cache_invalidation_log (invalidated_at desc);
