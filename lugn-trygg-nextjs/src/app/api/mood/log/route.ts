import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:54112';

export async function POST(req: Request) {
  try {
    const target = `${BACKEND_URL}/api/mood/log`;

    // Forward headers we care about
    const headers: Record<string, string> = {};
    const contentType = req.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;
    const auth = req.headers.get('authorization');
    if (auth) headers['authorization'] = auth;

    // Forward the request body as a stream/arrayBuffer
    const body = await req.arrayBuffer();

    const resp = await fetch(target, {
      method: 'POST',
      headers,
      body: body as unknown as BodyInit,
    });

    const respBody = await resp.arrayBuffer();
    const response = new NextResponse(respBody, {
      status: resp.status,
      statusText: resp.statusText,
    });
    // copy response headers
    resp.headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  } catch (err: any) {
    console.error('Proxy POST /api/mood/log error', err);
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}
