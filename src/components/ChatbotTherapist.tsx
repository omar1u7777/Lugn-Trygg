import React, { useState } from 'react'
import { Card } from './ui/tailwind';
import { chatWithAI } from '../api/api';
import { useAuth } from '../contexts/AuthContext';

const ChatbotTherapist: React.FC = () => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || !user?.user_id) {
      return;
    }

    setLoading(true);
    setError(null);

    const newHistory = [...history, { role: 'user', content: trimmedInput }];
    setHistory(newHistory);
    setInput('');

    try {
      const response = await chatWithAI(user.user_id, trimmedInput);
      setHistory((h) => [
        ...h,
        { role: 'bot', content: response?.response || response?.reply || '...' },
      ]);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error && 'response' in e && typeof e.response === 'object' && e.response && 'data' in e.response && typeof e.response.data === 'object' && e.response.data && 'error' in e.response.data
        ? String(e.response.data.error)
        : e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Chatbot Therapist</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          A compassionate assistant to talk through your feelings. Not a replacement for professional care.
        </p>

        <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
          {history.map((item, idx) => (
            <div key={idx} className={`p-3 rounded-lg ${item.role === 'user' ? 'bg-primary-50 dark:bg-primary-900/20 ml-8' : 'bg-gray-100 dark:bg-gray-700 mr-8'}`}>
              <p className="text-sm text-gray-900 dark:text-white">{item.content}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.role === 'user' ? 'Du' : 'Terapeut'}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Skriv hur du känner"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-600"
          />
          <button
            onClick={sendMessage}
            disabled={!input || loading}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-800 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {loading ? 'Skickar...' : 'Send'}
          </button>
        </div>

        {error && (
          <div className="bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 rounded-lg p-3">
            <p className="text-error-800 dark:text-error-300 text-sm">{error}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ChatbotTherapist;
