import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Text, Button, Card, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { COLORS, SPACING } from '../theme/colors';
import { apiService } from '../services/api';

interface MoodLoggerProps {
  visible: boolean;
  onClose: () => void;
  onMoodLogged?: () => void;
}

interface MoodData {
  score: number;
  activities: string[];
  notes: string;
  energy: number;
  sleep_quality: number;
}

const MOOD_OPTIONS = [
  { value: 1, label: 'Mycket Dåligt', emoji: '😢', color: '#EF4444' },
  { value: 2, label: 'Dåligt', emoji: '😞', color: '#F97316' },
  { value: 3, label: 'Okej', emoji: '😐', color: '#FBBF24' },
  { value: 4, label: 'Bra', emoji: '🙂', color: '#A3E635' },
  { value: 5, label: 'Väldigt Bra', emoji: '😄', color: '#10B981' },
  { value: 6, label: 'Utmärkt', emoji: '🤩', color: '#06B6D4' },
  { value: 7, label: 'Fantastiskt', emoji: '🌟', color: '#6366F1' },
  { value: 8, label: 'Lycklig', emoji: '😍', color: '#EC4899' },
  { value: 9, label: 'Överlycklig', emoji: '🎉', color: '#8B5CF6' },
  { value: 10, label: 'Perfekt', emoji: '✨', color: '#14B8A6' },
];

const ACTIVITY_OPTIONS = [
  { id: 'exercise', label: 'Träning', icon: 'run' },
  { id: 'work', label: 'Arbete', icon: 'briefcase' },
  { id: 'socializing', label: 'Socialisering', icon: 'account-multiple' },
  { id: 'relaxation', label: 'Avslappning', icon: 'spa' },
  { id: 'meditation', label: 'Meditation', icon: 'lotus' },
  { id: 'sleep', label: 'Sömn', icon: 'sleep' },
  { id: 'nature', label: 'Natur', icon: 'leaf' },
  { id: 'music', label: 'Musik', icon: 'music' },
  { id: 'reading', label: 'Läsning', icon: 'book' },
  { id: 'family', label: 'Familj', icon: 'heart-multiple' },
];

