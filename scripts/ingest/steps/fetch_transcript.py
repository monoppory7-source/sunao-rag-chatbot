"""
Step 3 — fetch a video transcript via yt-dlp auto-subtitles.

We ask yt-dlp for Japanese auto-generated captions in VTT format,
parse them with `webvtt-py`, and return a list of timed cues.

Whisper fallback is intentionally deferred to a later iteration
(most Sunao Pharmaceutical videos ship with auto-subs).
"""

from __future__ import annotations

import contextlib
import os
import tempfile
from dataclasses import dataclass

import webvtt
import yt_dlp


@dataclass
class Cue:
    start_sec: float
    end_sec: float
    text: str


def _vtt_time_to_sec(ts: str) -> float:
    h, m, s = ts.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def fetch_transcript(youtube_id: str, lang: str = "ja") -> list[Cue]:
    with tempfile.TemporaryDirectory() as tmp:
        out_template = os.path.join(tmp, "%(id)s")
        ydl_opts = {
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": [lang],
            "subtitlesformat": "vtt",
            "skip_download": True,
            "outtmpl": out_template,
            "quiet": True,
            "no_warnings": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={youtube_id}"])

        # yt-dlp writes to {id}.{lang}.vtt
        vtt_path = os.path.join(tmp, f"{youtube_id}.{lang}.vtt")
        if not os.path.exists(vtt_path):
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
