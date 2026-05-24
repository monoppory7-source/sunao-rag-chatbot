# Ingest pipeline

Local one-shot run:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r scripts/ingest/requirements.txt
cp .env.local.example .env.local && $EDITOR .env.local
set -a && source .env.local && set +a
python scripts/ingest/pipeline.py
```

Scheduled run: see `.github/workflows/ingest.yml` (Phase C).

## Steps

| File | Purpose |
| --- | --- |
| `steps/fetch_rss.py` | Pull latest 15 videos from YouTube RSS |
| `steps/fetch_transcript.py` | yt-dlp auto-subs + Whisper fallback |
| `steps/chunk.py` | Sentence-aware 300-token chunking |
| `steps/embed_and_upsert.py` | Batch embeddings + Supabase UPSERT |
| `pipeline.py` | Orchestrator |

Phase A ships skeletons only; implementations land in Phase B/C.
