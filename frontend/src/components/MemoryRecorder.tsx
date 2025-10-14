import React, { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api/api";

const MemoryRecorder = ({ userId, onClose }: { userId: string; onClose: () => void }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const startRecording = async () => {
    if (isRecording) return;
    setIsRecording(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/mpeg" });
        await uploadAudio(audioBlob);
        setIsRecording(false);
        setMediaRecorder(null);
      };

      setMediaRecorder(recorder);
      recorder.start();

      // Maximum recording time of 5 minutes to prevent extremely long recordings
      setTimeout(() => {
        if (isRecording && recorder.state === 'recording') {
          console.log('Auto-stopping recording after 5 minutes maximum');
          stopRecording();
        }
      }, 300000); // 5 minutes maximum
    } catch (error) {
      console.error("⚠️ Fel vid inspelning:", error);
      setError("Ett fel uppstod vid inspelning. Försök igen.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      // Stop all tracks to release microphone
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const uploadAudio = async (blob: Blob) => {
    const formData = new FormData();
    formData.append("audio", blob, "memory_audio.mp3");
    formData.append("user_id", userId);

    try {
      await axios.post(`${API_BASE_URL}/memory/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (error: any) {
      console.error("⚠️ Fel vid uppladdning av minne:", error.response?.data?.error || error.message);
      setError("Kunde inte spara minnet. Försök igen senare.");
    }
  };

  return (
    <div className="modal-container">
      <div className="popup-container">
        <h3 className="popup-title">🎙 Spela in Minne</h3>

        {/* 🔴 Felmeddelande */}
        {error && (
          <div className="error-message">
            <p>❌ <strong>{error}</strong></p>
          </div>
        )}

        {/* 🎤 Inspelningsknapp */}
        <div className={`record-circle ${isRecording ? "recording" : ""}`} onClick={toggleRecording}>
          {isRecording ? "⏹️ Stoppa inspelning" : "🎤 Starta inspelning"}
        </div>

        {/* 🚪 Stäng-knapp (Fixad, endast EN ruta och knapp) */}
        <button className="close-btn" onClick={onClose}>❌ Stäng</button>
      </div>
    </div>
  );
};

export default MemoryRecorder;
