import React, { useState, useEffect, useRef } from 'react';
import { chatWithAI, getChatHistory } from '../api/api';
import useAuth from '../hooks/useAuth';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  emotions_detected?: string[];
  suggested_actions?: string[];
  crisis_detected?: boolean;
  crisis_analysis?: any;
  ai_generated?: boolean;
  model_used?: string;
}

interface CrisisModalProps {
  isOpen: boolean;
  onClose: () => void;
  crisisAnalysis: any;
}

const CrisisModal: React.FC<CrisisModalProps> = ({ isOpen, onClose, crisisAnalysis }) => {
  if (!isOpen) return null;

  const recommendations = crisisAnalysis?.recommended_actions || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <div className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-semibold">
            AKUT HJÄLP NÖDVÄNDIG
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Viktigt: Sök omedelbar hjälp
        </h3>

        <div className="space-y-3 mb-6">
          {recommendations.map((rec: string, index: number) => (
            <div key={index} className="flex items-start">
              <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">
                {index + 1}
              </span>
              <span className="text-gray-700">{rec}</span>
            </div>
          ))}
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700"
          >
            Jag förstår - Jag söker hjälp nu
          </button>
        </div>
      </div>
    </div>
  );
};

const Chatbot: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [crisisAnalysis, setCrisisAnalysis] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (user?.user_id) {
      loadChatHistory();
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatHistory = async () => {
    if (!user?.user_id) {
      console.log('Chatbot: No user_id available for loading chat history');
      return;
    }

    console.log('Chatbot: Loading chat history for user:', user.user_id);
    try {
      const history = await getChatHistory(user.user_id);
      console.log('Chatbot: Successfully loaded chat history:', history.length, 'messages');
      setMessages(history);
    } catch (error: any) {
      console.error('Chatbot: Failed to load chat history:', error);
      console.error('Chatbot: Error details:', error.response?.data || error.message);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !user?.user_id || isLoading) {
      console.log('Chatbot: Cannot send message - validation failed', {
        hasMessage: !!inputMessage.trim(),
        hasUserId: !!user?.user_id,
        isLoading
      });
      return;
    }

    console.log('Chatbot: Sending message for user:', user.user_id);
    const userMessage: Message = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      console.log('Chatbot: Calling chatWithAI API...');
      const response = await chatWithAI(user.user_id, inputMessage);
      console.log('Chatbot: Received AI response:', {
        hasResponse: !!response.response,
        emotionsDetected: response.emotions_detected,
        crisisDetected: response.crisis_detected,
        modelUsed: response.model_used
      });

      const aiMessage: Message = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
        emotions_detected: response.emotions_detected,
        suggested_actions: response.suggested_actions,
        crisis_detected: response.crisis_detected,
        crisis_analysis: response.crisis_analysis,
        ai_generated: response.ai_generated,
        model_used: response.model_used,
      };

      setMessages(prev => [...prev, aiMessage]);

      // Show crisis modal if crisis detected
      if (response.crisis_detected && response.crisis_analysis) {
        console.log('Chatbot: Crisis detected, showing modal');
        setCrisisAnalysis(response.crisis_analysis);
        setShowCrisisModal(true);
      }

    } catch (error: any) {
      console.error('Chatbot: Failed to send message:', error);
      console.error('Chatbot: Error details:', error.response?.data || error.message);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Förlåt, jag har tekniska problem just nu. Försök igen om en stund.',
        timestamp: new Date().toISOString(),
        ai_generated: false,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 border-b">
        <h2 className="text-xl font-bold text-gray-900">AI-terapeut</h2>
        <p className="text-sm text-gray-600">Din empatiska samtalskompis för mental hälsa</p>
      </div>

      {/* Crisis Modal */}
      <CrisisModal
        isOpen={showCrisisModal}
        onClose={() => setShowCrisisModal(false)}
        crisisAnalysis={crisisAnalysis}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">👋 Välkommen!</p>
            <p>Jag är här för att lyssna och stödja dig. Berätta hur du känner dig idag.</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.crisis_detected
                    ? 'bg-red-100 text-red-900 border border-red-300'
                    : 'bg-white text-gray-900 shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>

                {/* Show emotions detected */}
                {message.emotions_detected && message.emotions_detected.length > 0 && (
                  <div className="mt-2 text-xs opacity-75">
                    Känslor: {message.emotions_detected.join(', ')}
                  </div>
                )}

                {/* Show suggested actions */}
                {message.suggested_actions && message.suggested_actions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.suggested_actions.map((action, idx) => (
                      <div key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        💡 {action}
                      </div>
                    ))}
                  </div>
                )}

                {/* Show AI model info */}
                {message.model_used && (
                  <div className="mt-2 text-xs opacity-50">
                    {message.model_used}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-900 shadow-sm px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t p-4">
        <div className="flex space-x-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Skriv ditt meddelande här..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skicka
          </button>
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Tryck Enter för att skicka, Shift+Enter för ny rad
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
