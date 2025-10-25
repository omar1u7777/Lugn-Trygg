export async function chatWithAI(message: string, userId: string): Promise<string> {
  const res = await fetch('/api/chatbot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, user_id: userId }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.response;
}
