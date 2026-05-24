# Retrieval evaluation

Manual workflow:

```bash
# Populate golden_set.json with real query → expected_video_ids mappings (≥20).
$EDITOR scripts/eval/golden_set.json

# Run the eval — loads .env.local automatically.
npm run eval
```

Output:

```
avg Recall@5 : 0.860
avg MRR      : 0.712
```

## Tuning workflow

1. Record baseline (current settings, n queries from `golden_set.json`).
2. Change ONE parameter (`RAG_MATCH_COUNT`, `RAG_RECENCY_WEIGHT`, chunk size, …).
3. Re-run `npm run eval`. Keep the change only if both metrics improve.
4. Roll back otherwise.

## What to put in `golden_set.json`

| Field | Notes |
| --- | --- |
| `query` | Real user-style question. Mix categories. |
| `expected_video_ids` | One or more YouTube IDs that *should* surface as a top-5 hit (human-judged). |
| `category` | Free-form bucket label so you can spot per-category regressions. |

Target ≥ 30 entries for the numbers to mean anything.
