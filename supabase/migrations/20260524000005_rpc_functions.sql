-- RPC functions exposed to the Next.js app via supabase.rpc(...).

-- ============================================================
-- 1) Pure vector similarity search.
-- ============================================================
create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  chunk_id     uuid,
  video_id     uuid,
  youtube_id   text,
  title        text,
  thumbnail_url text,
  content      text,
  start_sec    numeric,
  similarity   float
)
language sql stable
as $$
  select
    tc.id            as chunk_id,
    tc.video_id,
    v.youtube_id,
    v.title,
    v.thumbnail_url,
    tc.content,
    tc.start_sec,
    1 - (tc.embedding <=> query_embedding) as similarity
  from public.transcript_chunks tc
  join public.videos v on v.id = tc.video_id
  where v.is_active = true
    and 1 - (tc.embedding <=> query_embedding) > match_threshold
  order by tc.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- 2) Recency-weighted hybrid score.
-- final_score = (1 - w) * similarity
--             + w * exp(-ln(2) * Δt / half_life_days)
-- Widely sample (match_count * 4) then re-rank in CTE so HNSW
-- can still serve the inner ORDER BY.
-- ============================================================
create or replace function public.match_chunks_weighted(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5,
  recency_weight float default 0.15,
  recency_half_life_days float default 180
)
returns table (
  chunk_id      uuid,
  video_id      uuid,
  youtube_id    text,
  title         text,
  thumbnail_url text,
  content       text,
  start_sec     numeric,
  published_at  timestamptz,
  similarity    float,
  final_score   float
)
language sql stable
as $$
  with candidates as (
    select
      tc.id, tc.video_id, tc.content, tc.start_sec,
      v.youtube_id, v.title, v.thumbnail_url, v.published_at,
      1 - (tc.embedding <=> query_embedding) as similarity
    from public.transcript_chunks tc
    join public.videos v on v.id = tc.video_id
    where v.is_active = true
    order by tc.embedding <=> query_embedding
    limit match_count * 4
  )
  select
    id as chunk_id, video_id, youtube_id, title, thumbnail_url,
    content, start_sec, published_at, similarity,
    (
      (1 - recency_weight) * similarity
      + recency_weight * exp(
          -ln(2) * extract(epoch from (now() - published_at)) / (recency_half_life_days * 86400)
        )
    ) as final_score
  from candidates
  where similarity > match_threshold
  order by final_score desc
  limit match_count;
$$;

-- ============================================================
-- 3) Semantic cache lookup (Step 4: L3 cache).
-- Returns at most one entry that is semantically close enough
-- AND newer than the latest invalidation event.
-- ============================================================
create or replace function public.match_cache(
  query_embedding vector(1536),
  similarity_threshold float default 0.95
)
returns table (
  id          uuid,
  answer      text,
  sources     jsonb,
  similarity  float
)
language sql stable
as $$
  with latest_invalidation as (
    select coalesce(max(invalidated_at), 'epoch'::timestamptz) as ts
    from public.cache_invalidation_log
  )
  select
    qc.id, qc.answer, qc.sources,
    1 - (qc.query_embedding <=> query_embedding) as similarity
  from public.query_cache qc, latest_invalidation li
  where qc.query_embedding is not null
    and qc.created_at > li.ts
    and 1 - (qc.query_embedding <=> query_embedding) > similarity_threshold
  order by qc.query_embedding <=> query_embedding
  limit 1;
$$;
