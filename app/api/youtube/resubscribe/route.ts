import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron target that re-subscribes to the YouTube PubSubHubbub hub.
 *
 * WebSub subscriptions expire after at most 5 days (hub-chosen lease). We run
 * every 3 days via vercel.json cron so the subscription never lapses.
 */

const HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe';
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID ?? '';
const CALLBACK_URL = process.env.PUBSUB_CALLBACK_URL ?? '';
const HMAC_SECRET = process.env.PUBSUB_HMAC_SECRET ?? '';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

export async function GET(req: NextRequest) {
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return new NextResponse('unauthorized', { status: 401 });
    }
  }

  if (!CHANNEL_ID || !CALLBACK_URL) {
    return NextResponse.json(
      { error: 'missing YOUTUBE_CHANNEL_ID or PUBSUB_CALLBACK_URL' },
      { status: 500 },
    );
  }

  const topic = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
  const body = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.topic': topic,
    'hub.callback': CALLBACK_URL,
    'hub.verify': 'async',
    'hub.lease_seconds': '432000',
    ...(HMAC_SECRET ? { 'hub.secret': HMAC_SECRET } : {}),
  });

  const res = await fetch(HUB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const ok = res.status === 202 || res.status === 204;
  return NextResponse.json(
    { status: ok ? 'ok' : 'error', httpStatus: res.status },
    { status: ok ? 200 : 502 },
  );
}
