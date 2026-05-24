import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'sunao-rag-chatbot',
    timestamp: new Date().toISOString(),
  });
}
