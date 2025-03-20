import axios from "axios";
import { useState, useRef } from "react";
import { API_BASE_URL } from "../api/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const MemoryRecorder = ({ userId, onClose }: { userId: string; onClose: () => void }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const startRecording = async () => {
    setError(null);
    setAudioChunks([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/mpeg" });
        await uploadAudio(audioBlob);
        setIsRecording(false);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Fel vid inspelning:", err);
      setError("Kunde inte starta inspelningen");
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setIsRecording(false);
  };

  const uploadAudio = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "memory_audio.mp3");
    formData.append("user_id", userId);

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Ingen autentiseringstoken hittades.");
      return;
    }

    try {
      const response = await api.post(`/memory/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,  // 🔑 Skickar JWT-token korrekt!
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("✅ Audio uploaded:", response.data);
    } catch (error: any) {
      console.error("❌ Error uploading audio:", error);
      setError("Kunde inte spara minnet. Försök igen senare.");
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="modal-container">
      <div className="popup-container">
        <h3 className="popup-title">🎙 Spela in Minne</h3>
        
        {error && <div className="error-message">⚠️ {error}</div>}

        <button onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? "⏹ Stoppa inspelning" : "🎤 Börja spela in"}
        </button>

        <button onClick={onClose}>Stäng</button>
      </div>
    </div>
  );
};

export default MemoryRecorder;
