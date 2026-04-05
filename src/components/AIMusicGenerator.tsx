import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Soundscape {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  brainwave: string;
  best_for: string[];
}

interface GeneratedTrack {
  track_id: string;
  type: string;
  duration_seconds: number;
  parameters: {
    binaural_frequency: number;
    carrier_frequency: number;
    brainwave_state: string;
  };
  audio_url: string;
  download_url: string;
  created_at: string;
}

interface Recommendation {
  recommended_soundscape: string;
  reasoning: string;
  alternatives?: string[];
}

// ─── Duration options ────────────────────────────────────────────────────────

const DURATIONS = [
  { label: '1 min', labelSv: '1 min', value: 60 },
  { label: '5 min', labelSv: '5 min', value: 300 },
  { label: '10 min', labelSv: '10 min', value: 600 },
  { label: '20 min', labelSv: '20 min', value: 1200 },
];

const MOODS = [
  { id: 'anxious', sv: 'Ångestfylld', en: 'Anxious' },
  { id: 'stressed', sv: 'Stressad', en: 'Stressed' },
  { id: 'tired', sv: 'Trött', en: 'Tired' },
  { id: 'depressed', sv: 'Nedstämd', en: 'Depressed' },
  { id: 'calm', sv: 'Lugn', en: 'Calm' },
  { id: 'energetic', sv: 'Energisk', en: 'Energetic' },
  { id: 'neutral', sv: 'Neutral', en: 'Neutral' },
];

