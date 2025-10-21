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
  const [useTextInput, setUseTextInput] = useState(false);
  const [textMood, setTextMood] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 🆕 Funktion för att spara humör från text-input direkt
  const saveTextMood = async () => {
    if (!textMood.trim()) {
      setError("Vänligen skriv hur du känner dig");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${API_BASE_URL}/api/mood/log`, {
        mood_text: textMood,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        },
      });

      console.log("✅ Humör sparat från text:", response.data);

      // Visa bekräftelse
      setDetectedMood(textMood);
      setError(null);
      
      // Call callback to refresh mood data
      if (onMoodLogged) {
        onMoodLogged();
      }

      // Visa bekräftelsemeddelande
      speak(`Tack! Jag har sparat att du känner dig ${textMood}.`);

      // Check for crisis indicators
      const sentimentScore = response.data.mood_entry?.sentiment_analysis?.score || 0;
      if (sentimentScore < -0.5 && onCrisisDetected) {
        onCrisisDetected(sentimentScore);
      }

      // Stäng efter kort paus
      setTimeout(() => {
        setTextMood("");
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error("⚠️ Fel vid text-humörloggning:", error);
      setError(error.response?.data?.error || "Kunde inte spara humör");
    }
  };

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
    setDetectedMood(null);

    // Play notification sound before speaking
    playNotificationSound();

    // Fråga användaren hur de känner sig
    speak("Hej! Hur mår du just nu? Berätta fritt hur du känner dig.", async () => {
      setTimeout(async () => {
        await recordUserResponse();
      }, 1000);
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
        stream.getTracks().forEach(track => track.stop());
        
        // Analysera och spara direkt till databasen
        await analyzeMoodAndSave(audioBlob);
      };

      mediaRecorder.start();
      
      // Spela in i upp till 10 sekunder
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 10000);
    } catch (error) {
      console.error("⚠️ Fel vid inspelning:", error);
      setError("Kunde inte starta inspelning. Kontrollera mikrofonbehörigheter.");
      setIsRecording(false);
    }
  };

  // 🎭 Analysera humör och spara DIREKT till databasen
  const analyzeMoodAndSave = async (audioBlob: Blob) => {
    setIsRecording(false);
    setIsConfirming(true);
    setError(null);

    try {
      console.log("📤 Skickar ljud för analys och lagring...");

      // Skicka ljudet för analys OCH lagring till backend
      const formData = new FormData();
      formData.append("audio", audioBlob, "mood_audio.webm");
      formData.append("mood_text", ""); // Tom text, backend analyserar rösten
      formData.append("timestamp", new Date().toISOString());

      const token = localStorage.getItem("token");
      const response = await axios.post(`${API_BASE_URL}/api/mood/log`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token && { Authorization: `Bearer ${token}` })
        },
      });

      console.log("✅ Humör analyserat och SPARAT till databasen:", response.data);

      // Hämta det analyserade humöret från response
      const detectedMoodValue = response.data.mood || response.data.ai_analysis?.primary_emotion || 'neutral';
      
      // Översätt till svenska
      const moodTranslations: { [key: string]: string } = {
        'neutral': 'neutral',
        'positive': 'glad',
        'negative': 'ledsen',
        'happy': 'glad',
        'sad': 'ledsen',
        'angry': 'arg',
        'stressed': 'stressad',
        'tired': 'trött',
        'excited': 'upphetsad',
        'calm': 'lugn',
        'joy': 'glad',
        'sadness': 'ledsen',
        'anger': 'arg',
        'fear': 'orolig',
        'surprise': 'förvånad',
        'disgust': 'irriterad',
        'trust': 'lugn',
        'anticipation': 'spännande',
        'glad': 'glad',
        'ledsen': 'ledsen',
        'arg': 'arg',
        'orolig': 'orolig',
        'trött': 'trött',
        'lugn': 'lugn'
      };
      
      const swedishMood = moodTranslations[detectedMoodValue.toLowerCase()] || detectedMoodValue;
      setDetectedMood(swedishMood);

      // Uppdatera mood-listan direkt (callback till Dashboard)
      if (onMoodLogged) {
        onMoodLogged();
      }

      // Kontrollera om det är en krissituation
      const sentimentScore = response.data.ai_analysis?.score || 0;
      if (sentimentScore < -0.5 && onCrisisDetected) {
        onCrisisDetected(sentimentScore);
      }

      // Visa bekräftelse till användaren
      speak(`Tack! Ditt humör "${swedishMood}" har sparats till databasen.`, () => {
        setIsConfirming(false);
        
        // Stäng dialogen automatiskt efter 3 sekunder
        setTimeout(() => {
          onClose();
        }, 3000);
      });

    } catch (error: any) {
      console.error("❌ Fel vid humöranalys och lagring:", error.response?.data || error.message);
      setError("Kunde inte analysera och spara humör. Försök igen.");
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
          const token = localStorage.getItem("token");
          const response = await axios.post(`${API_BASE_URL}/api/mood/confirm`, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
              ...(token && { Authorization: `Bearer ${token}` })
            },
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

  // 🎭 Bekräfta och spara det redan analyserade humöret
  const uploadAudio = async (blob: Blob) => {
    try {
      // Humöret har redan sparats i confirmMood(), så vi behöver bara bekräfta för användaren
      const moodToDisplay = detectedMood || "neutral";

      console.log("✅ Humör bekräftat:", moodToDisplay);

      // Visa bekräftelse för användaren
      speak(`Tack! Ditt humör ${moodToDisplay} är sparat.`, () => {
        // Call the callback to refresh analysis
        if (onMoodLogged) {
          onMoodLogged();
        }
      });

      // Ge empatiskt svar baserat på humör
      if (["ledsen", "arg", "stressad", "trött", "orolig"].includes(moodToDisplay)) {
        setTimeout(() => {
          speak(t('mood.sadResponse') || "Jag förstår. Vill du lyssna på lugn musik?", () => {
            playCalmMusic();
          });
        }, 2000);
      } else if (["glad", "lycklig", "lugn", "upphetsad"].includes(moodToDisplay)) {
        setTimeout(() => {
          speak("Det är underbart att höra att du mår bra!", () => {});
        }, 2000);
      }

      // Återställ state
      setIsConfirming(false);
      setDetectedMood(null);
      setError(null);
      
      // Stäng dialogen efter kort paus
      setTimeout(() => {
        onClose();
      }, 3000);

    } catch (error: any) {
      console.error("⚠️ Fel vid bekräftelse:", error);
      setError("Kunde inte bekräfta humör");
      setIsConfirming(false);
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
          <span className="text-2xl">🎭</span>
          {t('mood.title')}
        </h3>

        {/* 🔴 Felmeddelande */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-300 font-medium">
              <span className="text-lg mr-2">❌</span>
              <strong>{error}</strong>
            </p>
          </div>
        )}

        {/* � Toggle mellan röst och text */}
        {!isConfirming && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setUseTextInput(false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                !useTextInput
                  ? "bg-primary-500 text-white shadow-lg scale-105"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              🎙️ Röst
            </button>
            <button
              onClick={() => setUseTextInput(true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                useTextInput
                  ? "bg-primary-500 text-white shadow-lg scale-105"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              ✍️ Text
            </button>
          </div>
        )}

        {/* �🎤 Inspelningsknapp eller textfält */}
        {useTextInput && !isConfirming ? (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Hur känner du dig?
            </label>
            <textarea
              value={textMood}
              onChange={(e) => setTextMood(e.target.value)}
              placeholder="T.ex. 'Jag känner mig glad och energisk' eller 'Jag är lite orolig'"
              className="w-full h-32 px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-slate-700 dark:text-slate-100 resize-none"
            />
            <button
              onClick={saveTextMood}
              disabled={!textMood.trim()}
              className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
                textMood.trim()
                  ? "bg-primary-500 hover:bg-primary-600 text-white shadow-lg hover:scale-105"
                  : "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
              }`}
            >
              💾 Spara humör
            </button>
          </div>
        ) : !useTextInput && !isConfirming ? (
          <div
            className={`w-36 h-36 mx-auto rounded-full flex items-center justify-center text-center font-bold text-lg cursor-pointer transition-all duration-300 shadow-lg border-4 mb-6 ${
              isRecording
                ? "bg-red-500 border-red-600 text-white animate-pulse shadow-red-500/50"
                : "bg-primary-500 border-primary-600 text-white hover:bg-primary-600 hover:scale-105 shadow-primary-500/30"
            }`}
            onClick={startRecording}
          >
            {isRecording ? t('mood.recording') : t('mood.startRecording')}
          </div>
        ) : null}

        {/* 📊 Visa upptäckt humör under bekräftelse */}
        {isConfirming && detectedMood && (
          <div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 border-2 border-primary-200 dark:border-primary-800 rounded-xl p-6 mb-6 animate-pulse-slow">
            <p className="text-slate-700 dark:text-slate-300 text-center mb-2">
              {t('mood.detectedMood')}:
            </p>
            <p className="text-2xl font-bold text-center text-primary-600 dark:text-primary-400 mb-3">
              {detectedMood}
            </p>
          </div>
        )}

        {/* 🚪 Stäng-knapp */}
        <button
          className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
          onClick={onClose}
          aria-label={t('mood.close')}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default MoodLogger;
