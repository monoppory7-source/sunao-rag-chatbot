import { NextResponse, type NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * YouTube PubSubHubbub (WebSub) webhook.
 *
 * GET  — Hub verification handshake. We echo `hub.challenge` back as text/plain
 *        iff the topic matches the channel we care about.
 *
 * POST — Push notification with an Atom XML payload. YouTube signs the body
 *        with HMAC-SHA1 using the shared `PUBSUB_HMAC_SECRET`; we verify it,
 *        parse the first `<yt:videoId>…</yt:videoId>`, then kick off a
 *        single-video backfill run of the ingest pipeline via the GitHub
 *        Actions REST API (`workflow_dispatch`).
 */

const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID ?? '';
const TOPIC_URL = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const HMAC_SECRET = process.env.PUBSUB_HMAC_SECRET ?? '';
const GH_TOKEN = process.env.GH_DISPATCH_TOKEN ?? '';
const GH_REPO = process.env.GH_REPO ?? '';
const GH_WORKFLOW = process.env.GH_WORKFLOW_FILE ?? 'ingest.yml';
const GH_REF = process.env.GH_WORKFLOW_REF ?? 'main';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const topic = url.searchParams.get('hub.topic');
  const challenge = url.searchParams.get('hub.challenge');

  if (!mode || !topic || !challenge) {
    return new NextResponse('missing params', { status: 400 });
  }
  if (topic !== TOPIC_URL) {
    return new NextResponse('topic mismatch', { status: 404 });
  }
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  if (HMAC_SECRET) {
    const sigHeader = req.headers.get('x-hub-signature') ?? '';
    const expected =
      'sha1=' + createHmac('sha1', HMAC_SECRET).update(bodyText).digest('hex');
    const okLen = sigHeader.length === expected.length;
    const okEq =
      okLen && timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected));
    if (!okEq) return new NextResponse('invalid signature', { status: 403 });
  }

  const videoIdMatch = bodyText.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
  const videoId = videoIdMatch?.[1]?.trim();
  if (!videoId) return new NextResponse('no video id', { status: 200 });

  if (!GH_TOKEN || !GH_REPO) {
    console.error('[yt-webhook] missing GH_DISPATCH_TOKEN / GH_REPO');
    return new NextResponse('server misconfig', { status: 500 });
  }

  const dispatchRes = await fetch(
    `https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: GH_REF, inputs: { video_ids: videoId } }),
    },
  );

  if (!dispatchRes.ok) {
    const detail = await dispatchRes.text().catch(() => '');
    console.error(
      `[yt-webhook] dispatch failed ${dispatchRes.status}: ${detail.slice(0, 300)}`,
    );
    return new NextResponse('dispatch failed', { status: 502 });
  }

  return NextResponse.json({ status: 'queued', videoId });
}
