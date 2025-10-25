import { NextRequest, NextResponse } from 'next/server';

// Simple mock login route for development. Replace with real auth logic.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body || {};

    // Basic validation
    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    // Return a fake session token for dev purposes
    return NextResponse.json({
      ok: true,
      user: { id: 'dev-user', email },
      token: 'dev-token-12345',
    });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Auth endpoint available' });
}
