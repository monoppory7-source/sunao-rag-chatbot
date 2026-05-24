"""
Step 5 & 6 — embed chunks and write them to Supabase.

Two-phase write so a half-finished video never appears in search:
  1. UPSERT `videos` row with is_active=false
  2. Replace `transcript_chunks` for that video
  3. UPDATE is_active=true
  4. INSERT into cache_invalidation_log
"""

from __future__ import annotations

import os
from typing import Sequence

from tenacity import retry, stop_after_attempt, wait_exponential

from .chunk import Chunk
from .fetch_rss import RssEntry

EMBEDDING_MODEL = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
BATCH_SIZE = 100  # OpenAI accepts up to ~2048 inputs / request


@retry(stop=stop_after_attempt(5), wait=wait_exponential(min=1, max=30))
def _embed_batch(client, inputs: Sequence[str]) -> list[list[float]]:
    res = client.embeddings.create(model=EMBEDDING_MODEL, input=list(inputs))
    return [d.embedding for d in res.data]


def _embed_all(client, texts: list[str]) -> list[list[float]]:
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH_SIZE):
        out.extend(_embed_batch(client, texts[i : i + BATCH_SIZE]))
    return out


def embed_and_upsert(
    video: RssEntry,
    chunks: list[Chunk],
    *,
    openai_client,
    supabase,
) -> dict:
    if not chunks:
        return {"youtube_id": video.youtube_id, "chunks_written": 0, "skipped": True}

    embeddings = _embed_all(openai_client, [c.content for c in chunks])

    # 1) UPSERT video (inactive while chunks are being written)
    video_payload = {
        "youtube_id": video.youtube_id,
        "title": video.title,
        "channel_id": video.channel_id,
        "published_at": video.published_at.isoformat(),
        "thumbnail_url": video.thumbnail_url,
        "language": "ja",
        "is_active": False,
    }
    upserted = (
        supabase.table("videos")
        .upsert(video_payload, on_conflict="youtube_id")
        .execute()
    )
    video_id = upserted.data[0]["id"]

    # 2) Replace chunks (idempotent for re-ingest)
    supabase.table("transcript_chunks").delete().eq("video_id", video_id).execute()

    rows = [
        {
            "video_id": video_id,
            "chunk_index": c.chunk_index,
            "content": c.content,
            "start_sec": float(c.start_sec),
            "end_sec": float(c.end_sec),
            "token_count": c.token_count,
            # pgvector accepts the textual "[v1,v2,...]" representation.
            "embedding": str(emb),
        }
        for c, emb in zip(chunks, embeddings)
    ]
    supabase.table("transcript_chunks").insert(rows).execute()

    # 3) Activate
    supabase.table("videos").update({"is_active": True}).eq("id", video_id).execute()

    # 4) Invalidate cache so stale answers stop being served
    supabase.table("cache_invalidation_log").insert(
        {"reason": f"new video: {video.youtube_id}"}
    ).execute()

    return {
        "youtube_id": video.youtube_id,
        "video_id": video_id,
        "chunks_written": len(rows),
        "skipped": False,
    }
