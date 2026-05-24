/**
 * Retrieval evaluation harness.
 *
 *   npm run eval
 *
 * Steps:
 *   1. Load `golden_set.json` (manually curated query → expected youtube_id list)
 *   2. For each query, call the production retriever
 *   3. Compute Recall@5 and MRR per query, then averages
 *   4. Print as a table — wire this into CI later to detect regressions
 *
 * Populate `golden_set.json` with at least 20–50 real entries
 * before reading the numbers as ground truth.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { retrieveChunks } from '@/lib/rag/retriever';

type GoldenItem = {
  query: string;
  expected_video_ids: string[];
  category?: string;
};

type RowResult = {
  query: string;
  category: string;
  retrieved: number;
  recall_at_5: number;
  mrr: number;
};

function recallAtK(retrieved: string[], expected: string[], k: number): number {
  if (expected.length === 0) return 0;
  const topK = new Set(retrieved.slice(0, k));
  const hits = expected.filter((id) => topK.has(id)).length;
  return hits / expected.length;
}

function reciprocalRank(retrieved: string[], expected: string[]): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (expected.includes(retrieved[i])) return 1 / (i + 1);
  }
  return 0;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const items: GoldenItem[] = JSON.parse(
    readFileSync(join(here, 'golden_set.json'), 'utf8'),
  );

  const placeholders = items.filter((it) =>
    it.expected_video_ids.some((id) => id.startsWith('REPLACE_')),
  );
  if (placeholders.length > 0) {
    console.warn(
      `\n⚠️  ${placeholders.length}/${items.length} golden_set entries still contain placeholder IDs.`,
    );
    console.warn(
      'Replace REPLACE_WITH_REAL_YOUTUBE_ID with real video IDs before trusting the numbers.\n',
    );
  }

  console.log(`Running retrieval against ${items.length} queries…\n`);

  const rows: RowResult[] = [];
  for (const item of items) {
    const chunks = await retrieveChunks(item.query, { matchCount: 10 });
    const retrievedVideos: string[] = [];
    const seen = new Set<string>();
    for (const c of chunks) {
      if (seen.has(c.youtube_id)) continue;
      seen.add(c.youtube_id);
      retrievedVideos.push(c.youtube_id);
    }

    rows.push({
      query: item.query.slice(0, 30) + (item.query.length > 30 ? '…' : ''),
      category: item.category ?? '-',
      retrieved: retrievedVideos.length,
      recall_at_5: Number(recallAtK(retrievedVideos, item.expected_video_ids, 5).toFixed(3)),
      mrr: Number(reciprocalRank(retrievedVideos, item.expected_video_ids).toFixed(3)),
    });
  }

  console.table(rows);
  console.log('');
  console.log(`avg Recall@5 : ${mean(rows.map((r) => r.recall_at_5)).toFixed(3)}`);
  console.log(`avg MRR      : ${mean(rows.map((r) => r.mrr)).toFixed(3)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
