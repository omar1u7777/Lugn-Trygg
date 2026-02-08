import React, { useState } from "react";
import { api } from "../api/api";
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';


const MemoryRecorder = ({ userId, onClose, inline = false }: { userId: string; onClose?: () => void; inline?: boolean }) => {
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
          logger.debug('Auto-stopping recording after 5 minutes maximum');
          stopRecording();
        }
      }, 300000); // 5 minutes maximum
    } catch (error) {
      logger.error("⚠️ Fel vid inspelning:", error);
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
      await api.post(API_ENDPOINTS.MEMORY.UPLOAD_MEMORY, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (error: any) {
      logger.error("⚠️ Fel vid uppladdning av minne:", error.response?.data?.error || error.message);
      setError("Kunde inte spara minnet. Försök igen senare.");
    }
  };

  return (
    <div className={inline ? "w-full" : "fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"}>
      <div className={inline
        ? "bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-h-[70vh] flex flex-col"
        : "bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in"
      }>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
          <span className="text-2xl">🎙️</span>
          Spela in Minne
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

        {/* 🎤 Inspelningsknapp */}
        <div
          className={`w-36 h-36 mx-auto rounded-full flex items-center justify-center text-center font-bold text-lg cursor-pointer transition-all duration-300 shadow-lg border-4 mb-6 ${
            isRecording
              ? "bg-red-500 border-red-600 text-white animate-pulse shadow-red-500/50"
              : "bg-primary-500 border-primary-600 text-white hover:bg-primary-600 hover:scale-105 shadow-primary-500/30"
          }`}
          onClick={toggleRecording}
        >
          {isRecording ? "⏹️ Stoppa inspelning" : "🎤 Starta inspelning"}
        </div>

        {/* 🚪 Stäng-knapp */}
        {!inline && (
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
            onClick={onClose}
            aria-label="Stäng"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default MemoryRecorder;
