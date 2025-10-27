import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Button, Box, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { analytics } from '../services/analytics';
import { useAccessibility } from '../hooks/useAccessibility';

interface MoodLoggerProps {
  onMoodLogged?: (mood: number, note?: string) => void;
}

const MoodLogger: React.FC<MoodLoggerProps> = ({ onMoodLogged }) => {
  const { t } = useTranslation();
  const { announceToScreenReader } = useAccessibility();
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  useEffect(() => {
    analytics.page('Mood Logger', {
      component: 'MoodLogger',
    });
  }, []);

  const moods = [
    { emoji: '😢', label: 'Ledsen', value: 2, description: 'Känner mig ledsen eller nedstämd' },
    { emoji: '😟', label: 'Orolig', value: 3, description: 'Känner oro eller ångest' },
    { emoji: '😐', label: 'Neutral', value: 5, description: 'Känner mig varken bra eller dåligt' },
    { emoji: '🙂', label: 'Bra', value: 7, description: 'Känner mig ganska bra' },
    { emoji: '😊', label: 'Glad', value: 8, description: 'Känner mig glad och positiv' },
    { emoji: '🤩', label: 'Super', value: 10, description: 'Känner mig fantastisk!' },
  ];

  const handleMoodSelect = (mood: typeof moods[0]) => {
    setSelectedMood(mood.value);
    announceToScreenReader(`Valde humör: ${mood.label}`, 'polite');

    analytics.track('Mood Selected', {
      mood_value: mood.value,
      mood_label: mood.label,
      component: 'MoodLogger',
    });
  };

  const handleLogMood = async () => {
    if (!selectedMood) return;

    setIsLogging(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      analytics.track('Mood Logged', {
        mood_value: selectedMood,
        has_note: note.length > 0,
        component: 'MoodLogger',
      });

      announceToScreenReader('Humör loggat framgångsrikt', 'polite');

      if (onMoodLogged) {
        onMoodLogged(selectedMood, note);
      }

      // Reset form
      setSelectedMood(null);
      setNote('');

    } catch (error) {
      console.error('Failed to log mood:', error);
      announceToScreenReader('Misslyckades att logga humör', 'assertive');
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Hur känns det idag?
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Välj ditt humör och lägg till en anteckning om du vill
        </p>
      </div>

      {/* Mood Selection */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <Typography variant="h6" gutterBottom className="text-center mb-6">
            Välj ditt humör
          </Typography>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {moods.map((mood) => (
              <button
                key={mood.value}
                onClick={() => handleMoodSelect(mood)}
                className={`
                  p-4 rounded-xl border-2 transition-all duration-200 text-center hover:scale-105
                  ${selectedMood === mood.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg'
                    : 'border-gray-200 hover:border-primary-300'
                  }
                `}
                aria-label={`${mood.label}: ${mood.description}`}
                aria-pressed={selectedMood === mood.value}
              >
                <div className="text-4xl mb-2">{mood.emoji}</div>
                <div className="font-medium text-sm">{mood.label}</div>
                <div className="text-xs text-gray-500 mt-1">{mood.value}/10</div>
              </button>
            ))}
          </div>

          {selectedMood && (
            <div className="text-center">
              <Chip
                label={`Valt humör: ${moods.find(m => m.value === selectedMood)?.label}`}
                color="primary"
                className="mb-4"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optional Note */}
      {selectedMood && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <Typography variant="h6" gutterBottom>
              Lägg till en anteckning (valfritt)
            </Typography>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vad får dig att känna så här idag?"
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
              maxLength={200}
            />
            <div className="text-right text-sm text-gray-500 mt-1">
              {note.length}/200
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voice Logging Option */}
      <Card className="mb-6 border-dashed border-2 border-gray-300">
        <CardContent className="p-6 text-center">
          <div className="text-4xl mb-4">🎤</div>
          <Typography variant="h6" gutterBottom>
            Föredrar du att prata?
          </Typography>
          <Typography variant="body2" color="text.secondary" className="mb-4">
            Berätta hur du känner dig med rösten istället
          </Typography>
          <Button variant="outlined" startIcon={<span>🎤</span>}>
            Starta röstloggning
          </Button>
        </CardContent>
      </Card>

      {/* Log Button */}
      {selectedMood && (
        <div className="text-center">
          <Button
            onClick={handleLogMood}
            disabled={isLogging}
            variant="contained"
            size="large"
            className="px-8 py-3 text-lg"
          >
            {isLogging ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                Loggar humör...
              </>
            ) : (
              <>
                <span className="mr-2">✅</span>
                Logga humör
              </>
            )}
          </Button>
        </div>
      )}

      {/* Recent Moods */}
      <Card className="mt-8">
        <CardContent className="p-6">
          <Typography variant="h6" gutterBottom>
            Dina senaste humör
          </Typography>
          <div className="space-y-3">
            {/* Placeholder for recent moods */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-2xl">😊</span>
                <div>
                  <div className="font-medium">Glad</div>
                  <div className="text-sm text-gray-500">Idag 14:30</div>
                </div>
              </div>
              <Chip label="8/10" size="small" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MoodLogger;
