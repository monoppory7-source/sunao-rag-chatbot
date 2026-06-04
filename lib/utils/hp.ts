/**
 * Sunao Pharmaceutical HP pages are stored as virtual "videos" with a
 * `youtube_id` like `hp-top`. The frontend needs the real HP URL (not a
 * YouTube watch URL) and a label that calls it a "HPページ" rather than
 * a video.
 *
 * Keep this list in sync with scripts/ingest/ingest_hp.py:PAGES.
 */
export const HP_PAGES = {
  "hp-top": "https://sunao-seiyaku.com/",
  "hp-oem-supplement": "https://sunao-seiyaku.com/oem/oem-supplement/",
  "hp-beginners": "https://sunao-seiyaku.com/beginners/",
  "hp-materials": "https://sunao-seiyaku.com/materials/",
  "hp-case": "https://sunao-seiyaku.com/oem/oem-case/",
} as const;

export function isHpSource(youtubeId: string): boolean {
  return youtubeId.startsWith("hp-");
}

export function hpUrl(youtubeId: string): string {
  return (
    HP_PAGES[youtubeId as keyof typeof HP_PAGES] ?? "https://sunao-seiyaku.com/"
  );
}
