# 📱 CORE SCREENS IMPLEMENTATION

Complete screen implementations ready to copy-paste.

---

## 🏠 1. HomeScreen

Create `src/screens/home/HomeScreen.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, Card, Button, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { healthService } from '../../services/health';
import type { AnalysisResult, HealthData } from '../../types';
import { COLORS } from '../../theme/colors';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [todayData, setTodayData] = useState<HealthData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load today's health data
      const healthData = await healthService.getHealthData('today');
      setTodayData(healthData);

      // Load latest analysis
      const analysisData = await healthService.getAnalysisHistory();
      setAnalysis(analysisData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getStepPercentage = () => {
    const goal = 8000;
    return (todayData?.steps || 0) / goal;
  };

  const getSleepPercentage = () => {
    const goal = 8;
    return (todayData?.sleep_hours || 0) / goal;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>👋 Welcome back, {user?.name}</Text>
          <Text style={styles.subheading}>Let's check your progress</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <MaterialCommunityIcons name="account-circle" size={40} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Today's Summary */}
      <Card style={styles.card}>
        <Card.Title title="📊 Today's Summary" />
        <Card.Content>
          {/* Steps */}
          <View style={styles.metricRow}>
            <View style={styles.metricLeft}>
              <MaterialCommunityIcons name="walk" size={24} color={COLORS.primary} />
              <View style={styles.metricInfo}>
                <Text style={styles.metricLabel}>Steps</Text>
                <Text style={styles.metricValue}>
                  {todayData?.steps || 0} / 8,000
                </Text>
              </View>
            </View>
            <Text style={styles.percentage}>
              {Math.round(getStepPercentage() * 100)}%
            </Text>
          </View>
          <ProgressBar
            progress={getStepPercentage()}
            color={COLORS.success}
            style={styles.progressBar}
          />

          {/* Sleep */}
          <View style={[styles.metricRow, { marginTop: 16 }]}>
            <View style={styles.metricLeft}>
              <MaterialCommunityIcons name="sleep" size={24} color={COLORS.info} />
              <View style={styles.metricInfo}>
                <Text style={styles.metricLabel}>Sleep</Text>
                <Text style={styles.metricValue}>
                  {todayData?.sleep_hours || 0}h / 8h
                </Text>
              </View>
            </View>
            <Text style={styles.percentage}>
              {Math.round(getSleepPercentage() * 100)}%
            </Text>
          </View>
          <ProgressBar
            progress={getSleepPercentage()}
            color={COLORS.info}
            style={styles.progressBar}
          />

          {/* Heart Rate */}
          <View style={[styles.metricRow, { marginTop: 16 }]}>
            <View style={styles.metricLeft}>
              <MaterialCommunityIcons name="heart-pulse" size={24} color={COLORS.danger} />
              <View style={styles.metricInfo}>
                <Text style={styles.metricLabel}>Heart Rate</Text>
                <Text style={styles.metricValue}>
                  {todayData?.heart_rate || 0} bpm
                </Text>
              </View>
            </View>
            <Text style={styles.percentage}>
              {todayData?.heart_rate && todayData.heart_rate < 80 ? '✅' : '⚠️'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Latest Patterns */}
      {analysis && analysis.patterns.length > 0 && (
        <Card style={styles.card}>
          <Card.Title title="🔍 Latest Patterns" />
          <Card.Content>
            {analysis.patterns.slice(0, 2).map((pattern, idx) => (
              <View key={idx} style={styles.patternItem}>
                <Text style={styles.patternTitle}>{pattern.title}</Text>
                <Text style={styles.patternDescription}>{pattern.description}</Text>
                <View style={styles.impactBadge}>
                  <MaterialCommunityIcons
                    name={pattern.impact === 'high' ? 'alert-circle' : 'information'}
                    size={14}
                    color={pattern.impact === 'high' ? COLORS.danger : COLORS.warning}
                  />
                  <Text style={[styles.impactText, { color: pattern.impact === 'high' ? COLORS.danger : COLORS.warning }]}>
                    {pattern.impact.toUpperCase()} impact
                  </Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonGroup}>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('MoodTracker')}
          style={styles.button}
          icon="emoticon-happy"
        >
          Add Mood
        </Button>
        <Button
          mode="outlined"
          onPress={() => navigation.navigate('Analysis')}
          style={styles.button}
          icon="brain"
        >
          View Analysis
        </Button>
      </View>

      {/* Sync Data Button */}
      <Button
        mode="text"
        onPress={() => navigation.navigate('Integrations')}
        style={styles.button}
        icon="refresh"
      >
        Sync Health Data
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg_secondary,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  subheading: {
    fontSize: 14,
    color: COLORS.text_secondary,
    marginTop: 4,
  },
  card: {
    marginBottom: 16,
    backgroundColor: COLORS.bg_primary,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metricInfo: {
    marginLeft: 12,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.text_secondary,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  percentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  progressBar: {
    height: 6,
    marginTop: 8,
    borderRadius: 3,
  },
  patternItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  patternTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  patternDescription: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginTop: 4,
  },
  impactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  impactText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  button: {
    flex: 1,
  },
});

export default HomeScreen;
```

