import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { message, user_id } = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'No OpenAI API key configured.' }, { status: 500 });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful therapist chatbot for mental health.' },
          { role: 'user', content: message },
        ],
        user: user_id,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'OpenAI error.' }, { status: response.status });
    }
    return NextResponse.json({ response: data.choices?.[0]?.message?.content || '' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error.' }, { status: 500 });
  }
}
