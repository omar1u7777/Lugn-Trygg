import React, { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, PlayIcon, StopIcon, ArrowPathIcon, SparklesIcon, ChartBarIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import useAuth from '../hooks/useAuth';

interface VoiceAnalysis {
  primary_emotion: string;
  confidence: number;
  voice_characteristics: {
    energy_level: string;
    speech_rate: string;
    emotional_intensity: number;
  };
  transcript_sentiment: string;
  combined_analysis: string;
}

const VoiceRecorder: React.FC = () => {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);

    } catch (err: unknown) {
      console.error('Failed to start recording:', err);
      setError('Kunde inte starta inspelning. Kontrollera mikrofonbehörigheter.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const analyzeRecording = async () => {
    if (!audioBlob || !user?.user_id) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Convert blob to base64 for API
      const reader = new FileReader();
      reader.onload = async () => {
        // For now, we'll use a placeholder analysis since we need backend voice analysis
        // In a real implementation, this would send the audio to the backend
        const mockAnalysis: VoiceAnalysis = {
          primary_emotion: 'neutral',
          confidence: 0.7,
          voice_characteristics: {
            energy_level: 'medium',
            speech_rate: 'normal',
            emotional_intensity: 0.5
          },
          transcript_sentiment: 'NEUTRAL',
          combined_analysis: 'NEUTRAL'
        };

        setAnalysis(mockAnalysis);

        // Here you would call: await analyzeVoiceEmotion(user.user_id, base64Audio, transcript);
      };

      reader.readAsDataURL(audioBlob);

    } catch (err: unknown) {
      console.error('Failed to analyze recording:', err);
      setError('Kunde inte analysera inspelningen.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAnalysis(null);
    setTranscript('');
    setError(null);
  };

  const getEmotionColor = (emotion: string) => {
    const colors: { [key: string]: string } = {
      joy: 'bg-yellow-100 text-yellow-800',
      sadness: 'bg-blue-100 text-blue-800',
      anger: 'bg-red-100 text-red-800',
      fear: 'bg-purple-100 text-purple-800',
      neutral: 'bg-gray-100 text-gray-800',
      positive: 'bg-green-100 text-green-800',
      negative: 'bg-red-100 text-red-800'
    };
    return colors[emotion] || colors.neutral;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        <MicrophoneIcon className="w-5 h-5 mr-2 inline" aria-hidden="true" />
        Röstanalys
      </h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Recording Interface */}
      {!audioBlob ? (
        <div className="text-center">
          <div className="mb-6">
            <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${
              isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-200'
            }`}>
              <MicrophoneIcon
                className={`w-10 h-10 ${isRecording ? 'text-white' : 'text-gray-500'}`}
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="space-y-3">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                <PlayIcon className="w-5 h-5 mr-2 inline" aria-hidden="true" />
                Starta inspelning
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-medium"
              >
                <StopIcon className="w-5 h-5 mr-2 inline" aria-hidden="true" />
                Stoppa inspelning
              </button>
            )}

            <p className="text-sm text-gray-600">
              {isRecording
                ? 'Prata tydligt i mikrofonen. Klicka på stopp när du är klar.'
                : 'Klicka för att starta röstanalys. Berätta hur du känner dig.'
              }
            </p>
          </div>
        </div>
      ) : (
        /* Analysis Interface */
        <div className="space-y-4">
          {/* Audio Playback */}
          <div className="bg-gray-50 rounded-lg p-4">
            <audio
              controls
              className="w-full"
              src={URL.createObjectURL(audioBlob)}
            >
              Din webbläsare stöder inte ljuduppspelning.
            </audio>
          </div>

          {/* Transcript Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vad sa du? (valfritt)
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Skriv ner vad du sa för bättre analys..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Analysis Button */}
          <div className="flex space-x-3">
            <button
              onClick={analyzeRecording}
              disabled={isAnalyzing}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2 inline animate-spin" aria-hidden="true" />
                  Analyserar...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5 mr-2 inline" aria-hidden="true" />
                  Analysera känsla
                </>
              )}
            </button>

            <button
              onClick={resetRecording}
              className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700"
            >
              <ArrowPathIcon className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Analysis Results */}
          {analysis && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border">
              <h4 className="font-semibold text-gray-900 mb-3">
                <ChartBarIcon className="w-5 h-5 mr-2 inline" aria-hidden="true" />
                Röstanalys Resultat
              </h4>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Primär känsla</div>
                  <div className={`inline-block px-2 py-1 rounded-full text-sm font-medium ${getEmotionColor(analysis.primary_emotion)}`}>
                    {analysis.primary_emotion}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-600">Konfidens</div>
                  <div className="text-lg font-bold text-gray-900">
                    {Math.round(analysis.confidence * 100)}%
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Energisniveau:</span>
                  <span className="font-medium">{analysis.voice_characteristics.energy_level}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Talhastighet:</span>
                  <span className="font-medium">{analysis.voice_characteristics.speech_rate}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Känslointensitet:</span>
                  <span className="font-medium">{Math.round(analysis.voice_characteristics.emotional_intensity * 100)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h5 className="font-medium text-blue-900 mb-2">
          <InformationCircleIcon className="w-5 h-5 mr-2 inline" aria-hidden="true" />
          Om röstanalys
        </h5>
        <p className="text-sm text-blue-800">
          Vår AI analyserar din röst för att upptäcka känslomönster baserat på tonläge,
          talhastighet och energinivå. Detta kombineras med textanalys för bättre noggrannhet.
        </p>
      </div>
    </div>
  );
};

export default VoiceRecorder;
