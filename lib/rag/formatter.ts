import type { RetrievedChunk, Source } from '@/types/rag';
import { buildYoutubeUrl, buildThumbnailUrl } from '@/lib/utils/youtube';
import { formatTimestamp } from '@/lib/utils/time';

/**
 * Deduplicate chunks by video — when several chunks of the same video
 * are retrieved we keep the highest-scoring one and surface it as a
 * single source card in the UI.
 */
export function chunksToSources(chunks: RetrievedChunk[]): Source[] {
  const byVideo = new Map<string, RetrievedChunk>();
  for (const c of chunks) {
    const existing = byVideo.get(c.video_id);
    const score = c.final_score ?? c.similarity;
    const existingScore = existing
      ? (existing.final_score ?? existing.similarity)
      : -Infinity;
    if (!existing || score > existingScore) byVideo.set(c.video_id, c);
  }
  return Array.from(byVideo.values()).map((c) => ({
    videoId: c.video_id,
    title: c.title,
    url: buildYoutubeUrl(c.youtube_id, c.start_sec),
    thumbnailUrl: c.thumbnail_url ?? buildThumbnailUrl(c.youtube_id),
    timestamp: formatTimestamp(c.start_sec),
  }));
}
