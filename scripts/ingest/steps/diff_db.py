"""Step 2 — keep only videos not yet stored in Supabase."""

from __future__ import annotations

from typing import Iterable

from .fetch_rss import RssEntry


def diff_db(entries: Iterable[RssEntry], supabase) -> list[RssEntry]:
    entries = list(entries)
    if not entries:
        return []
    ids = [e.youtube_id for e in entries]
    res = (
        supabase.table("videos")
        .select("youtube_id")
        .in_("youtube_id", ids)
        .execute()
    )
    known = {row["youtube_id"] for row in (res.data or [])}
    return [e for e in entries if e.youtube_id not in known]
