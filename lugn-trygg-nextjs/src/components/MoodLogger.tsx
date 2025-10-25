"use client";
import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { Loading, Alert } from "./UI";

// Minimal migrated MoodLogger adapted for Next.js app
export default function MoodLogger({ userEmail, onClose, onMoodLogged, onCrisisDetected }: {
  userEmail: string;
  onClose: () => void;
  onMoodLogged?: () => void;
  onCrisisDetected?: (score: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [detectedMood, setDetectedMood] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useTextInput, setUseTextInput] = useState(false);
  const [textMood, setTextMood] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { token } = useAuth() as any; // token may be in AuthContext

  const speak = (text: string, callback?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = i18n.language === 'sv' ? 'sv-SE' : i18n.language === 'en' ? 'en-US' : 'nb-NO';
    utterance.onend = () => {
      if (callback) callback();
    };
    synth.speak(utterance);
  };

  const saveTextMood = async () => {
    if (!textMood.trim()) {
      setError("Vänligen skriv hur du känner dig");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/mood/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mood_text: textMood, timestamp: new Date().toISOString() }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetectedMood(textMood);
      if (onMoodLogged) onMoodLogged();
      speak(`Tack! Jag har sparat att du känner dig ${textMood}.`);
      setTimeout(() => {
        setTextMood("");
        setIsSaving(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Fel vid text-humörloggning:', err);
      setError(err.message || 'Kunde inte spara humör');
      setIsSaving(false);
    }
  };

  const startRecording = async () => {
    if (isRecording) return;
    setIsRecording(true);
    setError(null);
    setDetectedMood(null);

    playNotificationSound();

    speak("Hej! Hur mår du just nu? Berätta fritt hur du känner dig.", async () => {
      setTimeout(async () => {
        await recordUserResponse();
      }, 1000);
    });
  };

  const playNotificationSound = () => {
    try {
      const audio = new Audio('/audio/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {
      // ignore
    }
  };

  const recordUserResponse = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        await analyzeMoodAndSave(audioBlob);
      };

      mediaRecorder.start();
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
      }, 10000);
    } catch (err) {
      console.error('Fel vid inspelning:', err);
      setError('Kunde inte starta inspelning. Kontrollera mikrofonbehörigheter.');
      setIsRecording(false);
    }
  };

  const analyzeMoodAndSave = async (audioBlob: Blob) => {
    setIsRecording(false);
    setIsConfirming(true);
    setIsSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'mood_audio.webm');
      formData.append('mood_text', '');
      formData.append('timestamp', new Date().toISOString());

      const res = await fetch('/api/mood/log', {
        method: 'POST',
        body: formData,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        } as any,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const detectedMoodValue = data.mood || data.ai_analysis?.primary_emotion || 'neutral';
      const moodTranslations: { [k: string]: string } = { neutral: 'neutral', positive: 'glad', negative: 'ledsen', happy: 'glad', sad: 'ledsen', angry: 'arg', stressed: 'stressad', tired: 'trött', excited: 'upphetsad', calm: 'lugn' };
      const swedishMood = moodTranslations[detectedMoodValue.toLowerCase()] || detectedMoodValue;
      setDetectedMood(swedishMood);
      if (onMoodLogged) onMoodLogged();
      const sentimentScore = data.ai_analysis?.score || 0;
      if (sentimentScore < -0.5 && onCrisisDetected) onCrisisDetected(sentimentScore);

      speak(`Tack! Ditt humör "${swedishMood}" har sparats till databasen.`, () => {
        setIsConfirming(false);
        setIsSaving(false);
        setTimeout(() => onClose(), 3000);
      });
    } catch (err: any) {
      console.error('Fel vid humöranalys och lagring:', err);
      setError('Kunde inte analysera och spara humör. Försök igen.');
      setIsConfirming(false);
      setIsSaving(false);
    }
  };

  const playCalmMusic = () => {
    if (!audioRef.current) audioRef.current = new Audio('/audio/calm-music.mp3');
    audioRef.current.play().catch(() => {});
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3"><span className="text-2xl">🎭</span>{t ? t('mood.title') : 'Logga humör'}</h3>

        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        {!isConfirming && (
          <div className="flex gap-2 mb-6">
            <button onClick={() => setUseTextInput(false)} className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${!useTextInput ? 'bg-primary-500 text-white shadow-lg scale-105' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>🎙️ Röst</button>
            <button onClick={() => setUseTextInput(true)} className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${useTextInput ? 'bg-primary-500 text-white shadow-lg scale-105' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>✍️ Text</button>
          </div>
        )}

        {useTextInput && !isConfirming ? (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Hur känner du dig?</label>
            <textarea value={textMood} onChange={(e) => setTextMood(e.target.value)} placeholder="T.ex. 'Jag känner mig glad och energisk'" className="w-full h-32 px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-slate-700 dark:text-slate-100 resize-none" />
            <button
              onClick={saveTextMood}
              disabled={!textMood.trim() || isSaving}
              className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${textMood.trim() && !isSaving ? 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg hover:scale-105' : 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed'}`}
            >
              {isSaving ? (
                <>
                  <Loading size="sm" variant="spinner" />
                  Sparar...
                </>
              ) : (
                <>💾 Spara humör</>
              )}
            </button>
          </div>
        ) : !useTextInput && !isConfirming ? (
          <div className={`w-36 h-36 mx-auto rounded-full flex items-center justify-center text-center font-bold text-lg cursor-pointer transition-all duration-300 shadow-lg border-4 mb-6 ${isRecording ? 'bg-red-500 border-red-600 text-white animate-pulse shadow-red-500/50' : 'bg-primary-500 border-primary-600 text-white hover:bg-primary-600 hover:scale-105 shadow-primary-500/30'}`} onClick={startRecording}>
            {isRecording ? (t ? t('mood.recording') : 'Inspelning...') : (t ? t('mood.startRecording') : 'Starta inspelning')}
          </div>
        ) : null}

        {isConfirming && detectedMood && (<div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 border-2 border-primary-200 dark:border-primary-800 rounded-xl p-6 mb-6 animate-pulse-slow"><p className="text-slate-700 dark:text-slate-300 text-center mb-2">{t ? t('mood.detectedMood') : 'Upptäckt humör'}:</p><p className="text-2xl font-bold text-center text-primary-600 dark:text-primary-400 mb-3">{detectedMood}</p></div>)}

        <button className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg" onClick={onClose} aria-label={t ? t('mood.close') : 'Stäng'}>✕</button>
      </div>
    </div>
  );
}
