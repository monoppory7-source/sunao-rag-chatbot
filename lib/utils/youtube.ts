/** Build a YouTube deep-link that jumps to a specific second. */
export function buildYoutubeUrl(youtubeId: string, startSec: number): string {
  const t = Math.max(0, Math.floor(startSec));
  return `https://youtu.be/${youtubeId}?t=${t}`;
}

export function buildThumbnailUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}
