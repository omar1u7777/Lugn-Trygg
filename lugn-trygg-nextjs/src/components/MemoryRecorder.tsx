"use client";
import React, { useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function MemoryRecorder({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { token } = useAuth() as any;

  const startRecording = async () => {
    if (isRecording) return;
    setIsRecording(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/mpeg" });
        await uploadAudio(audioBlob);
        setIsRecording(false);
        mediaRecorderRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      // auto stop after 5 minutes
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 300000);
    } catch (err) {
      console.error("Fel vid inspelning:", err);
      setError("Ett fel uppstod vid inspelning. Kontrollera mikrofonbehörigheter.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      if ((mediaRecorderRef.current as any).stream) {
        (mediaRecorderRef.current as any).stream.getTracks().forEach((t: any) => t.stop());
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording(); else startRecording();
  };

  const uploadAudio = async (blob: Blob) => {
    const formData = new FormData();
    formData.append("audio", blob, "memory_audio.mp3");
    formData.append("user_id", userId);

    try {
      const res = await fetch("/api/memory/upload", {
        method: "POST",
        body: formData,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        } as any,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err: any) {
      console.error("Fel vid uppladdning av minne:", err);
      setError(err.message || "Kunde inte spara minnet. Försök igen senare.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3">
          <span className="text-2xl">🎙️</span>
          Spela in Minne
        </h3>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-300 font-medium">❌ {error}</p>
          </div>
        )}

        <div
          className={`w-36 h-36 mx-auto rounded-full flex items-center justify-center text-center font-bold text-lg cursor-pointer transition-all duration-300 shadow-lg border-4 mb-6 ${isRecording ? "bg-red-500 border-red-600 text-white animate-pulse" : "bg-primary-500 border-primary-600 text-white hover:bg-primary-600 hover:scale-105"}`}
          onClick={toggleRecording}
        >
          {isRecording ? "⏹️ Stoppa inspelning" : "🎤 Starta inspelning"}
        </div>

        <button className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg" onClick={onClose} aria-label="Stäng">✕</button>
      </div>
    </div>
  );
}
