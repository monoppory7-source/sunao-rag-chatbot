import type { RetrievedChunk, Source } from '@/types/rag';
import { buildYoutubeUrl, buildThumbnailUrl } from '@/lib/utils/youtube';
import { formatTimestamp } from '@/lib/utils/time';
import { isHpSource, hpUrl } from '@/lib/utils/hp';

/**
 * Map every retrieved chunk to a Source entry, preserving the order that
 * was given to the LLM. We intentionally do NOT dedupe — the LLM's citation
 * markers ([1], [2], ...) must line up 1:1 with what the user sees, otherwise
 * an answer can reference [3] when only two unique sources are shown.
 *
 * Chunks whose youtube_id starts with "hp-" are virtual entries representing
 * a Sunao Pharmaceutical HP page (ingested via scripts/ingest/ingest_hp.py),
 * and get the real HP URL + an empty thumbnail / timestamp.
 */
export function chunksToSources(chunks: RetrievedChunk[]): Source[] {
  return chunks.map((c) => {
    if (isHpSource(c.youtube_id)) {
      return {
        videoId: c.video_id,
        title: c.title,
        url: hpUrl(c.youtube_id),
        thumbnailUrl: '',
        timestamp: '',
      };
    }
    return {
      videoId: c.video_id,
      title: c.title,
      url: buildYoutubeUrl(c.youtube_id, c.start_sec),
      thumbnailUrl: c.thumbnail_url ?? buildThumbnailUrl(c.youtube_id),
      timestamp: formatTimestamp(c.start_sec),
    };
  });
}
