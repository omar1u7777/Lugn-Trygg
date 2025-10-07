import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { API_BASE_URL } from "../api/api";

const MoodLogger = ({ userEmail, onClose, onMoodLogged, onCrisisDetected }: {
  userEmail: string;
  onClose: () => void;
  onMoodLogged?: () => void;
  onCrisisDetected?: (score: number) => void;
}) => {
  const { t, i18n } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 🗣️ Text-to-Speech-funktion
  const speak = (text: string, callback?: () => void) => {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = i18n.language === 'sv' ? 'sv-SE' : i18n.language === 'en' ? 'en-US' : 'nb-NO';
    utterance.onend = () => {
      if (callback) callback();
    };
    synth.speak(utterance);
  };

  // 🎤 Starta inspelning
  const startRecording = async () => {
    if (isRecording) return;
    setIsRecording(true);
    setError(null);

    speak(t('mood.greeting'), async () => {
      setTimeout(async () => {
        await recordUserResponse();
      }, 1000);
    });
  };

  // 🎤 Spela in användarens svar
  const recordUserResponse = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      let chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/wav" });
        await uploadAudio(audioBlob);
        setIsRecording(false);
      };

      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
      }, 5000);
    } catch (error) {
      console.error("⚠️ Fel vid inspelning:", error);
      setError(t('mood.errorRecording'));
      setIsRecording(false);
    }
  };

  // 🎭 Skicka inspelat ljud till backend
  const uploadAudio = async (blob: Blob) => {
    const formData = new FormData();
    formData.append("audio", blob, "mood_audio.wav");
    formData.append("user_email", userEmail);

    try {
      const response = await axios.post(`${API_BASE_URL}/mood/log`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Call the callback to refresh analysis
      if (onMoodLogged) {
        onMoodLogged();
      }

      // Check for crisis indicators based on sentiment score
      const sentimentScore = response.data.ai_analysis?.score || 0;
      if (sentimentScore < 0 && onCrisisDetected) {
        onCrisisDetected(sentimentScore);
      }

      if (["ledsen", "arg", "stressad"].includes(response.data.mood)) {
        setTimeout(() => {
          speak(t('mood.sadResponse'), () => {
            playCalmMusic();
          });
        }, 1000);
      }
    } catch (error: any) {
      console.error("⚠️ Fel vid humörloggning:", error.response?.data?.error || error.message);
      setError(t('mood.errorSave'));
    }
  };

  // 🎵 Spela avslappningsmusik automatiskt om användaren är ledsen
  const playCalmMusic = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/audio/calm-music.mp3");
    }
    audioRef.current.play();
  };

  return (
    <div className="modal-container">
      <div className="popup-container">
        <h3 className="popup-title">{t('mood.title')}</h3>
        
        {/* 🔴 Felmeddelande */}
        {error && (
          <div className="error-message">
            <p>❌ <strong>{error}</strong></p>
          </div>
        )}
        
        {/* 🎤 Inspelningsknapp */}
        <div className={`record-circle ${isRecording ? "recording" : ""}`} onClick={startRecording}>
          {isRecording ? t('mood.recording') : t('mood.startRecording')}
        </div>

        {/* 🚪 Stäng-knapp (Fixad, endast EN ruta och knapp) */}
        <button className="close-btn" onClick={onClose}>{t('mood.close')}</button>
      </div>
    </div>
  );
};

export default MoodLogger;
