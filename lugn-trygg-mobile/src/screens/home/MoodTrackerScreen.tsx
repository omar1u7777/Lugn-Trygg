import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { healthService } from '../../services/health';
import { COLORS, SPACING } from '../../theme/colors';

const MOOD_EMOJIS = [
  { value: 1, emoji: '😢', label: 'Very Bad' },
  { value: 2, emoji: '😞', label: 'Bad' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '😊', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

const MoodTrackerScreen = () => {
  const [selectedMood, setSelectedMood] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await healthService.addMood(selectedMood, notes || undefined);
      Alert.alert('Success', '✅ Mood entry saved!', [
        {
          text: 'OK',
          onPress: () => {
            setSelectedMood(3);
            setNotes('');
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save mood entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="📊 How are you feeling?" />
        <Card.Content>
          {/* Mood Selection */}
          <View style={styles.moodGrid}>
            {MOOD_EMOJIS.map((mood) => (
              <View key={mood.value} style={styles.moodButtonWrapper}>
                <Button
                  onPress={() => setSelectedMood(mood.value)}
                  style={[
                    styles.moodButton,
                    selectedMood === mood.value && styles.moodButtonSelected,
                  ]}
                >
                  <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                </Button>
                <Text style={styles.moodLabel}>{mood.label}</Text>
              </View>
            ))}
          </View>

          {/* Current Selection */}
          <View style={styles.selectedMoodDisplay}>
            <Text style={styles.selectedMoodText}>
              {MOOD_EMOJIS.find((m) => m.value === selectedMood)?.emoji}
            </Text>
            <Text style={styles.selectedMoodLabel}>
              {MOOD_EMOJIS.find((m) => m.value === selectedMood)?.label}
            </Text>
            <Text style={styles.selectedMoodValue}>{selectedMood}/5</Text>
          </View>

          {/* Notes */}
          <Text style={styles.notesLabel}>📝 Optional Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="How are you really feeling? What's on your mind?"
            placeholderTextColor={COLORS.text_tertiary}
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
          />

          {/* Save Button */}
          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            style={styles.saveButton}
            icon="check"
          >
            Save Mood Entry
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg_secondary,
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.bg_primary,
  },
  moodGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  moodButtonWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  moodButton: {
    flex: 1,
  },
  moodButtonSelected: {
    backgroundColor: COLORS.primary_light,
  },
  moodEmoji: {
    fontSize: 32,
  },
  moodLabel: {
    fontSize: 10,
    color: COLORS.text_secondary,
    marginTop: SPACING.sm,
  },
  selectedMoodDisplay: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.bg_secondary,
    borderRadius: 12,
    marginBottom: SPACING.xl,
  },
  selectedMoodText: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  selectedMoodLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  selectedMoodValue: {
    fontSize: 14,
    color: COLORS.text_secondary,
    marginTop: SPACING.sm,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text_primary,
    marginBottom: SPACING.md,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 14,
    color: COLORS.text_primary,
    marginBottom: SPACING.lg,
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: SPACING.md,
  },
});

export default MoodTrackerScreen;
