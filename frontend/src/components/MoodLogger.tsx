import { useState, useRef } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api/api";

const MoodLogger = ({ userEmail, onClose }: { userEmail: string; onClose: () => void }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 🗣️ Text-to-Speech function
  const speak = (text: string, callback?: () => void) => {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "sv-SE";
    utterance.onend = () => {
      if (callback) callback(); // Execute callback after speaking
    };
    synth.speak(utterance);
  };

  // 🎤 Start recording the user's voice
  const startRecording = async () => {
    setError(null);
    if (isRecording) return;
    setIsRecording(true);

    speak("Hej, hur mår du idag?", async () => {
      await recordUserResponse(); // Start recording after speaking
    });
  };

  // 🎤 Record the user's response
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
      }, 5000); // Stop recording after 5 seconds
    } catch (error) {
      console.error("⚠️ Error during recording:", error);
      setError("Ett fel uppstod vid inspelning. Försök igen.");
      setIsRecording(false);
    }
  };

  // 🎭 Upload the recorded audio to backend
  const uploadAudio = async (blob: Blob) => {
    const formData = new FormData();
    formData.append("audio", blob, "mood_audio.wav");
    formData.append("user_email", userEmail);

    try {
      const response = await axios.post(`${API_BASE_URL}/mood/log`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // If mood is sad, angry, or stressed, ask the user if they want to listen to calming music
      if (["sad","ledsen", "arg", "stressad"].includes(response.data.mood)) {
        setTimeout(() => {
          speak("Jag hör att du kanske känner dig lite nere. Vill du lyssna på lugnande musik?", () => {
            setTimeout(() => {
              // Ask the user if they want to listen to calming music
              const userResponse = window.confirm("Vill du lyssna på lugnande musik?");
              if (userResponse) {
                playCalmMusic(); // Play calming music if user accepts
              } else {
                onClose(); // Close if the user declines
              }
            }, 1000);
          });
        }, 1000); // Delay slightly to ensure everything executes in sequence
      }
    } catch (error: any) {
      console.error("⚠️ Error during mood logging:", error.response?.data?.error || error.message);
      setError("Kunde inte spara humöret. Försök igen senare.");
    }
  };

  // 🎵 Play calming music if the user is sad, angry, or stressed
  const playCalmMusic = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/audio/calm-music.mp3");
    }
    audioRef.current.play();
  };

  return (
    <div className="modal-container">
      <div className="popup-container">
        <h3 className="popup-title">🎭 Logga Humör</h3>
        
        {/* 🔴 Error message */}
        {error && (
          <div className="error-message">
            <p>❌ <strong>{error}</strong></p>
          </div>
        )}
        
        {/* 🎤 Recording button */}
        <div className={`record-circle ${isRecording ? "recording" : ""}`} onClick={startRecording}>
          {isRecording ? "Spelar in..." : "🎭 Börja Logga"}
        </div>

        {/* 🚪 Close button */}
        <button className="close-btn" onClick={onClose}>❌ Stäng</button>
      </div>
    </div>
  );
};

export default MoodLogger;
