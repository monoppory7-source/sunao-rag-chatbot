"""
Ingest Sunao Pharmaceutical website pages into the same chunks table
used for YouTube transcripts.

Each HP page is treated as a "virtual video":
  - videos.youtube_id   = "hp-<slug>" (special prefix the front-end checks)
  - videos.title        = the curated page title from PAGES below
  - videos.channel_id   = "sunao-hp" (constant marker)
  - videos.published_at = now (HP pages have no real publish timestamp)
  - transcript_chunks   = sentence-packed text from the page, with
                          start_sec / end_sec = 0 (no timeline)

Run locally:
    cd scripts/ingest
    python ingest_hp.py            # ingest all pages defined below
    python ingest_hp.py hp-top hp-oem-supplement   # subset

The script imports embed_and_upsert / chunk_cues from the existing
YouTube pipeline so we don't fork the embedding logic.
"""

from __future__ import annotations

import os
import ssl
import sys
from datetime import datetime, timezone

import certifi

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
ssl._create_default_https_context = lambda *a, **kw: ssl.create_default_context(
    cafile=certifi.where()
)

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

from steps.chunk import chunk_cues
from steps.embed_and_upsert import embed_and_upsert
from steps.fetch_rss import RssEntry
from steps.fetch_transcript import Cue

# Pick up Supabase + OpenAI credentials from the Next.js app's .env.local
# without forcing the user to export them by hand. Walk up from this file
# until we find one.
_HERE = os.path.dirname(os.path.abspath(__file__))
for _candidate in (
    os.path.join(_HERE, "..", "..", ".env.local"),
    os.path.join(_HERE, "..", ".env.local"),
    os.path.join(_HERE, ".env.local"),
):
    if os.path.exists(_candidate):
        load_dotenv(_candidate)
        break


# Curated subset of Sunao Pharmaceutical pages worth indexing for the
# OEM-focused chatbot. Keep the list small and high-signal.
PAGES: dict[str, dict[str, str]] = {
    "hp-top": {
        "url": "https://sunao-seiyaku.com/",
        "title": "Sunao製薬 公式サイト トップ",
    },
    "hp-oem-supplement": {
        "url": "https://sunao-seiyaku.com/oem/oem-supplement/",
        "title": "サプリメントOEM 詳細（剤形・MOQ・流れ・価格）",
    },
    "hp-beginners": {
        "url": "https://sunao-seiyaku.com/beginners/",
        "title": "OEM はじめての方へ",
    },
    "hp-materials": {
        "url": "https://sunao-seiyaku.com/materials/",
        "title": "取扱原料一覧",
    },
    "hp-case": {
        "url": "https://sunao-seiyaku.com/oem/oem-case/",
        "title": "OEM 事例",
    },
}


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) sunao-rag-chatbot/1.0"
)


def _extract_text(html: str) -> str:
    """Pull the readable body text out of a Sunao HP page.

    Sunao runs on WordPress; the main content lives somewhere inside
    <main>, <article>, or a div with class containing 'content'. We
    strip nav / header / footer / scripts / styles and fall back to
    body text if no specific container is found.
    """
    soup = BeautifulSoup(html, "lxml")

    # Drop noise that's never useful in answers.
    for tag in soup(["script", "style", "noscript", "header", "nav", "footer", "form", "svg"]):
        tag.decompose()

    container = (
        soup.find("main")
        or soup.find("article")
        or soup.find("div", attrs={"id": "main"})
        or soup.find("div", attrs={"class": lambda c: c and "content" in " ".join(c).lower()})
        or soup.body
    )
    if container is None:
        return ""

    # Use newlines between block-level boundaries so the sentence
    # splitter has reasonable cues.
    text = container.get_text(separator="\n", strip=True)

    # Collapse repeated whitespace but preserve paragraph breaks.
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines)


def _fetch(url: str) -> str:
    res = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20)
    res.raise_for_status()
    # Sunao's pages are UTF-8; trust the response encoding once apparent.
    res.encoding = res.apparent_encoding or res.encoding
    return res.text


def _page_to_entry_and_chunks(
    slug: str, url: str, title: str
) -> tuple[RssEntry, list]:
    html = _fetch(url)
    text = _extract_text(html)
    if not text:
        return (None, [])  # type: ignore[return-value]

    # Wrap the whole page body as a single un-timed Cue so the existing
    # tiktoken-based sentence packer can do the chunking. start/end are
    # both 0 because HP pages have no timeline.
    cue = Cue(start_sec=0.0, end_sec=0.0, text=text)
    chunks = chunk_cues([cue])

    entry = RssEntry(
        youtube_id=slug,
        title=title,
        channel_id="sunao-hp",
        published_at=datetime.now(tz=timezone.utc),
        thumbnail_url=None,
    )
    return entry, chunks


def _need(var: str) -> str:
    val = os.environ.get(var)
    if not val:
        raise SystemExit(
            f"Missing env var: {var}. Did you set it in .env.local?"
        )
    return val


def main() -> int:
    # HP ingest does not need YOUTUBE_CHANNEL_ID, so we read the three
    # creds we actually care about directly instead of going through
    # the YouTube-flavoured IngestConfig.
    openai_client = OpenAI(api_key=_need("OPENAI_API_KEY"))
    supabase = create_client(
        _need("NEXT_PUBLIC_SUPABASE_URL"),
        _need("SUPABASE_SERVICE_ROLE_KEY"),
    )
    slack_webhook = os.environ.get("SLACK_WEBHOOK_URL") or None

    explicit = sys.argv[1:]
    targets = explicit if explicit else list(PAGES.keys())

    ok = 0
    err = 0
    for slug in targets:
        spec = PAGES.get(slug)
        if not spec:
            print(f"[hp-ingest] unknown page id: {slug} — skipping")
            err += 1
            continue

        print(f"[hp-ingest] {slug} :: {spec['url']}")
        try:
            entry, chunks = _page_to_entry_and_chunks(
                slug, spec["url"], spec["title"]
            )
            if not chunks:
                print("  no extractable text — skipping")
                continue
            print(f"  chunks={len(chunks)}")
            res = embed_and_upsert(
                entry, chunks, openai_client=openai_client, supabase=supabase
            )
            print(f"  wrote {res['chunks_written']} chunks")
            ok += 1
        except Exception as e:  # noqa: BLE001
            print(f"  ERROR: {e}")
            err += 1

    summary = f"[hp-ingest] done — ok={ok} error={err}"
    print(summary)
    if slack_webhook:
        try:
            import json
            import urllib.request

            req = urllib.request.Request(
                slack_webhook,
                data=json.dumps({"text": summary}).encode(),
                headers={"Content-Type": "application/json"},
            )
            urllib.request.urlopen(req, timeout=5).read()
        except Exception as e:  # noqa: BLE001
            print(f"[slack] notify failed: {e}")
    return 0 if err == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
