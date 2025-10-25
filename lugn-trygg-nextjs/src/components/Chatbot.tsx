import React, { useState } from 'react';
import { chatWithAI } from '../services/chatbot';
import useAuth from '../hooks/useAuth';

const Chatbot: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim() || !user?.user_id) return;
    setLoading(true);
    setError(null);
    setMessages((msgs) => [...msgs, { role: 'user', content: input }]);
    try {
      const response = await chatWithAI(input, user.user_id);
      if (response.toLowerCase().includes('insufficient_quota') || response.toLowerCase().includes('credit')) {
        setError('OpenAI-kredit saknas eller har tagit slut. Chattboten kan inte svara.');
      } else {
        setMessages((msgs) => [...msgs, { role: 'assistant', content: response }]);
        setInput('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: 16 }}>
      <h2>Chattbot</h2>
      <div style={{ minHeight: 200, border: '1px solid #ccc', borderRadius: 8, padding: 8, marginBottom: 8 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.role === 'user' ? 'right' : 'left', margin: '8px 0' }}>
            <span style={{ background: msg.role === 'user' ? '#e0e0e0' : '#f5f5f5', padding: 8, borderRadius: 6 }}>{msg.content}</span>
          </div>
        ))}
        {loading && <div>Skickar...</div>}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Skriv din fråga..."
        style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', marginBottom: 8 }}
        disabled={loading}
      />
      <button onClick={sendMessage} disabled={loading || !input.trim()} style={{ width: '100%', padding: 10, borderRadius: 6, background: '#1976d2', color: 'white', fontWeight: 600 }}>
        Skicka
      </button>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  );
};

export default Chatbot;