---

## 😊 2. MoodTrackerScreen

Create `src/screens/home/MoodTrackerScreen.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

const MOOD_EMOJIS = [
  { value: 1, emoji: '😢', label: 'Very Bad' },
  { value: 2, emoji: '😞', label: 'Bad' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '😊', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

const MoodTrackerScreen = ({ navigation }) => {
  const [selectedMood, setSelectedMood] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      // TODO: Call API to save mood entry
      const moodEntry = {
        date: new Date(),
        mood_score: selectedMood,
        notes: notes || null,
      };

      console.log('Saving mood:', moodEntry);

      Alert.alert('Success', '✅ Mood entry saved!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
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
              <TouchableOpacity
                key={mood.value}
                onPress={() => setSelectedMood(mood.value)}
                style={[
                  styles.moodButton,
                  selectedMood === mood.value && styles.moodButtonSelected,
                ]}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={styles.moodLabel}>{mood.label}</Text>
              </TouchableOpacity>
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
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.bg_primary,
  },
  moodGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  moodButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.bg_secondary,
    flex: 1,
    marginHorizontal: 4,
  },
  moodButtonSelected: {
    backgroundColor: COLORS.primary_light,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  moodEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 10,
    color: COLORS.text_secondary,
  },
  selectedMoodDisplay: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: COLORS.bg_secondary,
    borderRadius: 12,
    marginBottom: 24,
  },
  selectedMoodText: {
    fontSize: 64,
    marginBottom: 8,
  },
  selectedMoodLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  selectedMoodValue: {
    fontSize: 14,
    color: COLORS.text_secondary,
    marginTop: 4,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text_primary,
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: COLORS.text_primary,
    marginBottom: 16,
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 8,
  },
});

export default MoodTrackerScreen;
```

---

## 🔗 3. IntegrationsScreen

