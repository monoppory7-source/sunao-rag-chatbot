import { createHash } from 'crypto';

/**
 * Normalise a user query so that semantically identical inputs
 * collapse to the same cache key (Step 4 — L2 exact-match cache).
 */
export function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[？!！。.、,?]/g, '')
    .replace(/[ァ-ン]/g, (m) =>
      String.fromCharCode(m.charCodeAt(0) - 0x60),
    );
}

export function hashQuery(q: string): string {
  return createHash('sha256').update(normalizeQuery(q)).digest('hex');
}
