"""
Step 4 — sentence-aware chunking with tiktoken.

Strategy:
- concatenate cues, remembering the source second of each character
- split on Japanese sentence boundaries (。？！) and ASCII (.?!)
- pack sentences into ~target_tokens, falling back to overflow when
  a single sentence exceeds the target
- carry `overlap_tokens` from tail of one chunk into the head of the next
"""

from __future__ import annotations

from dataclasses import dataclass

import tiktoken

from .fetch_transcript import Cue

SENTENCE_END = set("。．.！!？?")

_enc = None


def _encoder():
    global _enc
    if _enc is None:
        _enc = tiktoken.get_encoding("cl100k_base")
    return _enc


def _count_tokens(text: str) -> int:
    return len(_encoder().encode(text))


@dataclass
class Chunk:
    chunk_index: int
    content: str
    start_sec: float
    end_sec: float
    token_count: int


@dataclass
class _Sentence:
    text: str
    start_sec: float
    end_sec: float
    tokens: int


def _segment_sentences(cues: list[Cue]) -> list[_Sentence]:
    sentences: list[_Sentence] = []
    buf: list[str] = []
    buf_start: float | None = None
    buf_end: float = 0.0

    def flush():
        nonlocal buf, buf_start, buf_end
        if not buf:
            return
        text = "".join(buf).strip()
        if text:
            sentences.append(
                _Sentence(
                    text=text,
                    start_sec=buf_start or 0.0,
                    end_sec=buf_end,
                    tokens=_count_tokens(text),
                )
            )
        buf = []
        buf_start = None

    for cue in cues:
        for ch in cue.text:
            if buf_start is None:
                buf_start = cue.start_sec
            buf.append(ch)
            buf_end = cue.end_sec
            if ch in SENTENCE_END:
                flush()
        # Inter-cue space helps preserve word boundaries when sub timing
        # doesn't fall on punctuation.
        if buf:
            buf.append(" ")
            buf_end = cue.end_sec
    flush()
    return sentences


def chunk_cues(
    cues: list[Cue],
    target_tokens: int = 300,
    overlap_tokens: int = 50,
) -> list[Chunk]:
    sentences = _segment_sentences(cues)
    if not sentences:
        return []

    chunks: list[Chunk] = []
    cur: list[_Sentence] = []
    cur_tokens = 0
    idx = 0

    def emit():
        nonlocal idx
        text = "".join(s.text for s in cur).strip()
        if not text:
            return
        chunks.append(
            Chunk(
                chunk_index=idx,
                content=text,
                start_sec=cur[0].start_sec,
                end_sec=cur[-1].end_sec,
                token_count=cur_tokens,
            )
        )
        idx += 1

    for sent in sentences:
        # A single sentence exceeding the target is rare in real captions;
        # emit it as its own chunk to preserve information.
        if sent.tokens >= target_tokens and not cur:
            cur = [sent]
            cur_tokens = sent.tokens
            emit()
            cur = []
            cur_tokens = 0
            continue

        if cur_tokens + sent.tokens > target_tokens and cur:
            emit()
            # carry overlap
            tail: list[_Sentence] = []
            tail_tokens = 0
            for s in reversed(cur):
                if tail_tokens + s.tokens > overlap_tokens:
                    break
                tail.insert(0, s)
                tail_tokens += s.tokens
            cur = tail
            cur_tokens = tail_tokens

        cur.append(sent)
        cur_tokens += sent.tokens

    if cur:
        emit()
    return chunks