const SOUNDSCAPE_ICONS: Record<string, string> = {
  deep_sleep: '🌙',
  meditation: '🧘',
  focus: '🎯',
  anxiety_relief: '🕊️',
  energy_boost: '⚡',
  nature_sim: '🌿',
  cosmic: '🌌',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchAudioBlob(url: string): Promise<string> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ─── Component ───────────────────────────────────────────────────────────────

export const AIMusicGenerator: React.FC = () => {
  const { i18n } = useTranslation();
  const sv = i18n.language === 'sv';

  // — Soundscape catalogue
  const [soundscapes, setSoundscapes] = useState<Soundscape[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);

  // — Selection
  const [selectedType, setSelectedType] = useState<string>('meditation');
  const [selectedDuration, setSelectedDuration] = useState<number>(300);
  const [selectedMood, setSelectedMood] = useState<string>('');

  // — Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // — Generated track
  const [track, setTrack] = useState<GeneratedTrack | null>(null);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // — Playback
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // — AI Recommendation
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);

  // — Brainwave info panel
  const [showBrainwaveInfo, setShowBrainwaveInfo] = useState(false);

  // ── Load catalogue on mount ───────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingCatalogue(true);
      setCatalogueError(null);
      try {
        const res = await fetch('/api/v1/ai-music/soundscapes', {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (active) setSoundscapes(json.data?.soundscapes ?? []);
      } catch {
        if (active) setCatalogueError(sv ? 'Kunde inte ladda soundscapes.' : 'Failed to load soundscapes.');
      } finally {
        if (active) setLoadingCatalogue(false);
      }
    })();
    return () => { active = false; };
  }, [sv]);

  // ── Audio events ──────────────────────────────────────────────────────────

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onLoadedMetadata = () => setDuration(el.duration);
    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, []);

  // Revoke old blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    };
  }, [audioObjectUrl]);

  // ── Adaptive recommendation ───────────────────────────────────────────────

  const fetchRecommendation = useCallback(async () => {
    setLoadingRec(true);
    setRecommendation(null);
    const hour = new Date().getHours();
    const timeOfDay =
      hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

    try {
      const res = await fetch('/api/v1/ai-music/adaptive-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          current_mood: selectedMood || 'neutral',
          time_of_day: timeOfDay,
          activity: 'relaxing',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rec: Recommendation = json.data;
      setRecommendation(rec);
      if (rec.recommended_soundscape) setSelectedType(rec.recommended_soundscape);
    } catch {
      /* ignore — recommendation is optional */
    } finally {
      setLoadingRec(false);
    }
  }, [selectedMood]);

  // ── 30-second preview ────────────────────────────────────────────────────

  const handlePreview = useCallback(async () => {
    setIsPreviewing(true);
    setGenerateError(null);
    try {
      const url = await fetchAudioBlob(`/api/v1/ai-music/preview/${selectedType}`);
      if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
      setAudioObjectUrl(url);
      setTrack(null);
      const el = audioRef.current;
      if (el) {
        el.src = url;
        el.load();
        await el.play();
      }
    } catch {
      setGenerateError(
        sv ? 'Förhandsvisning misslyckades. Försök igen.' : 'Preview failed. Please try again.'
      );
    } finally {
      setIsPreviewing(false);
    }
  }, [selectedType, audioObjectUrl, sv]);

  // ── Full generation ───────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenerateError(null);
    setTrack(null);
    if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    setAudioObjectUrl(null);

    try {
      // Step 1 – request generation
      const payload: Record<string, unknown> = {
        type: selectedType,
        duration: selectedDuration,
      };
      if (selectedMood) payload.mood = selectedMood;

      const res = await fetch('/api/v1/ai-music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.message ?? (sv ? 'Generering misslyckades.' : 'Generation failed.')
        );
      }

      const json = await res.json();
      const generatedTrack: GeneratedTrack = json.data;
      setTrack(generatedTrack);

      // Step 2 – stream audio into a Blob URL so the <audio> element can play it
      setIsLoadingAudio(true);
      const blobUrl = await fetchAudioBlob(generatedTrack.audio_url);
      setAudioObjectUrl(blobUrl);

      const el = audioRef.current;
      if (el) {
        el.src = blobUrl;
        el.load();
        await el.play();
      }
    } catch (err) {
      setGenerateError(
        err instanceof Error
          ? err.message
          : sv ? 'Något gick fel. Försök igen.' : 'Something went wrong. Try again.'
      );
    } finally {
      setIsGenerating(false);
      setIsLoadingAudio(false);
    }
  }, [selectedType, selectedDuration, selectedMood, audioObjectUrl, sv]);

  // ── Playback controls ─────────────────────────────────────────────────────

  const togglePlayPause = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
    } else {
      await el.play();
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
  }, []);

  const handleDownload = useCallback(() => {
    if (!track) return;
    const a = document.createElement('a');
    // Build a full download URL through the proxy; the browser will save it
    a.href = track.download_url;
    a.download = `lugn-trygg-${track.type}-${track.track_id}.wav`;
    a.click();
  }, [track]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectedSoundscape = soundscapes.find((s) => s.id === selectedType);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="auto" />

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {sv ? '🎵 AI Musikgenerator' : '🎵 AI Music Generator'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {sv
              ? 'Generera personlig meditation med binaural beats och hjärnvågs-entrainment'
              : 'Generate personalised meditation with binaural beats & brainwave entrainment'}
          </p>
        </div>
        <button
          onClick={() => setShowBrainwaveInfo((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          {sv ? 'ℹ️ Om hjärnvågor' : 'ℹ️ About brainwaves'}
        </button>
      </div>

      {/* ── Brainwave info panel ── */}
      {showBrainwaveInfo && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-300 space-y-1.5">
          <p><strong>Delta (0.5–4 Hz)</strong> — {sv ? 'Djup sömn, fysisk återhämtning' : 'Deep sleep, physical recovery'}</p>
          <p><strong>Theta (4–8 Hz)</strong> — {sv ? 'Meditation, kreativitet, ångestlindring' : 'Meditation, creativity, anxiety relief'}</p>
          <p><strong>Alpha (8–13 Hz)</strong> — {sv ? 'Avslappnad fokus, stressreduktion' : 'Relaxed focus, stress reduction'}</p>
          <p><strong>Beta (13–30 Hz)</strong> — {sv ? 'Aktivt tänkande, koncentration' : 'Active thinking, concentration'}</p>
          <p><strong>Gamma (30–100 Hz)</strong> — {sv ? 'Peak performance, djup insikt' : 'Peak performance, deep insight'}</p>
          <p className="text-xs text-slate-500 pt-1">
            {sv
              ? 'Källa: Dr. Gerald Oster (1973), Dr. Jeffrey Thompson, Dr. Alfred Tomatis'
              : 'Sources: Dr. Gerald Oster (1973), Dr. Jeffrey Thompson, Dr. Alfred Tomatis'}
          </p>
        </div>
      )}

      {/* ── Soundscape catalogue ── */}
      {loadingCatalogue ? (
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm py-4">
          <span className="animate-spin">⏳</span>
          {sv ? 'Laddar soundscapes…' : 'Loading soundscapes…'}
        </div>
      ) : catalogueError ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          {catalogueError}
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            {sv ? 'Välj typ av soundscape' : 'Choose soundscape type'}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {soundscapes.map((sc) => {
              const active = sc.id === selectedType;
              return (
                <button
                  key={sc.id}
                  onClick={() => {
                    setSelectedType(sc.id);
                    setGenerateError(null);
                    setRecommendation(null);
                  }}
                  className={`relative rounded-xl p-3 text-left border-2 transition-all ${
                    active
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="text-2xl mb-1">{SOUNDSCAPE_ICONS[sc.id] ?? '🎵'}</div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {sv ? sc.name : sc.name_en}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {sv ? sc.description : sc.description_en}
                  </div>
                  <div className="mt-2 text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 inline-block">
                    {sc.brainwave}
                  </div>
                  {active && (
                    <span className="absolute top-2 right-2 text-indigo-500">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Options row ── */}
      <div className="flex flex-wrap gap-4">
        {/* Duration */}
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-2">
            {sv ? 'Varaktighet' : 'Duration'}
          </label>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setSelectedDuration(d.value)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  selectedDuration === d.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {sv ? d.labelSv : d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mood */}
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-2">
            {sv ? 'Nuvarande humör (valfritt)' : 'Current mood (optional)'}
          </label>
          <select
            value={selectedMood}
            onChange={(e) => setSelectedMood(e.target.value)}
            className="text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">{sv ? '— välj humör —' : '— select mood —'}</option>
            {MOODS.map((m) => (
              <option key={m.id} value={m.id}>{sv ? m.sv : m.en}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── AI Recommendation ── */}
      <div className="flex flex-col gap-2">
        <button
          onClick={fetchRecommendation}
          disabled={loadingRec}
          className="self-start flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 disabled:opacity-50 transition-colors"
        >
          {loadingRec
            ? <span className="animate-spin">⏳</span>
            : <span>✨</span>}
          {sv ? 'AI-rekommendation baserat på humör & tid' : 'AI recommendation based on mood & time'}
        </button>

        {recommendation && (
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl p-3 text-sm text-slate-700 dark:text-slate-300">
            <p className="font-semibold">
              {sv ? '✨ Rekommendation: ' : '✨ Recommendation: '}
              <span className="text-violet-700 dark:text-violet-300">
                {soundscapes.find((s) => s.id === recommendation.recommended_soundscape)?.[sv ? 'name' : 'name_en']
                  ?? recommendation.recommended_soundscape}
              </span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{recommendation.reasoning}</p>
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handlePreview}
          disabled={isPreviewing || isGenerating || loadingCatalogue}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50 transition-colors"
        >
          {isPreviewing
            ? <><span className="animate-spin">⏳</span>{sv ? 'Genererar förhandsgranskning…' : 'Generating preview…'}</>
            : <><span>▶</span>{sv ? '30s förhandsgranskning' : '30s preview'}</>}
        </button>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || isPreviewing || loadingCatalogue}
          className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors shadow-sm"
        >
          {isGenerating
            ? <><span className="animate-spin">⏳</span>{sv ? 'Genererar AI-ljud…' : 'Generating AI audio…'}</>
            : <><span>🎵</span>{sv ? `Generera ${DURATIONS.find(d => d.value === selectedDuration)?.labelSv}` : `Generate ${DURATIONS.find(d => d.value === selectedDuration)?.label}`}</>}
        </button>
      </div>

      {/* ── Error ── */}
      {generateError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
          ⚠️ {generateError}
        </div>
      )}

      {/* ── Audio player ── */}
      {(audioObjectUrl || isLoadingAudio) && (
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 space-y-4">
          {/* Track info */}
          {track && (
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{SOUNDSCAPE_ICONS[track.type] ?? '🎵'}</span>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {soundscapes.find((s) => s.id === track.type)?.[sv ? 'name' : 'name_en'] ?? track.type}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {track.parameters.brainwave_state} · {Math.round(track.duration_seconds / 60)} min
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleDownload}
                title={sv ? 'Ladda ner WAV' : 'Download WAV'}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                ⬇ {sv ? 'Ladda ner' : 'Download'}
              </button>
            </div>
          )}

          {isLoadingAudio ? (
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm py-2">
              <span className="animate-spin">⏳</span>
              {sv ? 'Laddar audio…' : 'Loading audio…'}
            </div>
          ) : (
            <>
              {/* Play/Pause */}
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlayPause}
                  className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center text-xl shadow-md transition-colors"
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>

                {/* Progress bar */}
                <div className="flex-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="w-8 text-right tabular-nums">{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1.5 accent-indigo-600 cursor-pointer"
                  />
                  <span className="w-8 tabular-nums">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Binaural tip */}
              {track && (
                <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg px-3 py-2">
                  🎧 {sv
                    ? `Använd hörlurar för bästa effekt av binaural beats (${track.parameters.binaural_frequency} Hz)`
                    : `Use headphones for best binaural beat effect (${track.parameters.binaural_frequency} Hz)`}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Best-for chips on selected soundscape ── */}
      {selectedSoundscape && (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold">{sv ? 'Passar för: ' : 'Good for: '}</span>
          {selectedSoundscape.best_for.map((tag, i) => (
            <span key={i} className="inline-block mr-1 mb-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIMusicGenerator;
