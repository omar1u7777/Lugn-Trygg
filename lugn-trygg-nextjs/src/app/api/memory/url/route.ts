import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:54112';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const filePath = url.searchParams.get('filePath');
    if (!userId || !filePath) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const target = `${BACKEND_URL}/api/memory/url?userId=${encodeURIComponent(userId)}&filePath=${encodeURIComponent(filePath)}`;
    const headers: Record<string, string> = {};
    const auth = req.headers.get('authorization');
    if (auth) headers['authorization'] = auth;

    const resp = await fetch(target, { method: 'GET', headers });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err: any) {
    console.error('Proxy GET /api/memory/url error', err);
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}
