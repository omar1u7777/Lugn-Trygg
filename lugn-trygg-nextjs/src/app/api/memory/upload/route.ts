import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:54112';

export async function POST(req: Request) {
  try {
    const target = `${BACKEND_URL}/api/memory/upload`;
    const headers: Record<string, string> = {};
    const auth = req.headers.get('authorization');
    if (auth) headers['authorization'] = auth;

    const body = await req.arrayBuffer();
    const resp = await fetch(target, { method: 'POST', headers, body: body as unknown as BodyInit });
    const respBody = await resp.arrayBuffer();
    const response = new NextResponse(respBody, { status: resp.status, statusText: resp.statusText });
    resp.headers.forEach((v, k) => response.headers.set(k, v));
    return response;
  } catch (err: any) {
    console.error('Proxy POST /api/memory/upload error', err);
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}