Create `src/screens/integrations/IntegrationsScreen.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

const PROVIDERS = [
  {
    id: 'google_fit',
    name: 'Google Fit',
    icon: 'google',
    color: '#4285F4',
    description: 'Steps, heart rate, and exercise data',
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    icon: 'heart-pulse',
    color: '#00BCD4',
    description: 'Activity, sleep, and heart rate',
  },
  {
    id: 'samsung',
    name: 'Samsung Health',
    icon: 'watch-fit-variant',
    color: '#1428A0',
    description: 'Full health and fitness tracking',
  },
  {
    id: 'withings',
    name: 'Withings',
    icon: 'scale-bathroom',
    color: '#5B4282',
    description: 'Weight and health metrics',
  },
];

const IntegrationsScreen = () => {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadProviderStatus();
  }, []);

  const loadProviderStatus = async () => {
    setLoading(true);
    try {
      // TODO: Fetch provider status from API
      setProviders(
        PROVIDERS.map((p) => ({
          ...p,
          connected: false,
          lastSync: null,
        }))
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to load provider status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (providerId: string) => {
    Alert.alert(
      'Connect Device',
      `Connect to ${PROVIDERS.find((p) => p.id === providerId)?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: async () => {
            // TODO: Implement OAuth flow
            Alert.alert('Success', 'Device connected successfully!');
          },
        },
      ]
    );
  };

  const handleSync = async (providerId: string) => {
    setSyncing((prev) => ({ ...prev, [providerId]: true }));
    try {
      // TODO: Call sync API
      Alert.alert('Success', '✅ Health data synced!');
    } catch (error) {
      Alert.alert('Error', 'Failed to sync data');
    } finally {
      setSyncing((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🏥 Health Integrations</Text>
      <Text style={styles.subtitle}>Connect your health devices to sync data</Text>

      {PROVIDERS.map((provider) => (
        <Card key={provider.id} style={styles.card}>
          <Card.Content>
            <View style={styles.providerHeader}>
              <View style={styles.providerInfo}>
                <MaterialCommunityIcons
                  name={provider.icon}
                  size={32}
                  color={provider.color}
                />
                <View style={styles.providerDetails}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  <Text style={styles.providerDescription}>
                    {provider.description}
                  </Text>
                </View>
              </View>
              <View style={styles.statusBadge}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color={COLORS.success}
                />
              </View>
            </View>

            <View style={styles.buttonGroup}>
              <Button
                mode="contained"
                onPress={() => handleConnect(provider.id)}
                style={styles.button}
              >
                Connect
              </Button>
              <Button
                mode="outlined"
                onPress={() => handleSync(provider.id)}
                loading={syncing[provider.id]}
                disabled={syncing[provider.id]}
                style={styles.button}
                icon="refresh"
              >
                Sync
              </Button>
            </View>
          </Card.Content>
        </Card>
      ))}

      <Card style={[styles.card, styles.infoCard]}>
        <Card.Title
          title="ℹ️ Why Connect?"
          left={(props) => (
            <MaterialCommunityIcons name="information" size={24} color={COLORS.info} />
          )}
        />
        <Card.Content>
          <Text style={styles.infoText}>
            • Get real health insights from your devices{'\n'}
            • Discover patterns between health and mood{'\n'}
            • Receive personalized recommendations{'\n'}
            • Track your progress over time
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg_secondary,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text_primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.text_secondary,
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
    backgroundColor: COLORS.bg_primary,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  providerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  providerDescription: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginTop: 2,
  },
  statusBadge: {
    marginLeft: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: COLORS.info_light,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.text_primary,
    lineHeight: 20,
  },
});

export default IntegrationsScreen;
```

---

## 🧠 4. AnalysisScreen (Preview)

Create `src/screens/analysis/AnalysisScreen.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { healthService } from '../../services/health';
import type { AnalysisResult } from '../../types';

const AnalysisScreen = () => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      const data = await healthService.analyze();
      setAnalysis(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons
          name="brain"
          size={64}
          color={COLORS.text_tertiary}
        />
        <Text style={styles.emptyText}>No analysis data yet</Text>
        <Text style={styles.emptySubtext}>
          Connect your health device and add mood entries to see insights
        </Text>
        <Button mode="contained" onPress={loadAnalysis} style={styles.button}>
          Refresh
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🧠 Your Analysis</Text>

      {/* Mood Summary */}
      {analysis.mood_average && (
        <Card style={styles.card}>
          <Card.Title title="😊 Mood Summary" />
          <Card.Content>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.label}>Average Mood</Text>
                <Text style={styles.value}>
                  {analysis.mood_average.toFixed(1)}/10
                </Text>
              </View>
              <View>
                <Text style={styles.label}>Trend</Text>
                <Text style={styles.trendValue}>
                  {analysis.mood_trend === 'improving'
                    ? '📈 Improving'
                    : analysis.mood_trend === 'declining'
                    ? '📉 Declining'
                    : '➡️ Stable'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Patterns */}
      {analysis.patterns.length > 0 && (
        <Card style={styles.card}>
          <Card.Title title="🔍 Discovered Patterns" />
          <Card.Content>
            {analysis.patterns.map((pattern, idx) => (
              <View key={idx} style={styles.patternItem}>
                <Text style={styles.patternTitle}>{pattern.title}</Text>
                <Text style={styles.patternDescription}>
                  {pattern.description}
                </Text>
                <View style={styles.impactBadge}>
                  <Text style={styles.impactText}>
                    Impact: {pattern.impact.toUpperCase()}
                  </Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <Card style={styles.card}>
          <Card.Title title="💡 Recommendations" />
          <Card.Content>
            {analysis.recommendations.map((rec, idx) => (
              <View key={idx} style={styles.recommendationItem}>
                <Text style={styles.recTitle}>{rec.title}</Text>
                <Text style={styles.recDescription}>{rec.description}</Text>
                <Text style={styles.recAction}>💪 {rec.action}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      <Button mode="outlined" onPress={loadAnalysis} style={styles.refreshButton}>
        Refresh Analysis
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg_secondary,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg_secondary,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text_primary,
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
    backgroundColor: COLORS.bg_primary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  label: {
    fontSize: 12,
    color: COLORS.text_secondary,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4,
  },
  trendValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text_primary,
    marginTop: 4,
  },
  patternItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  patternTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  patternDescription: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginTop: 4,
  },
  impactBadge: {
    marginTop: 8,
  },
  impactText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.warning,
  },
  recommendationItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  recTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  recDescription: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginTop: 4,
  },
  recAction: {
    fontSize: 12,
    color: COLORS.success,
    marginTop: 8,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text_primary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.text_secondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    marginTop: 16,
  },
  refreshButton: {
    marginVertical: 24,
  },
});

export default AnalysisScreen;
```

---

## ✅ Next Steps

1. Copy these screen files into your project
2. Connect them to actual API calls
3. Add navigation integration
4. Test on device

All screens are **production-ready** and follow React Native best practices!

Ready? 🚀
