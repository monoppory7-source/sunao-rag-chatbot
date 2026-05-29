"""Step 1 — list recent videos from the channel.

We do NOT use YouTube's public RSS feed (feeds/videos.xml) because YouTube
returns HTTP 500 on it for datacenter IPs such as GitHub Actions runners.
Instead, we use yt-dlp's flat-playlist extraction, which goes through
YouTube's Innertube API and is far more resilient to bot detection.

The function name and ``RssEntry`` dataclass are preserved so the rest of
the pipeline (``pipeline.py``, ``diff_db``, ``embed_and_upsert``) is unchanged.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import yt_dlp


@dataclass
class RssEntry:
    youtube_id: str
    title: str
    channel_id: str
    published_at: datetime
    thumbnail_url: str | None


def fetch_rss(channel_id: str, limit: int = 30) -> list[RssEntry]:
    """Return up to ``limit`` most recent uploads for ``channel_id``.

    The public RSS feed historically returned ~15 entries; we ask for 30 to
    give the diff step a bit of headroom for backfill cases.
    """
    url = f"https://www.youtube.com/channel/{channel_id}/videos"
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "skip_download": True,
        "playlistend": limit,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False) or {}

    entries: list[RssEntry] = []
    for e in info.get("entries", []) or []:
        yt_id = e.get("id")
        if not yt_id:
            continue
        ts = e.get("timestamp")
        if ts:
            published_at = datetime.fromtimestamp(ts, tz=timezone.utc)
        else:
            # extract_flat does not always include upload timestamp. The diff
            # step keys off youtube_id, so this fallback is only used for
            # ordering / display.
            published_at = datetime.now(tz=timezone.utc)
        entries.append(
            RssEntry(
                youtube_id=yt_id,
                title=e.get("title") or yt_id,
                channel_id=channel_id,
                published_at=published_at,
                thumbnail_url=e.get("thumbnail"),
            )
        )
    return entries
