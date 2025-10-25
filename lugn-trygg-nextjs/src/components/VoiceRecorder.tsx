import React, { useState, useRef, useEffect } from 'react';
//

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
  // const { user } = useAuth();
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
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
      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err: any) {
      setError('Kunde inte starta inspelning. Kontrollera mikrofonbehörigheter.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const analyzeRecording = async () => {
    if (!audioBlob) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      // Placeholder analysis for Next.js
      setTimeout(() => {
        setAnalysis({
          primary_emotion: 'neutral',
          confidence: 0.7,
          voice_characteristics: { energy_level: 'medium', speech_rate: 'normal', emotional_intensity: 0.5 },
          transcript_sentiment: 'NEUTRAL',
          combined_analysis: 'NEUTRAL',
        });
        setIsAnalyzing(false);
      }, 1000);
    } catch (err: any) {
      setError('Kunde inte analysera inspelningen.');
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
      negative: 'bg-red-100 text-red-800',
    };
    return colors[emotion] || colors.neutral;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        <i className="fas fa-microphone mr-2"></i>
        Röstanalys
      </h3>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
      )}
      {/* Recording Interface */}
      {!audioBlob ? (
        <div className="text-center">
          <div className="mb-6">
            <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-200'}`}> <i className={`fas fa-microphone text-2xl ${isRecording ? 'text-white' : 'text-gray-500'}`}></i> </div>
          </div>
          <div className="space-y-3">
            {!isRecording ? (
              <button onClick={startRecording} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium">
                <i className="fas fa-play mr-2"></i> Starta inspelning
              </button>
            ) : (
              <button onClick={stopRecording} className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-medium">
                <i className="fas fa-stop mr-2"></i> Stoppa inspelning
              </button>
            )}
            <p className="text-sm text-gray-600">
              {isRecording ? 'Prata tydligt i mikrofonen. Klicka på stopp när du är klar.' : 'Klicka för att starta röstanalys. Berätta hur du känner dig.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <audio controls className="w-full" src={URL.createObjectURL(audioBlob)}>
              Din webbläsare stöder inte ljuduppspelning.
            </audio>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vad sa du? (valfritt)</label>
            <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Skriv ner vad du sa för bättre analys..." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
          </div>
          <div className="flex space-x-3">
            <button onClick={analyzeRecording} disabled={isAnalyzing} className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {isAnalyzing ? (<><i className="fas fa-spinner fa-spin mr-2"></i>Analyserar...</>) : (<><i className="fas fa-brain mr-2"></i>Analysera känsla</>)}
            </button>
            <button onClick={resetRecording} className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700">
              <i className="fas fa-redo"></i>
            </button>
          </div>
          {analysis && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border">
              <h4 className="font-semibold text-gray-900 mb-3"><i className="fas fa-chart-bar mr-2"></i>Röstanalys Resultat</h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Primär känsla</div>
                  <div className={`inline-block px-2 py-1 rounded-full text-sm font-medium ${getEmotionColor(analysis.primary_emotion)}`}>{analysis.primary_emotion}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Konfidens</div>
                  <div className="text-lg font-bold text-gray-900">{Math.round(analysis.confidence * 100)}%</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Energisniveau:</span><span className="font-medium">{analysis.voice_characteristics.energy_level}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Talhastighet:</span><span className="font-medium">{analysis.voice_characteristics.speech_rate}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Känslointensitet:</span><span className="font-medium">{Math.round(analysis.voice_characteristics.emotional_intensity * 100)}%</span></div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h5 className="font-medium text-blue-900 mb-2"><i className="fas fa-info-circle mr-2"></i>Om röstanalys</h5>
        <p className="text-sm text-blue-800">Vår AI analyserar din röst för att upptäcka känslomönster baserat på tonläge, talhastighet och energinivå. Detta kombineras med textanalys för bättre noggrannhet.</p>
      </div>
    </div>
  );
};

export default VoiceRecorder;
