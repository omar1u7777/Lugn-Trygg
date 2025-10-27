import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, Typography, Button, Box, TextField, Chip, Avatar } from '@mui/material';
import { Mic, MicOff, Send, Stop, VolumeUp } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';

interface VoiceChatProps {
  onMessageSent?: (message: string, isVoice: boolean) => void;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isVoice?: boolean;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ onMessageSent }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hej! Jag är din AI-terapeut. Hur känns det idag? Du kan prata med mig genom att trycka på mikrofon-knappen eller skriva.',
      isUser: false,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quickActions] = useState([
    'Jag känner mig stressad idag',
    'Hjälp mig med mindfulness',
    'Berätta en lugnande historia',
    'Vad kan jag göra för bättre sömn?',
    'Jag känner mig orolig',
    'Hjälp mig förstå mina känslor',
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    analytics.page('Voice Chat', {
      component: 'VoiceChat',
    });

    scrollToBottom();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      announceToScreenReader('Röstinspelning startad', 'polite');

      analytics.track('Voice Recording Started', {
        component: 'VoiceChat',
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      announceToScreenReader('Kunde inte starta röstinspelning', 'assertive');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      announceToScreenReader('Röstinspelning stoppad', 'polite');

      analytics.track('Voice Recording Stopped', {
        component: 'VoiceChat',
      });
    }
  };

  const processVoiceMessage = async (audioBlob: Blob) => {
    setIsProcessing(true);
    announceToScreenReader('Bearbetar röstmeddelande...', 'polite');

    try {
      // Simulate voice-to-text processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock voice-to-text result
      const text = 'Jag känner mig lite stressad idag och behöver hjälp att koppla av.';

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        text,
        isUser: true,
        timestamp: new Date(),
        isVoice: true,
      };

      setMessages(prev => [...prev, userMessage]);

      // Simulate AI response
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Jag hör att du känner dig stressad idag. Det är helt normalt att känna så ibland. Låt mig hjälpa dig med några enkla tekniker för att koppla av. Först, försök ta tre djupa andetag...',
          isUser: false,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, aiResponse]);
        announceToScreenReader('AI svar mottaget', 'polite');
      }, 1000);

      analytics.track('Voice Message Processed', {
        component: 'VoiceChat',
        messageLength: text.length,
      });

      if (onMessageSent) {
        onMessageSent(text, true);
      }

    } catch (error) {
      console.error('Error processing voice message:', error);
      announceToScreenReader('Kunde inte bearbeta röstmeddelande', 'assertive');
    } finally {
      setIsProcessing(false);
    }
  };

  const sendTextMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
      isVoice: false,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    analytics.track('Text Message Sent', {
      component: 'VoiceChat',
      messageLength: inputText.length,
    });

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Tack för att du delar det med mig. Det låter viktigt. Kan du berätta mer om vad som får dig att känna så?',
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiResponse]);
    }, 1500);

    if (onMessageSent) {
      onMessageSent(inputText, false);
    }
  };

  const handleQuickAction = (action: string) => {
    setInputText(action);
    analytics.track('Quick Action Used', {
      component: 'VoiceChat',
      action,
    });
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendTextMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          AI Terapeut
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Prata med din personliga AI - använd röst eller text
        </p>
      </div>

      {/* Chat Messages */}
      <Card className="flex-1 mb-4 overflow-hidden">
        <CardContent className="p-0 h-full flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[80%] ${message.isUser ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <Avatar
                    className={message.isUser ? 'bg-primary-500' : 'bg-secondary-500'}
                    sx={{ width: 40, height: 40 }}
                  >
                    {message.isUser ? '👤' : '🤖'}
                  </Avatar>

                  {/* Message bubble */}
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.isUser
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}>
                    <Typography variant="body1" className="whitespace-pre-wrap">
                      {message.text}
                    </Typography>

                    <div className="flex items-center gap-2 mt-2">
                      <Typography variant="caption" className="opacity-70">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>

                      {message.isVoice && (
                        <Chip
                          label="🎤 Röst"
                          size="small"
                          variant="outlined"
                          className="text-xs"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[80%]">
                  <Avatar className="bg-secondary-500" sx={{ width: 40, height: 40 }}>
                    🤖
                  </Avatar>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <Typography variant="body2" className="text-gray-500">
                        Bearbetar...
                      </Typography>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Typography variant="subtitle2" gutterBottom className="text-gray-700 dark:text-gray-300">
              Snabba frågor:
            </Typography>
            <div className="flex flex-wrap gap-2 mb-4">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(action)}
                  className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Input Area */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            {/* Voice Input */}
            <Button
              variant={isRecording ? "contained" : "outlined"}
              color={isRecording ? "error" : "primary"}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className="min-w-[60px]"
              aria-label={isRecording ? "Stoppa inspelning" : "Starta röstinspelning"}
            >
              {isRecording ? <Stop /> : <Mic />}
            </Button>

            {/* Text Input */}
            <TextField
              fullWidth
              multiline
              maxRows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Skriv ditt meddelande här..."
              disabled={isProcessing}
              className="flex-1"
            />

            {/* Send Button */}
            <Button
              variant="contained"
              onClick={sendTextMessage}
              disabled={!inputText.trim() || isProcessing}
              aria-label="Skicka meddelande"
            >
              <Send />
            </Button>
          </div>

          {/* Recording Status */}
          {isRecording && (
            <div className="mt-3 flex items-center gap-2 text-red-600">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
              <Typography variant="body2">
                Spelar in... Tryck på stopp-knappen för att avsluta.
              </Typography>
            </div>
          )}

          {/* Voice Tips */}
          <div className="mt-3 text-center">
            <Typography variant="caption" className="text-gray-500">
              💡 Tips: Prata naturligt - AI:n förstår svenska och engelska
            </Typography>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceChat;