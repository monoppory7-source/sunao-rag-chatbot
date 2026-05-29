"""
Step 3 — fetch a video transcript via yt-dlp auto-subtitles.

We ask yt-dlp for Japanese auto-generated captions in VTT format,
parse them with ``webvtt-py``, and return a list of timed cues.

Why we try multiple ``player_client``s
--------------------------------------
The default ``web`` Innertube client is the one most aggressively
flagged by YouTube's "Sign in to confirm you're not a bot" check
from datacenter IPs (GitHub Actions). The mobile-web (``mweb``),
TV-embedded (``tv_embedded``) and iOS (``ios``) clients are
typically still allowed and serve auto-captions equivalently.
We fall through the list and keep the first one that returns a VTT.

Whisper fallback is intentionally deferred to a later iteration
(most Sunao Pharmaceutical videos ship with auto-subs).
"""

from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass

import webvtt
import yt_dlp

# Order matters: cheapest / most permissive first.
_PLAYER_CLIENT_CANDIDATES: tuple[str, ...] = (
    "mweb",
    "tv_embedded",
    "ios",
    "web_safari",
)


@dataclass
class Cue:
    start_sec: float
    end_sec: float
    text: str


def _vtt_time_to_sec(ts: str) -> float:
    h, m, s = ts.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def _try_download(youtube_id: str, lang: str, tmp_dir: str, client: str) -> str | None:
    """Attempt a subtitle download with a specific player_client.
    Returns the VTT path on success, or None on failure."""
    out_template = os.path.join(tmp_dir, "%(id)s")
    ydl_opts = {
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": [lang],
        "subtitlesformat": "vtt",
        "skip_download": True,
        "outtmpl": out_template,
        "quiet": True,
        "no_warnings": True,
        "extractor_args": {"youtube": {"player_client": [client]}},
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={youtube_id}"])
    except yt_dlp.utils.DownloadError as e:
        # Bot detection / 403 / etc. — caller will try the next client.
        print(f"  [yt-dlp:{client}] {e}")
        return None

    vtt_path = os.path.join(tmp_dir, f"{youtube_id}.{lang}.vtt")
    return vtt_path if os.path.exists(vtt_path) else None


def fetch_transcript(youtube_id: str, lang: str = "ja") -> list[Cue]:
    with tempfile.TemporaryDirectory() as tmp:
        vtt_path: str | None = None
        for client in _PLAYER_CLIENT_CANDIDATES:
            vtt_path = _try_download(youtube_id, lang, tmp, client)
            if vtt_path:
                print(f"  [yt-dlp] subs fetched via player_client={client}")
                break

        if not vtt_path:
            return []

        cues: list[Cue] = []
        last_text = ""
        for caption in webvtt.read(vtt_path):
            # Auto-subs frequently emit overlapping cues with duplicated text —
            # collapse identical content.
            text = " ".join(caption.text.strip().split())
            if not text or text == last_text:
                continue
            cues.append(
                Cue(
                    start_sec=_vtt_time_to_sec(caption.start),
                    end_sec=_vtt_time_to_sec(caption.end),
                    text=text,
                )
            )
            last_text = text
        return cues
