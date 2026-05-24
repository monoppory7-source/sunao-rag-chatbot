"""Step 1 — fetch the YouTube channel RSS feed."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import feedparser

RSS_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"


@dataclass
class RssEntry:
    youtube_id: str
    title: str
    channel_id: str
    published_at: datetime
    thumbnail_url: str | None


def fetch_rss(channel_id: str) -> list[RssEntry]:
    feed = feedparser.parse(RSS_URL.format(channel_id=channel_id))
    if feed.bozo:
        raise RuntimeError(f"RSS parse error: {feed.bozo_exception}")

    entries: list[RssEntry] = []
    for e in feed.entries:
        yt_id = getattr(e, "yt_videoid", None) or e.get("id", "").split(":")[-1]
        if not yt_id:
            continue

        # feedparser exposes the parsed datetime as a time.struct_time.
        published_at = datetime(*e.published_parsed[:6], tzinfo=timezone.utc)

        thumb = None
        media = e.get("media_thumbnail") or []
        if media:
            thumb = media[0].get("url")

        entries.append(
            RssEntry(
                youtube_id=yt_id,
                title=e.title,
                channel_id=channel_id,
                published_at=published_at,
                thumbnail_url=thumb,
            )
        )
    return entries
