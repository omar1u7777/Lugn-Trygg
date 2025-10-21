import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Avatar, Button, Card, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios, { AxiosError } from 'axios';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SPACING, TYPOGRAPHY } from '../../theme/colors';

// ✅ FIX: Set correct API URL - use localhost (NOT 192.168.x.x which causes CORS)
const API_BASE_URL = 'http://localhost:5001';

const apiService = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Allow credentials for CORS
  withCredentials: false,
});

// Interceptor for Bearer token
apiService.interceptors.request.use((config) => {
  const token = localStorage?.getItem?.('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface Mood {
  id: string;
  score: number;
  label: string;
  activity: string;
  energy: number;
  sleep: number;
  notes: string;
  timestamp: string;
  date: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const [moods, setMoods] = useState<Mood[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [showMoodLogger, setShowMoodLogger] = useState(false);
  const [showMoodList, setShowMoodList] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [showSounds, setShowSounds] = useState(false);

  // Mood Logger state
  const [moodScore, setMoodScore] = useState(5);
  const [selectedActivity, setSelectedActivity] = useState('Träning');
  const [energy, setEnergy] = useState(5);
  const [sleep, setSleep] = useState(5);
  const [notes, setNotes] = useState('');
  const [savingMood, setSavingMood] = useState(false);

  // Chatbot state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  const activities = ['Träning', 'Arbete', 'Meditation', 'Läsning', 'Socialt', 'Vila', 'Hemma', 'Skapande', 'Studie', 'Annat'];

  // ✅ Fetch moods on mount
  useEffect(() => {
    loadMoods();
  }, []);

  const loadMoods = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      console.log('📥 Fetching moods from:', `${API_BASE_URL}/api/mood`);
      const response = await apiService.get('/api/mood');
      console.log('✅ Moods fetched:', response.data);
      setMoods(response.data.moods || []);
    } catch (error) {
      console.error('❌ Error fetching moods:', error);
      const axiosError = error as AxiosError;
      Alert.alert('Fel', `Kunde inte hämta humör: ${axiosError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMoods();
    setRefreshing(false);
  };

  const handleSaveMood = async () => {
    if (!user?.uid) {
      Alert.alert('Fel', 'Du måste vara inloggad');
      return;
    }

    setSavingMood(true);
    try {
      const moodData = {
        score: moodScore,
        label: getMoodLabel(moodScore),
        activity: selectedActivity,
        energy,
        sleep,
        notes,
        timestamp: new Date().toISOString(),
      };

      console.log('📤 Saving mood:', moodData);
      const response = await apiService.post('/api/mood/log', moodData);
      console.log('✅ Mood saved:', response.data);

      Alert.alert('Framgång', 'Ditt humör sparades! 🎉');
      setShowMoodLogger(false);
      resetMoodForm();
      await loadMoods();
    } catch (error) {
      console.error('❌ Error saving mood:', error);
      const axiosError = error as AxiosError<{ error: string }>;
      Alert.alert('Fel', axiosError.response?.data?.error || 'Kunde inte spara humör');
    } finally {
      setSavingMood(false);
    }
  };

  const resetMoodForm = () => {
    setMoodScore(5);
    setSelectedActivity('Träning');
    setEnergy(5);
    setSleep(5);
    setNotes('');
  };

  const getMoodLabel = (score: number): string => {
    if (score <= 2) return 'Mycket dåligt';
    if (score <= 4) return 'Dåligt';
    if (score <= 6) return 'Neutralt';
    if (score <= 8) return 'Bra';
    return 'Perfekt';
  };

  const getMoodEmoji = (score: number): string => {
    if (score <= 2) return '😢';
    if (score <= 4) return '😟';
    if (score <= 6) return '😐';
    if (score <= 8) return '😊';
    return '✨';
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: chatInput,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setSendingChat(true);

    try {
      const response = await apiService.post('/api/chatbot/chat', {
        message: chatInput,
        user_id: user?.uid,
      });

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: response.data.response || 'Jag hörde dig! Hur kan jag hjälpa?',
        timestamp: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setSendingChat(false);
    }
  };

  const displayName = user?.email?.split('@')[0] || 'Vän';
  const avgMood = moods.length > 0
    ? (moods.reduce((sum, m) => sum + m.score, 0) / moods.length).toFixed(1)
    : 'N/A';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.greeting}>👋 Hej, {displayName}!</Text>
            <Text style={styles.subGreeting}>Hur mår du idag?</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn}>
            <MaterialCommunityIcons name="account-circle" size={40} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Status Cards */}
        <View style={styles.statusCardsContainer}>
          <Card style={styles.statusCard}>
            <Card.Content style={styles.statusCardContent}>
              <Text style={styles.statusLabel}>Dagens Humör</Text>
              <Text style={styles.statusValue}>Loggat idag: {moods.length}</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statusCard}>
            <Card.Content style={styles.statusCardContent}>
              <Text style={styles.statusLabel}>Medel Humör</Text>
              <Text style={styles.statusValue}>{avgMood}/10</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statusCard}>
            <Card.Content style={styles.statusCardContent}>
              <Text style={styles.statusLabel}>Poster</Text>
              <Text style={styles.statusValue}>{moods.length}</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() => setShowMoodLogger(true)}
          >
            <Text style={styles.actionEmoji}>📊</Text>
            <Text style={styles.actionTitle}>Logga Humör</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => setShowMoodList(true)}
          >
            <Text style={styles.actionEmoji}>📜</Text>
            <Text style={styles.actionTitle}>Historik</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonTertiary]}
            onPress={() => setShowChatbot(true)}
          >
            <Text style={styles.actionEmoji}>💬</Text>
            <Text style={styles.actionTitle}>Chatt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonQuaternary]}
            onPress={() => setShowSounds(true)}
          >
            <Text style={styles.actionEmoji}>🎵</Text>
            <Text style={styles.actionTitle}>Ljud</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Moods */}
        {moods.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Senaste Humöret</Text>
            {moods.slice(0, 3).map((mood) => (
              <Card key={mood.id} style={styles.moodCard}>
                <Card.Content style={styles.moodCardContent}>
                  <View style={styles.moodCardLeft}>
                    <Text style={styles.moodEmoji}>{getMoodEmoji(mood.score)}</Text>
                    <View>
                      <Text style={styles.moodLabel}>{mood.label}</Text>
                      <Text style={styles.moodDate}>{new Date(mood.timestamp).toLocaleDateString('sv-SE')}</Text>
                    </View>
                  </View>
                  <Text style={styles.moodScore}>{mood.score}/10</Text>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        {loading && <ActivityIndicator size="large" color={COLORS.primary} />}
      </ScrollView>

      {/* MOOD LOGGER MODAL */}
      <Modal visible={showMoodLogger} animationType="slide" transparent={true}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Logga Ditt Humör</Text>
            <TouchableOpacity onPress={() => setShowMoodLogger(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Mood Scale */}
            <Text style={styles.labelText}>Humörskala (1-10)</Text>
            <View style={styles.moodScaleContainer}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                <TouchableOpacity
                  key={score}
                  style={[
                    styles.moodScaleButton,
                    moodScore === score && styles.moodScaleButtonActive,
                  ]}
                  onPress={() => setMoodScore(score)}
                >
                  <Text style={styles.moodScaleEmoji}>{getMoodEmoji(score)}</Text>
                  <Text style={styles.moodScaleText}>{score}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Activity Selection */}
            <Text style={styles.labelText}>Aktivitet</Text>
            <View style={styles.activityGrid}>
              {activities.map((activity) => (
                <TouchableOpacity
                  key={activity}
                  style={[
                    styles.activityButton,
                    selectedActivity === activity && styles.activityButtonActive,
                  ]}
                  onPress={() => setSelectedActivity(activity)}
                >
                  <Text style={styles.activityText}>{activity}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Energy Level */}
            <Text style={styles.labelText}>Energinivå: {energy}</Text>
            <View style={styles.sliderContainer}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                <TouchableOpacity
                  key={`energy-${val}`}
                  style={[
                    styles.sliderButton,
                    energy >= val && styles.sliderButtonActive,
                  ]}
                  onPress={() => setEnergy(val)}
                />
              ))}
            </View>

            {/* Sleep Quality */}
            <Text style={styles.labelText}>Sömnkvalitet: {sleep}</Text>
            <View style={styles.sliderContainer}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                <TouchableOpacity
                  key={`sleep-${val}`}
                  style={[
                    styles.sliderButton,
                    sleep >= val && styles.sliderButtonActive,
                  ]}
                  onPress={() => setSleep(val)}
                />
              ))}
            </View>

            {/* Notes */}
            <Text style={styles.labelText}>Anteckningar</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Skriv något om hur du känner dig..."
              placeholderTextColor={COLORS.text_tertiary}
              multiline={true}
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
            />

            {/* Save Button */}
            <Button
              mode="contained"
              onPress={handleSaveMood}
              loading={savingMood}
              disabled={savingMood}
              style={styles.saveButton}
              labelStyle={styles.saveButtonLabel}
            >
              Spara Humör
            </Button>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MOOD LIST MODAL */}
      <Modal visible={showMoodList} animationType="slide" transparent={true}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Humörhistorik</Text>
            <TouchableOpacity onPress={() => setShowMoodList(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={moods}
            renderItem={({ item }) => (
              <Card style={styles.moodCard}>
                <Card.Content style={styles.moodCardContent}>
                  <View style={styles.moodCardLeft}>
                    <Text style={styles.moodEmoji}>{getMoodEmoji(item.score)}</Text>
                    <View>
                      <Text style={styles.moodLabel}>{item.label}</Text>
                      <Text style={styles.moodActivity}>{item.activity}</Text>
                    </View>
                  </View>
                  <Text style={styles.moodScore}>{item.score}/10</Text>
                </Card.Content>
              </Card>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
        </SafeAreaView>
      </Modal>

      {/* CHATBOT MODAL */}
      <Modal visible={showChatbot} animationType="slide" transparent={true}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AI Terapeut</Text>
            <TouchableOpacity onPress={() => setShowChatbot(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={chatMessages}
            inverted
            renderItem={({ item }) => (
              <View
                style={[
                  styles.chatMessage,
                  item.sender === 'user' ? styles.chatMessageUser : styles.chatMessageBot,
                ]}
              >
                <Text style={styles.chatText}>{item.text}</Text>
              </View>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatList}
          />

          <View style={styles.chatInputContainer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Skriv ett meddelande..."
              placeholderTextColor={COLORS.text_tertiary}
              value={chatInput}
              onChangeText={setChatInput}
              editable={!sendingChat}
            />
            <Button
              mode="contained"
              onPress={handleSendChat}
              disabled={sendingChat || !chatInput.trim()}
              style={styles.chatSendButton}
              loading={sendingChat}
            >
              Skicka
            </Button>
          </View>
        </SafeAreaView>
      </Modal>

      {/* SOUNDS MODAL */}
      <Modal visible={showSounds} animationType="slide" transparent={true}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Avslappningsljud</Text>
            <TouchableOpacity onPress={() => setShowSounds(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {[
              { name: 'Regn', emoji: '🌧️', duration: '8 min' },
              { name: 'Strand', emoji: '🏖️', duration: '10 min' },
              { name: 'Skogens ljud', emoji: '🌲', duration: '12 min' },
              { name: 'Hästarnas ljud', emoji: '🐴', duration: '6 min' },
              { name: 'Meditation', emoji: '🧘', duration: '15 min' },
              { name: 'Klassisk musik', emoji: '🎹', duration: '20 min' },
            ].map((sound, index) => (
              <Card key={index} style={styles.soundCard}>
                <Card.Content style={styles.soundCardContent}>
                  <Text style={styles.soundEmoji}>{sound.emoji}</Text>
                  <View style={styles.soundInfo}>
                    <Text style={styles.soundName}>{sound.name}</Text>
                    <Text style={styles.soundDuration}>⏱️ {sound.duration}</Text>
                  </View>
                  <Button mode="contained" style={styles.playButton}>
                    ▶️
                  </Button>
                </Card.Content>
              </Card>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: TYPOGRAPHY.size24,
    fontWeight: '700',
    color: COLORS.text_primary,
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: TYPOGRAPHY.size14,
    color: COLORS.text_secondary,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCardsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  statusCardContent: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.text_secondary,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: TYPOGRAPHY.size16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.primary + '15',
    borderWidth: 1,
    borderColor: COLORS.primary + '50',
  },
  actionButtonSecondary: {
    backgroundColor: COLORS.success + '15',
    borderWidth: 1,
    borderColor: COLORS.success + '50',
  },
  actionButtonTertiary: {
    backgroundColor: COLORS.info + '15',
    borderWidth: 1,
    borderColor: COLORS.info + '50',
  },
  actionButtonQuaternary: {
    backgroundColor: COLORS.warning + '15',
    borderWidth: 1,
    borderColor: COLORS.warning + '50',
  },
  actionEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: TYPOGRAPHY.size14,
    fontWeight: '600',
    color: COLORS.text_primary,
    textAlign: 'center',
  },
  recentSection: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size18,
    fontWeight: '700',
    color: COLORS.text_primary,
    marginBottom: SPACING.md,
  },
  moodCard: {
    marginBottom: SPACING.md,
    backgroundColor: '#FFFFFF',
  },
  moodCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moodCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodLabel: {
    fontSize: TYPOGRAPHY.size14,
    fontWeight: '600',
    color: COLORS.text_primary,
  },
  moodDate: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.text_tertiary,
  },
  moodActivity: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.text_secondary,
  },
  moodScore: {
    fontSize: TYPOGRAPHY.size16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size18,
    fontWeight: '700',
    color: COLORS.text_primary,
  },
  modalContent: {
    flex: 1,
    padding: SPACING.md,
  },
  labelText: {
    fontSize: TYPOGRAPHY.size14,
    fontWeight: '600',
    color: COLORS.text_primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  moodScaleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  moodScaleButton: {
    width: '23%',
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  moodScaleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  moodScaleEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  moodScaleText: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.text_secondary,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  activityButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  activityButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  activityText: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.text_primary,
    fontWeight: '500',
  },
  sliderContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: SPACING.md,
  },
  sliderButton: {
    flex: 1,
    height: 30,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  sliderButtonActive: {
    backgroundColor: COLORS.primary,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size14,
    color: COLORS.text_primary,
    minHeight: 100,
    backgroundColor: '#FFFFFF',
    marginBottom: SPACING.md,
  },
  saveButton: {
    marginVertical: SPACING.lg,
    paddingVertical: 8,
  },
  saveButtonLabel: {
    fontSize: TYPOGRAPHY.size16,
    fontWeight: '600',
  },
  listContent: {
    padding: SPACING.md,
  },
  chatList: {
    paddingHorizontal: SPACING.md,
  },
  chatMessage: {
    maxWidth: '80%',
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
  },
  chatMessageUser: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
  },
  chatMessageBot: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB',
  },
  chatText: {
    fontSize: TYPOGRAPHY.size14,
    color: COLORS.text_primary,
  },
  chatInputContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.size14,
    color: COLORS.text_primary,
  },
  chatSendButton: {
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  soundCard: {
    marginBottom: SPACING.md,
    backgroundColor: '#FFFFFF',
  },
  soundCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  soundEmoji: {
    fontSize: 28,
  },
  soundInfo: {
    flex: 1,
  },
  soundName: {
    fontSize: TYPOGRAPHY.size14,
    fontWeight: '600',
    color: COLORS.text_primary,
  },
  soundDuration: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.text_secondary,
    marginTop: 2,
  },
  playButton: {
    paddingHorizontal: SPACING.md,
  },
});

export default HomeScreen;
