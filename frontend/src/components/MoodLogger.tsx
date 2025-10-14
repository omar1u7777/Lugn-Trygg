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
  const [isConfirming, setIsConfirming] = useState(false);
  const [detectedMood, setDetectedMood] = useState<string | null>(null);
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

    // Play notification sound before speaking
    playNotificationSound();

    speak(t('mood.greeting'), async () => {
      setTimeout(async () => {
        await recordUserResponse();
      }, 1500);
    });
  };

  // 🔊 Play notification sound before recording
  const playNotificationSound = () => {
    try {
      const audio = new Audio('/audio/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Fallback: create beep sound
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.frequency.setValueAtTime(800, context.currentTime);
        oscillator.frequency.setValueAtTime(600, context.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.2);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.2);
      });
    } catch (error) {
      console.log("Notification sound not available, continuing...");
    }
  };

  // 🎤 Spela in användarens svar
  const recordUserResponse = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        await confirmMood(audioBlob);
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

  // 🎭 Bekräfta humör innan sparning
  const confirmMood = async (audioBlob: Blob) => {
    setIsRecording(false);
    setIsConfirming(true);

    try {
      // Först analysera ljudet för att få humör
      const formData = new FormData();
      formData.append("audio", audioBlob, "mood_audio.webm");
      formData.append("user_email", userEmail);
      formData.append("preview", "true"); // Preview mode för att bara få analys

      const response = await axios.post(`${API_BASE_URL}/mood/log`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const detectedMoodValue = response.data.mood;
      setDetectedMood(detectedMoodValue);

      // Fråga användaren om bekräftelse
      speak(`${t('mood.confirmQuestion')} ${detectedMoodValue}? ${t('mood.sayYesOrNo')}`, async () => {
        setTimeout(async () => {
          await listenForConfirmation(audioBlob);
        }, 2000);
      });

    } catch (error: any) {
      console.error("⚠️ Fel vid humöranalys:", error.response?.data?.error || error.message);
      setError(t('mood.errorAnalysis'));
      setIsConfirming(false);
    }
  };

  // 🎤 Lyssna efter ja/nej bekräftelse
  const listenForConfirmation = async (originalAudioBlob: Blob) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const confirmationBlob = new Blob(chunks, { type: "audio/webm" });

        // Analysera bekräftelsen
        const formData = new FormData();
        formData.append("audio", confirmationBlob, "confirmation.webm");
        formData.append("user_email", userEmail);
        formData.append("confirmation", "true");

        try {
          const response = await axios.post(`${API_BASE_URL}/mood/confirm`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          if (response.data.confirmed) {
            // Användaren bekräftade - spara det ursprungliga humöret
            await uploadAudio(originalAudioBlob);
          } else {
            // Användaren nekade - börja om
            speak(t('mood.tryAgain'), () => {
              setIsConfirming(false);
              setDetectedMood(null);
            });
          }
        } catch (error) {
          // Om analys misslyckas, fråga igen
          speak(t('mood.confirmAgain'), () => {
            setTimeout(() => listenForConfirmation(originalAudioBlob), 1000);
          });
        }
      };

      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
      }, 3000); // 3 sekunder för ja/nej

    } catch (error) {
      console.error("⚠️ Fel vid bekräftelse:", error);
      setError(t('mood.errorConfirmation'));
      setIsConfirming(false);
    }
  };

  // 🎭 Skicka inspelat ljud till backend (ursprunglig funktion)
  const uploadAudio = async (blob: Blob) => {
    const formData = new FormData();
    formData.append("audio", blob, "mood_audio.webm");
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

      if (["ledsen", "arg", "stressad", "trött"].includes(response.data.mood)) {
        setTimeout(() => {
          speak(t('mood.sadResponse'), () => {
            playCalmMusic();
          });
        }, 1000);
      }

      // Återställ state
      setIsConfirming(false);
      setDetectedMood(null);

    } catch (error: any) {
      console.error("⚠️ Fel vid humörloggning:", error.response?.data?.error || error.message);
      setError(t('mood.errorSave'));
      setIsConfirming(false);
      setDetectedMood(null);
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
          {isConfirming ? t('mood.confirming') : isRecording ? t('mood.recording') : t('mood.startRecording')}
        </div>

        {/* 📊 Visa upptäckt humör under bekräftelse */}
        {isConfirming && detectedMood && (
          <div className="mood-confirmation">
            <p>{t('mood.detectedMood')}: <strong>{detectedMood}</strong></p>
            <p>{t('mood.sayYesOrNo')}</p>
          </div>
        )}

        {/* 🚪 Stäng-knapp (Fixad, endast EN ruta och knapp) */}
        <button className="close-btn" onClick={onClose}>{t('mood.close')}</button>
      </div>
    </div>
  );
};

export default MoodLogger;