const MoodLogger: React.FC<MoodLoggerProps> = ({ visible, onClose, onMoodLogged }) => {
  const { user } = useAuth();
  const [moodData, setMoodData] = useState<MoodData>({
    score: 5,
    activities: [],
    notes: '',
    energy: 5,
    sleep_quality: 5,
  });
  const [loading, setLoading] = useState(false);

  const toggleActivity = (activityId: string) => {
    setMoodData((prev) => ({
      ...prev,
      activities: prev.activities.includes(activityId)
        ? prev.activities.filter((a) => a !== activityId)
        : [...prev.activities, activityId],
    }));
  };

  const handleSaveMood = async () => {
    if (!user?.user_id) {
      alert('Du måste vara inloggad');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.post('/moods', {
        user_id: user.user_id,
        score: moodData.score,
        activities: moodData.activities,
        notes: moodData.notes,
        energy: moodData.energy,
        sleep_quality: moodData.sleep_quality,
        timestamp: new Date().toISOString(),
      });

      if (response.status === 200 || response.status === 201) {
        alert('Humöret sparades! 🎉');
        resetForm();
        onMoodLogged?.();
        onClose();
      }
    } catch (error) {
      console.error('Error saving mood:', error);
      alert('Fel när humöret skulle sparas. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMoodData({
      score: 5,
      activities: [],
      notes: '',
      energy: 5,
      sleep_quality: 5,
    });
  };

  const selectedMood = MOOD_OPTIONS.find((m) => m.value === moodData.score);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={28} color={COLORS.text_primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Logga ditt humör</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Mood Score Selector */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Hur mår du?</Text>
              <View style={styles.moodDisplay}>
                <Text style={styles.moodEmoji}>{selectedMood?.emoji}</Text>
                <View>
                  <Text style={styles.moodLabel}>{selectedMood?.label}</Text>
                  <Text style={styles.moodScore}>Poäng: {moodData.score}/10</Text>
                </View>
              </View>

              <View style={styles.sliderContainer}>
                <View style={styles.moodGrid}>
                  {MOOD_OPTIONS.map((mood) => (
                    <TouchableOpacity
                      key={mood.value}
                      style={[
                        styles.moodOption,
                        {
                          backgroundColor:
                            moodData.score === mood.value ? mood.color : COLORS.background_secondary,
                          borderWidth: moodData.score === mood.value ? 3 : 1,
                          borderColor:
                            moodData.score === mood.value ? mood.color : COLORS.border,
                        },
                      ]}
                      onPress={() => setMoodData((prev) => ({ ...prev, score: mood.value }))}
                    >
                      <Text style={styles.moodOptionEmoji}>{mood.emoji}</Text>
                      <Text style={styles.moodOptionValue}>{mood.value}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Energy Level */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Energinivå</Text>
              <View style={styles.levelContainer}>
                <Text style={styles.levelLabel}>Låg</Text>
                <View style={styles.levelSlider}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.levelButton,
                        {
                          backgroundColor:
                            level <= moodData.energy
                              ? COLORS.primary
                              : COLORS.background_secondary,
                        },
                      ]}
                      onPress={() =>
                        setMoodData((prev) => ({ ...prev, energy: level }))
                      }
                    />
                  ))}
                </View>
                <Text style={styles.levelLabel}>Hög</Text>
              </View>
              <Text style={styles.levelValue}>Energi: {moodData.energy}/10</Text>
            </Card.Content>
          </Card>

          {/* Sleep Quality */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Sömnkvalitet</Text>
              <View style={styles.levelContainer}>
                <Text style={styles.levelLabel}>Dålig</Text>
                <View style={styles.levelSlider}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.levelButton,
                        {
                          backgroundColor:
                            level <= moodData.sleep_quality
                              ? COLORS.success
                              : COLORS.background_secondary,
                        },
                      ]}
                      onPress={() =>
                        setMoodData((prev) => ({ ...prev, sleep_quality: level }))
                      }
                    />
                  ))}
                </View>
                <Text style={styles.levelLabel}>Bra</Text>
              </View>
              <Text style={styles.levelValue}>
                Sömnkvalitet: {moodData.sleep_quality}/10
              </Text>
            </Card.Content>
          </Card>

          {/* Activities */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Vad har du gjort idag?</Text>
              <View style={styles.activityGrid}>
                {ACTIVITY_OPTIONS.map((activity) => (
                  <TouchableOpacity
                    key={activity.id}
                    style={[
                      styles.activityButton,
                      {
                        backgroundColor: moodData.activities.includes(activity.id)
                          ? COLORS.primary
                          : COLORS.background_secondary,
                      },
                    ]}
                    onPress={() => toggleActivity(activity.id)}
                  >
                    <MaterialCommunityIcons
                      name={activity.icon as any}
                      size={20}
                      color={
                        moodData.activities.includes(activity.id)
                          ? COLORS.white
                          : COLORS.text_primary
                      }
                    />
                    <Text
                      style={[
                        styles.activityLabel,
                        {
                          color: moodData.activities.includes(activity.id)
                            ? COLORS.white
                            : COLORS.text_primary,
                        },
                      ]}
                    >
                      {activity.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card.Content>
          </Card>

          {/* Notes */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Anteckningar</Text>
              <View
                style={[
                  styles.notesInput,
                  { borderColor: COLORS.border, borderWidth: 1 },
                ]}
              >
                <Text style={styles.notesPlaceholder}>
                  {moodData.notes || 'Lägg till dina tankar och känslor...'}
                </Text>
              </View>
            </Card.Content>
          </Card>

          {/* Save Button */}
          <View style={styles.actionContainer}>
            <Button
              mode="contained"
              onPress={handleSaveMood}
              loading={loading}
              disabled={loading}
              buttonColor={COLORS.primary}
              textColor={COLORS.white}
              style={styles.saveButton}
            >
              Spara humöre
            </Button>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background_primary,
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text_primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  card: {
    marginVertical: SPACING.sm,
    backgroundColor: COLORS.background_secondary,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text_primary,
    marginBottom: SPACING.md,
  },
  moodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  moodEmoji: {
    fontSize: 48,
    marginRight: SPACING.md,
  },
  moodLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text_primary,
  },
  moodScore: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginTop: 4,
  },
  sliderContainer: {
    marginTop: SPACING.md,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  moodOption: {
    width: '19%',
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  moodOptionEmoji: {
    fontSize: 20,
  },
  moodOptionValue: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  levelLabel: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginHorizontal: SPACING.sm,
  },
  levelSlider: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelButton: {
    width: '8%',
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  levelValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text_primary,
    textAlign: 'center',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  activityButton: {
    width: '32%',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activityLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  notesInput: {
    minHeight: 100,
    padding: SPACING.md,
    borderRadius: 8,
    backgroundColor: COLORS.background_primary,
  },
  notesPlaceholder: {
    fontSize: 14,
    color: COLORS.text_secondary,
  },
  actionContainer: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: SPACING.md,
  },
});

export default MoodLogger;
