import React, { useState } from 'react';
import { UsageLimitBanner } from './UsageLimitBanner';
import useAuth from '../hooks/useAuth';
import { logMood } from '../api/api';

// Score values are 1-10 (backend scale)
const MOODS = [
  { emoji: '😢', label: 'Ledsen', value: 2 },
  { emoji: '😟', label: 'Orolig', value: 3 },
  { emoji: '😐', label: 'Neutral', value: 5 },
  { emoji: '🙂', label: 'Bra', value: 7 },
  { emoji: '😊', label: 'Glad', value: 8 },
  { emoji: '🤩', label: 'Super', value: 10 },
] as const;

const MAX_NOTE_LENGTH = 200;

interface MoodLoggerProps {
  onMoodLogged?: () => void;
}

const MoodLogger: React.FC<MoodLoggerProps> = ({ onMoodLogged }) => {
  const { user } = useAuth();
  const [selectedMood, setSelectedMood] = useState<(typeof MOODS)[number] | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleMoodSelect = (mood: (typeof MOODS)[number]) => {
    setSelectedMood(mood);
    setSubmitError(null);
    setSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMood || !user?.user_id || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await logMood(user.user_id, {
        score: selectedMood.value,
        mood_text: selectedMood.label,
        note: note.trim() || undefined,
      });
      setSubmitted(true);
      setSelectedMood(null);
      setNote('');
      onMoodLogged?.();
    } catch {
      setSubmitError('Kunde inte logga humör. Kontrollera din anslutning och försök igen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mood-logger">
      <UsageLimitBanner />

      <h2>Hur känns det idag?</h2>

      {submitted && (
        <p role="status" style={{ color: 'green' }}>✓ Humör loggat!</p>
      )}

      <div className="mood-buttons" role="group" aria-label="Välj humör">
        {MOODS.map((mood) => (
          <button
            key={mood.value}
            aria-label={mood.label}
            aria-pressed={selectedMood?.value === mood.value}
            type="button"
            onClick={() => handleMoodSelect(mood)}
            className={selectedMood?.value === mood.value ? 'selected' : ''}
          >
            <span>{mood.emoji}</span>
            <span>{mood.label}</span>
          </button>
        ))}
      </div>

      {selectedMood && (
        <div>
          <p>Valt humör: {selectedMood.label}</p>

          <form onSubmit={handleSubmit}>
            <textarea
              placeholder="Vad får dig att känna så här? (valfritt)"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
              maxLength={MAX_NOTE_LENGTH}
              disabled={isSubmitting}
            />
            <p>{note.length}/{MAX_NOTE_LENGTH} tecken</p>

            {submitError && (
              <p role="alert" style={{ color: 'red' }}>{submitError}</p>
            )}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Loggar…' : 'Logga humör'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default MoodLogger;
