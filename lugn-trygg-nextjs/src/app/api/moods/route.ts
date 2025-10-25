import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:54112';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const target = `${BACKEND_URL}/api/moods${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`;

    const headers: Record<string, string> = {};
    const auth = req.headers.get('authorization');
    if (auth) headers['authorization'] = auth;

    const resp = await fetch(target, { method: 'GET', headers });
    const data = await resp.text();

    const response = new NextResponse(data, { status: resp.status, statusText: resp.statusText });
    resp.headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  } catch (err: any) {
    console.error('Proxy GET /api/moods error', err);
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}
