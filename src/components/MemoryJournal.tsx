import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api/api';
import { API_ENDPOINTS } from '../api/constants';
import useAuth from '../hooks/useAuth';
import { logger } from '../utils/logger';
import {
  MicrophoneIcon,
  StopIcon,
  PhotoIcon,
  XMarkIcon,
  SparklesIcon,
  ClockIcon,
  TagIcon,
  MapPinIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

// ─── Types ─────────────────────────────────────────────────────────────────

interface PhotoPreview {
  file: File;
  previewUrl: string;
}

interface MemoryEntry {
  id: string;
  contentPreview: string;
  hasAudio: boolean;
  photoCount: number;
  mood?: number;
  tags: string[];
  aiEmotion?: string;
  createdAt: string;
}

interface AiAnalysis {
  primary_emotion: string;
  themes: string[];
  sentiment_score: number;
  significance: number;
  photo_insights: { emotion: string; caption: string }[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const EMOTION_META: Record<string, { emoji: string; label: string; bg: string; text: string }> = {
  joy: { emoji: '😊', label: 'Glädje', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300' },
  sadness: { emoji: '😢', label: 'Sorg', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300' },
  fear: { emoji: '😨', label: 'Rädsla', bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300' },
  anger: { emoji: '😠', label: 'Ilska', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300' },
  neutral: { emoji: '😐', label: 'Neutral', bg: 'bg-slate-50 dark:bg-slate-700/40', text: 'text-slate-700 dark:text-slate-300' },
  calm: { emoji: '😌', label: 'Lugn', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300' },
  positive: { emoji: '✨', label: 'Positiv', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300' },
  negative: { emoji: '💭', label: 'Utmanande', bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-300' },
  growth: { emoji: '🌱', label: 'Tillväxt', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300' },
  connection: { emoji: '🤝', label: 'Samhörighet', bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-700 dark:text-pink-300' },
};

function getEmotionMeta(emotion: string) {
  const key = (emotion || 'neutral').toLowerCase();
  return EMOTION_META[key] ?? EMOTION_META['neutral'];
}

const PRESET_TAGS = ['Familj', 'Vänner', 'Natur', 'Arbete', 'Hälsa', 'Resa', 'Hobby', 'Vila'];

const MAX_PHOTOS = 10;
const MAX_CONTENT = 2000;
const MAX_AUDIO_MINUTES = 5;

// ─── Helper: format duration ─────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Helper: friendly date ───────────────────────────────────────────────────

function friendlyDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

const MemoryJournal: React.FC = () => {
  const { user } = useAuth();

  // Form state
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<number>(5);
  const [moodEnabled, setMoodEnabled] = useState(false);
  const [location, setLocation] = useState('');
  const [showLocation, setShowLocation] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Audio state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Photo state
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AiAnalysis | null>(null);

  // List state
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'create' | 'list'>('create');

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Load memories when switching to list ───────────────────────────────────

  const loadMemories = useCallback(async () => {
    if (!user?.user_id) return;
    setListLoading(true);
    setListError(null);
    try {
      const res = await api.get(`${API_ENDPOINTS.MEMORY_UNIFIED.LIST}/${user.user_id}`);
      setMemories(res.data?.data?.memories ?? []);
    } catch (err: unknown) {
      logger.error('Failed to load memories', { err });
      setListError('Kunde inte ladda minnen. Försök igen.');
    } finally {
      setListLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => {
    if (activeView === 'list') {
      loadMemories();
    }
  }, [activeView, loadMemories]);

  // ── Audio recording ────────────────────────────────────────────────────────

  const startRecording = async () => {
    setAudioError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;

      let elapsed = 0;
      timerRef.current = setInterval(() => {
        elapsed += 1;
        setAudioDuration(elapsed);
        if (elapsed >= MAX_AUDIO_MINUTES * 60) {
          stopRecording();
        }
      }, 1000);

      setIsRecording(true);
    } catch {
      setAudioError('Mikrofonåtkomst nekad. Kontrollera webbläsarbehörigheter.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setAudioDuration(0);
    setAudioError(null);
  };

  // ── Photo upload ───────────────────────────────────────────────────────────

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const files = Array.from(e.target.files ?? []);
    if (photos.length + files.length > MAX_PHOTOS) {
      setPhotoError(`Max ${MAX_PHOTOS} bilder per minne.`);
      return;
    }

    const newPreviews: PhotoPreview[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPreviews]);

    // Reset input so same file can be re-selected
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tags ───────────────────────────────────────────────────────────────────

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    const t = customTag.trim();
    if (t && !selectedTags.includes(t) && selectedTags.length < 20) {
      setSelectedTags((prev) => [...prev, t]);
    }
    setCustomTag('');
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.user_id) return;

    if (!content.trim() && !audioBlob && photos.length === 0) {
      setSubmitError('Lägg till text, röstinspelning eller bilder för att spara ett minne.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setLastResult(null);

    try {
      const formData = new FormData();
      formData.append('content', content.trim());
      if (moodEnabled) formData.append('mood', String(mood));
      if (location.trim()) formData.append('location', location.trim());
      if (selectedTags.length > 0) formData.append('tags', selectedTags.join(','));

      if (audioBlob) {
        formData.append('audio', audioBlob, 'recording.webm');
      }

      photos.forEach((p) => {
        formData.append('photos[]', p.file, p.file.name);
      });

      const res = await api.post(API_ENDPOINTS.MEMORY_UNIFIED.CREATE, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const aiAnalysis: AiAnalysis = res.data?.data?.aiAnalysis ?? null;
      setLastResult(aiAnalysis);

      // Reset form
      setContent('');
      setMood(5);
      setMoodEnabled(false);
      setLocation('');
      setShowLocation(false);
      setSelectedTags([]);
      clearAudio();
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPhotos([]);

      logger.info('Memory saved', { memoryId: res.data?.data?.memoryId });
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error ?? 'Kunde inte spara minnet. Försök igen.';
      setSubmitError(msg);
      logger.error('Memory save failed', { err });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* View Toggle */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-2xl">
        {(['create', 'list'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              activeView === view
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {view === 'create' ? '✨ Nytt Minne' : '📚 Mina Minnen'}
          </button>
        ))}
      </div>

      {/* ── CREATE VIEW ─────────────────────────────────────────────────────── */}
      {activeView === 'create' && (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Success card after save */}
          {lastResult && (
            <div className={`rounded-2xl p-5 border ${getEmotionMeta(lastResult.primary_emotion).bg} border-current/10 animate-fade-in`}>
              <div className="flex items-center gap-3 mb-3">
                <CheckCircleIcon className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                <h3 className="font-bold text-slate-900 dark:text-white">Minne sparat!</h3>
              </div>
              <div className={`flex items-center gap-2 mb-2 ${getEmotionMeta(lastResult.primary_emotion).text}`}>
                <span className="text-2xl">{getEmotionMeta(lastResult.primary_emotion).emoji}</span>
                <span className="font-semibold capitalize">{getEmotionMeta(lastResult.primary_emotion).label}</span>
                {lastResult.significance >= 0.7 && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white/50 font-medium">
                    ⭐ Betydelsefullt minne
                  </span>
                )}
              </div>
              {lastResult.themes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {lastResult.themes.slice(0, 5).map((theme) => (
                    <span key={theme} className="text-xs px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/20 font-medium capitalize">
                      {theme}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setLastResult(null)}
                className="mt-3 text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Stäng
              </button>
            </div>
          )}

          {/* Text Content */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Vad vill du minnas?
            </label>
            <div className="relative">
              <textarea
                rows={6}
                maxLength={MAX_CONTENT}
                className="w-full p-4 text-base leading-relaxed rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none transition-all shadow-inner"
                placeholder="Beskriv stunden, känslan, platsen... Allt är välkommet."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className="absolute bottom-3 right-3 text-xs text-slate-400 font-medium bg-white/60 dark:bg-slate-900/60 px-2 py-0.5 rounded-md backdrop-blur-sm">
                {content.length}/{MAX_CONTENT}
              </div>
            </div>
          </div>

          {/* Audio Recording */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <MicrophoneIcon className="w-4 h-4" />
              Röstinspelning
              <span className="ml-auto text-xs font-normal text-slate-400">max {MAX_AUDIO_MINUTES} min</span>
            </div>

            {audioError && (
              <p className="text-sm text-red-600 dark:text-red-400">{audioError}</p>
            )}

            {!audioBlob ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isRecording ? <StopIcon className="w-4 h-4" /> : <MicrophoneIcon className="w-4 h-4" />}
                  {isRecording ? 'Stoppa' : 'Spela in'}
                </button>

                {isRecording && (
                  <div className="flex items-center gap-2 text-sm font-medium text-red-500">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <ClockIcon className="w-3.5 h-3.5" />
                    {formatDuration(audioDuration)}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-700 dark:text-green-300 text-sm font-medium">
                  <CheckCircleIcon className="w-4 h-4" />
                  Inspelad — {formatDuration(audioDuration)}
                </div>
                <button
                  type="button"
                  onClick={clearAudio}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  aria-label="Ta bort inspelning"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Photo Upload */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <PhotoIcon className="w-4 h-4" />
              Bilder
              <span className="ml-auto text-xs font-normal text-slate-400">{photos.length}/{MAX_PHOTOS}</span>
            </div>

            {photoError && (
              <p className="text-sm text-red-600 dark:text-red-400">{photoError}</p>
            )}

            {/* Photo grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {photos.map((p, idx) => (
                  <div key={idx} className="relative aspect-square group">
                    <img
                      src={p.previewUrl}
                      alt={`Bild ${idx + 1}`}
                      className="w-full h-full object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      aria-label="Ta bort bild"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < MAX_PHOTOS && (
              <>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="memory-photo-input"
                />
                <label
                  htmlFor="memory-photo-input"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer text-sm font-medium transition-all"
                >
                  <PlusIcon className="w-4 h-4" />
                  Lägg till bilder
                </label>
              </>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <TagIcon className="w-4 h-4" />
              Taggar
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedTags.includes(tag)
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            {/* Custom tag */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
                placeholder="Egen tagg..."
                maxLength={50}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button
                type="button"
                onClick={addCustomTag}
                disabled={!customTag.trim()}
                className="px-3 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 transition-all"
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.filter((t) => !PRESET_TAGS.includes(t)).map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-600 text-white text-xs font-medium"
                  >
                    {tag}
                    <button type="button" onClick={() => toggleTag(tag)} aria-label="Ta bort tagg">
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mood + Location (expandable) */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setMoodEnabled((v) => !v)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                moodEnabled
                  ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-rose-300 hover:text-rose-600'
              }`}
            >
              ❤️ {moodEnabled ? `Humör: ${mood}/10` : 'Lägg till humör'}
            </button>
            <button
              type="button"
              onClick={() => setShowLocation((v) => !v)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                showLocation
                  ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-sky-300 hover:text-sky-600'
              }`}
            >
              <MapPinIcon className="w-4 h-4" />
              {showLocation ? 'Plats' : 'Lägg till plats'}
            </button>
          </div>

          {moodEnabled && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Hur mår du just nu? <span className="text-rose-500 font-bold">{mood}/10</span>
              </p>
              <input
                type="range"
                min={1}
                max={10}
                value={mood}
                onChange={(e) => setMood(Number(e.target.value))}
                className="w-full accent-rose-500"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>1 — Väldigt lågt</span>
                <span>10 — Utmärkt</span>
              </div>
            </div>
          )}

          {showLocation && (
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="T.ex. Hemma, Stockholm, Skogen..."
              maxLength={200}
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          )}

          {/* Error */}
          {submitError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
              {submitError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || (!content.trim() && !audioBlob && photos.length === 0)}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/20 transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 text-base"
          >
            {isSubmitting ? (
              <span className="animate-spin text-xl">⏳</span>
            ) : (
              <SparklesIcon className="w-5 h-5" />
            )}
            {isSubmitting ? 'Sparar minne...' : 'Spara Minne'}
          </button>
        </form>
      )}

      {/* ── LIST VIEW ───────────────────────────────────────────────────────── */}
      {activeView === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Dina Minnen
            </h3>
            <button
              onClick={loadMemories}
              disabled={listLoading}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            >
              {listLoading ? 'Laddar...' : 'Uppdatera'}
            </button>
          </div>

          {listError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
              {listError}
            </div>
          )}

          {listLoading && (
            <div className="flex justify-center py-12">
              <span className="animate-spin text-3xl">⏳</span>
            </div>
          )}

          {!listLoading && memories.length === 0 && !listError && (
            <div className="text-center py-16 space-y-3">
              <div className="text-5xl">📭</div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Inga sparade minnen än.</p>
              <button
                onClick={() => setActiveView('create')}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Skapa ditt första minne →
              </button>
            </div>
          )}

          <div className="space-y-3">
            {memories.map((mem) => {
              const emotion = getEmotionMeta(mem.aiEmotion ?? 'neutral');
              return (
                <div
                  key={mem.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    {/* Emotion badge */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${emotion.bg}`}>
                      <span className="text-xl">{emotion.emoji}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Content preview */}
                      {mem.contentPreview ? (
                        <p className="text-slate-800 dark:text-slate-200 text-sm line-clamp-2">
                          {mem.contentPreview}
                        </p>
                      ) : (
                        <p className="text-slate-400 dark:text-slate-500 text-sm italic">
                          {mem.hasAudio ? '🎙 Röstminne' : ''}
                          {mem.photoCount > 0 ? ` 📷 ${mem.photoCount} bild${mem.photoCount > 1 ? 'er' : ''}` : ''}
                        </p>
                      )}

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {friendlyDate(mem.createdAt)}
                        </span>
                        {mem.mood != null && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300 font-medium">
                            ❤️ {mem.mood}/10
                          </span>
                        )}
                        {mem.hasAudio && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300">
                            🎙 Ljud
                          </span>
                        )}
                        {mem.photoCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-300">
                            📷 {mem.photoCount}
                          </span>
                        )}
                        {mem.aiEmotion && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emotion.bg} ${emotion.text}`}>
                            {emotion.emoji} {emotion.label}
                          </span>
                        )}
                      </div>

                      {/* Tags */}
                      {mem.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {mem.tags.slice(0, 5).map((tag) => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {tag}
                            </span>
                          ))}
                          {mem.tags.length > 5 && (
                            <span className="text-xs text-slate-400">+{mem.tags.length - 5}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryJournal;
