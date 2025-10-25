
require('dotenv').config();

async function testOpenAIChat() {
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return console.log('No OpenAI API key set.');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hej, har jag kredit kvar?' }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) return console.log(data.error?.message || 'Unknown error.');
  console.log(data.choices?.[0]?.message?.content || 'No response.');
}

testOpenAIChat();
