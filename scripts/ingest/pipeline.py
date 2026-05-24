"""
Sunao RAG chatbot — ingest pipeline orchestrator.

Local run:
    python scripts/ingest/pipeline.py
        # or to backfill an explicit list:
    python scripts/ingest/pipeline.py VIDEO_ID1 VIDEO_ID2 ...

Scheduled run:
    .github/workflows/ingest.yml (cron: hourly)
"""

from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone

# macOS-bundled Python does not always trust system CAs. Point urllib /
# feedparser at the certifi bundle before any HTTPS request is made.
import certifi

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
ssl._create_default_https_context = lambda *a, **kw: ssl.create_default_context(
    cafile=certifi.where()
)

import yt_dlp
from openai import OpenAI
from supabase import create_client

from steps.chunk import chunk_cues
from steps.diff_db import diff_db
from steps.embed_and_upsert import embed_and_upsert
from steps.fetch_rss import RssEntry, fetch_rss
from steps.fetch_transcript import fetch_transcript


def _fetch_meta(youtube_id: str, channel_id: str) -> RssEntry:
    """Pull real title/published_at/thumbnail via yt-dlp for a single video."""
    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as ydl:
        info = ydl.extract_info(
            f"https://www.youtube.com/watch?v={youtube_id}", download=False
        )
    upload_date = info.get("upload_date")  # "YYYYMMDD"
    if upload_date:
        published_at = datetime.strptime(upload_date, "%Y%m%d").replace(tzinfo=timezone.utc)
    else:
        published_at = datetime.now(tz=timezone.utc)
    return RssEntry(
        youtube_id=youtube_id,
        title=info.get("title") or f"(backfill) {youtube_id}",
        channel_id=info.get("channel_id") or channel_id,
        published_at=published_at,
        thumbnail_url=info.get("thumbnail"),
    )


@dataclass
class IngestConfig:
    channel_id: str
    supabase_url: str
    supabase_service_key: str
    openai_api_key: str
    slack_webhook_url: str | None = None

    @classmethod
    def from_env(cls) -> "IngestConfig":
        missing = [
            k
            for k in (
                "YOUTUBE_CHANNEL_ID",
                "NEXT_PUBLIC_SUPABASE_URL",
                "SUPABASE_SERVICE_ROLE_KEY",
                "OPENAI_API_KEY",
            )
            if not os.environ.get(k)
        ]
        if missing:
            raise SystemExit(f"Missing env vars: {', '.join(missing)}")
        return cls(
            channel_id=os.environ["YOUTUBE_CHANNEL_ID"],
            supabase_url=os.environ["NEXT_PUBLIC_SUPABASE_URL"],
            supabase_service_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
            openai_api_key=os.environ["OPENAI_API_KEY"],
            slack_webhook_url=os.environ.get("SLACK_WEBHOOK_URL") or None,
        )


def notify_slack(webhook_url: str | None, text: str) -> None:
    if not webhook_url:
        print(text)
        return
    try:
        req = urllib.request.Request(
            webhook_url,
            data=json.dumps({"text": text}).encode(),
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=5).read()
    except Exception as e:  # noqa: BLE001
        print(f"[slack] notify failed: {e}")


def _process(
    videos: list[RssEntry],
    *,
    openai_client: OpenAI,
    supabase,
) -> list[dict]:
    results: list[dict] = []
    for v in videos:
        print(f"[ingest] {v.youtube_id} :: {v.title}")
        try:
            cues = fetch_transcript(v.youtube_id)
            if not cues:
                print("  no transcript (auto-subs unavailable) — skipping")
                results.append({"youtube_id": v.youtube_id, "skipped": True, "reason": "no_subs"})
                continue
            chunks = chunk_cues(cues)
            print(f"  cues={len(cues)} chunks={len(chunks)}")
            r = embed_and_upsert(
                v, chunks, openai_client=openai_client, supabase=supabase
            )
            print(f"  wrote {r['chunks_written']} chunks")
            results.append(r)
        except Exception as e:  # noqa: BLE001
            print(f"  ERROR: {e}")
            results.append({"youtube_id": v.youtube_id, "error": str(e)})
    return results


def main() -> int:
    cfg = IngestConfig.from_env()
    openai_client = OpenAI(api_key=cfg.openai_api_key)
    supabase = create_client(cfg.supabase_url, cfg.supabase_service_key)

    explicit_ids = sys.argv[1:]
    if explicit_ids:
        # Backfill mode — fetch real metadata for each ID via yt-dlp.
        print(f"[ingest] backfill mode for {len(explicit_ids)} ids")
        targets: list[RssEntry] = []
        for vid in explicit_ids:
            try:
                targets.append(_fetch_meta(vid, cfg.channel_id))
            except Exception as e:  # noqa: BLE001
                print(f"  metadata fetch failed for {vid}: {e}")
    else:
        rss = fetch_rss(cfg.channel_id)
        print(f"[ingest] RSS returned {len(rss)} entries")
        targets = diff_db(rss, supabase)
        print(f"[ingest] {len(targets)} new entries after diff")

    if not targets:
        notify_slack(cfg.slack_webhook_url, "[ingest] no new videos")
        return 0

    results = _process(targets, openai_client=openai_client, supabase=supabase)
    ok = sum(1 for r in results if r.get("chunks_written"))
    skipped = sum(1 for r in results if r.get("skipped"))
    err = sum(1 for r in results if r.get("error"))
    summary = f"[ingest] done — ok={ok} skipped={skipped} error={err}"
    notify_slack(cfg.slack_webhook_url, summary)
    return 0 if err == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
