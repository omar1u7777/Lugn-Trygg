"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const parseTimestamp = (timestamp: string): Date | null => {
  if (!timestamp || timestamp.length !== 14) return null;
  const year = parseInt(timestamp.substring(0, 4));
  const month = parseInt(timestamp.substring(4, 6)) - 1;
  const day = parseInt(timestamp.substring(6, 8));
  const hour = parseInt(timestamp.substring(8, 10));
  const minute = parseInt(timestamp.substring(10, 12));
  const second = parseInt(timestamp.substring(12, 14));
  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));
  return utcDate;
};

export default function MemoryList({ onClose }: { onClose: () => void }) {
  const { user } = useAuth() as any;
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.user_id) return;
    let mounted = true;

    const fetchMemories = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/memories?userId=${encodeURIComponent(user.user_id)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const memoryData = await res.json();
        const mapped = (memoryData || []).map((mem: any) => ({ id: mem.id, title: `Minne ${mem.timestamp || mem.id}`, audioUrl: "", timestamp: mem.timestamp, date: parseTimestamp(mem.timestamp), filePath: mem.file_path }));
        if (!mounted) return;
        setMemories(mapped);
      } catch (err: any) {
        console.error('Fel vid hämtning av minnen:', err);
        if (!mounted) return;
        setError(err.message || "❌ Ett fel uppstod vid hämtning av minnen.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchMemories();
    const interval = setInterval(fetchMemories, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, [user]);

  const loadAudio = async (memory: any) => {
    try {
      const res = await fetch(`/api/memory/url?userId=${encodeURIComponent(user.user_id)}&filePath=${encodeURIComponent(memory.filePath)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMemories(prev => prev.map(m => m.id === memory.id ? { ...m, audioUrl: data.url } : m));
    } catch (err) {
      console.error('Failed to load audio URL:', err);
    }
  };

  const formatDate = (date: Date | null) => date ? date.toLocaleString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Okänd tid';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in max-h-[80vh] flex flex-col">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-3 flex-shrink-0"><span className="text-2xl">💭</span>Dina Minnen</h3>

        {error && (<div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex-shrink-0"><p className="text-red-800 dark:text-red-300 font-medium">❌ {error}</p></div>)}

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><p className="text-slate-600 dark:text-slate-400 text-lg">🔄 Laddar...</p></div>
        ) : memories.length === 0 ? (
          <div className="flex-1 flex items-center justify-center"><p className="text-slate-600 dark:text-slate-400 text-lg">⚠️ <em>Inga minnen sparade ännu.</em></p></div>
        ) : (
          <div className="flex-1 overflow-y-auto"><ul className="space-y-4">{memories.map(memory => (
            <li key={memory.id} className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">📌 {memory.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">📅 {formatDate(memory.date)}</p>
              {memory.audioUrl ? (
                <audio controls className="w-full"><source src={memory.audioUrl} type="audio/mpeg" />Din webbläsare stöder inte uppspelning av ljud.</audio>
              ) : memory.filePath ? (
                <button onClick={() => loadAudio(memory)} className="bg-primary-500 hover:bg-primary-600 text-white px-3 py-1 rounded text-sm transition-colors">🎵 Ladda ljud</button>
              ) : (
                <p className="text-slate-500 dark:text-slate-400 text-sm">🎵 Ljudfilen kunde inte laddas.</p>
              )}
            </li>
          ))}</ul></div>
        )}

        <button className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg flex-shrink-0" onClick={onClose} aria-label="Stäng">✕</button>
      </div>
    </div>
  );
}
