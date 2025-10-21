import React, { useState, useEffect } from 'react';
import {
  View,
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
  Dimensions,
} from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SPACING, TYPOGRAPHY } from '../../theme/colors';

const { width } = Dimensions.get('window');
const GRID_COLUMNS = 2;
const ITEM_WIDTH = (width - SPACING.lg * 2 - SPACING.md) / GRID_COLUMNS;

// ✅ API Configuration
const API_BASE_URL = 'http://localhost:5001';
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface MoodEntry {
  id: string;
  score: number;
  label: string;
  timestamp: string;
  notes: string;
  activity?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [showMoodLogger, setShowMoodLogger] = useState(false);
  const [showMoodHistory, setShowMoodHistory] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [showSounds, setShowSounds] = useState(false);

  // Mood Logger state
  const [selectedScore, setSelectedScore] = useState(5);
  const [selectedActivity, setSelectedActivity] = useState('Träning');
  const [energyLevel, setEnergyLevel] = useState(5);
  const [sleepQuality, setSleepQuality] = useState(5);
  const [moodNotes, setMoodNotes] = useState('');
  const [savingMood, setSavingMood] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'Hej! 👋 Jag är din AI-terapeut. Hur kan jag hjälpa dig idag?',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const activities = [
    'Träning',
    'Arbete',
    'Meditation',
    'Läsning',
    'Socialt',
    'Vila',
    'Hemma',
    'Skapande',
    'Studie',
    'Annat',
  ];

  // Load moods on mount
  useEffect(() => {
    loadMoods();
  }, [user]);

  const loadMoods = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      console.log('📥 Fetching moods from:', `${API_BASE_URL}/api/mood/get`);
      const response = await apiClient.get('/api/mood/get', {
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
      });
      console.log('✅ Moods response:', response.data);
      const moodArray = Array.isArray(response.data) ? response.data : response.data.moods || [];
      setMoods(moodArray);
    } catch (error: any) {
      console.error('❌ Error:', error.response?.status, error.message);
      // Don't alert on first load - might be empty
      setMoods([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMoods();
    setRefreshing(false);
  };

  const getMoodEmoji = (score: number): string => {
    if (score <= 2) return '😢';
    if (score <= 4) return '😟';
    if (score <= 6) return '😐';
    if (score <= 8) return '😊';
    return '✨';
  };

  const getMoodLabel = (score: number): string => {
    if (score <= 2) return 'Mycket dåligt';
    if (score <= 4) return 'Dåligt';
    if (score <= 6) return 'Neutralt';
    if (score <= 8) return 'Bra';
    return 'Perfekt';
  };

  const handleSaveMood = async () => {
    if (!user?.uid) {
      Alert.alert('Fel', 'Du måste vara inloggad');
      return;
    }

    setSavingMood(true);
    try {
      const moodData = {
        score: selectedScore,
        label: getMoodLabel(selectedScore),
        timestamp: new Date().toISOString(),
        notes: moodNotes,
        activity: selectedActivity,
        energy: energyLevel,
        sleep: sleepQuality,
      };

      console.log('📤 Saving mood:', moodData);

      const response = await apiClient.post('/api/mood/log', moodData, {
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
      });

      console.log('✅ Mood saved:', response.data);
      Alert.alert('Framgång', 'Ditt humör sparades! 🎉');
      
      setShowMoodLogger(false);
      setSelectedScore(5);
      setSelectedActivity('Träning');
      setEnergyLevel(5);
      setSleepQuality(5);
      setMoodNotes('');
      
      await loadMoods();
    } catch (error: any) {
      console.error('❌ Error:', error.response?.data || error.message);
      Alert.alert('Fel', error.response?.data?.error || 'Kunde inte spara humör');
    } finally {
      setSavingMood(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: chatInput,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setSendingMessage(true);

    try {
      const response = await apiClient.post(
        '/api/chatbot/chat',
        { message: chatInput },
        {
          headers: {
            Authorization: `Bearer ${await user?.getIdToken()}`,
          },
        }
      );

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: response.data.response || 'Jag förstod inte helt. Kan du formulera om?',
      };

      setChatMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: 'Jag hade ett tekniskt problem. Försök igen senare.',
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } finally {
      setSendingMessage(false);
    }
  };

  const avgMood =
    moods.length > 0 ? (moods.reduce((sum, m) => sum + m.score, 0) / moods.length).toFixed(1) : 'N/A';

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Vän';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ========== HEADER ========== */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>👋 Hej, {displayName}!</Text>
            <Text style={styles.subGreeting}>Hur mår du idag?</Text>
          </View>
          <TouchableOpacity style={styles.avatarBtn}>
            <MaterialCommunityIcons name="account-circle" size={48} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* ========== STATUS CARDS ========== */}
        <View style={styles.statusCardsRow}>
          <Card style={styles.statusCard}>
            <Card.Content style={styles.statusCardContent}>
              <Text style={styles.statusLabel}>Dagens Humör</Text>
              <Text style={styles.statusValue}>{moods.length > 0 ? '✓' : '—'}</Text>
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

        {/* ========== ACTION GRID ========== */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionCard, styles.actionPrimary]}
            onPress={() => setShowMoodLogger(true)}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>🎭</Text>
            </View>
            <Text style={styles.actionTitle}>Logga Humör</Text>
            <Button
              mode="contained"
              style={styles.actionButton}
              labelStyle={styles.actionButtonLabel}
              icon="microphone"
            >
              Öppna
            </Button>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionSecondary]}
            onPress={() => setShowMoodHistory(true)}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>📋</Text>
            </View>
            <Text style={styles.actionTitle}>Historik</Text>
            <Button
              mode="contained"
              style={styles.actionButton}
              labelStyle={styles.actionButtonLabel}
              icon="history"
            >
              Visa
            </Button>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionTertiary]}
            onPress={() => setShowChatbot(true)}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>💬</Text>
            </View>
            <Text style={styles.actionTitle}>AI Chatt</Text>
            <Button
              mode="contained"
              style={styles.actionButton}
              labelStyle={styles.actionButtonLabel}
              icon="chat"
            >
              Chatta
            </Button>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionQuaternary]}
            onPress={() => setShowSounds(true)}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>🎵</Text>
            </View>
            <Text style={styles.actionTitle}>Ljud</Text>
            <Button
              mode="contained"
              style={styles.actionButton}
              labelStyle={styles.actionButtonLabel}
              icon="music"
            >
              Spela
            </Button>
          </TouchableOpacity>
        </View>

        {/* ========== RECENT MOODS ========== */}
        {moods.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Senaste Humöret</Text>
            {moods.slice(0, 3).map((mood) => (
              <Card key={mood.id} style={styles.moodCard}>
                <Card.Content style={styles.moodCardContent}>
                  <View style={styles.moodLeft}>
                    <Text style={styles.moodEmoji}>{getMoodEmoji(mood.score)}</Text>
                    <View>
                      <Text style={styles.moodLabel}>{mood.label}</Text>
                      <Text style={styles.moodDate}>
                        {new Date(mood.timestamp).toLocaleDateString('sv-SE')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.moodScore}>{mood.score}/10</Text>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        {loading && <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />}
      </ScrollView>

      {/* ========== MOOD LOGGER MODAL ========== */}
      <Modal visible={showMoodLogger} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMoodLogger(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Logga Ditt Humör</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Mood Scale */}
            <Text style={styles.sectionTitle}>Humörskala (1-10)</Text>
            <View style={styles.moodGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                <TouchableOpacity
                  key={score}
                  style={[
                    styles.moodButton,
                    selectedScore === score && styles.moodButtonActive,
                  ]}
                  onPress={() => setSelectedScore(score)}
                >
                  <Text style={styles.moodButtonEmoji}>{getMoodEmoji(score)}</Text>
                  <Text style={styles.moodButtonText}>{score}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Activity Selection */}
            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>Aktivitet</Text>
            <View style={styles.activityGrid}>
              {activities.map((activity) => (
                <TouchableOpacity
                  key={activity}
                  style={[
                    styles.activityBtn,
                    selectedActivity === activity && styles.activityBtnActive,
                  ]}
                  onPress={() => setSelectedActivity(activity)}
                >
                  <Text style={styles.activityBtnText}>{activity}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Energy Slider */}
            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>
              Energinivå: {energyLevel}/10
            </Text>
            <View style={styles.sliderContainer}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <TouchableOpacity
                  key={`energy-${val}`}
                  style={[styles.sliderButton, energyLevel >= val && styles.sliderButtonActive]}
                  onPress={() => setEnergyLevel(val)}
                />
              ))}
            </View>

            {/* Sleep Slider */}
            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>
              Sömnkvalitet: {sleepQuality}/10
            </Text>
            <View style={styles.sliderContainer}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                <TouchableOpacity
                  key={`sleep-${val}`}
                  style={[styles.sliderButton, sleepQuality >= val && styles.sliderButtonActive]}
                  onPress={() => setSleepQuality(val)}
                />
              ))}
            </View>

            {/* Notes */}
            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>Anteckningar</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Skriv något om hur du känner dig..."
              placeholderTextColor={COLORS.text_tertiary}
              multiline
              numberOfLines={4}
              value={moodNotes}
              onChangeText={setMoodNotes}
            />

            {/* Save Button */}
            <Button
              mode="contained"
              onPress={handleSaveMood}
              loading={savingMood}
              disabled={savingMood}
              style={styles.saveBtn}
              labelStyle={styles.saveBtnLabel}
            >
              Spara Humör
            </Button>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ========== MOOD HISTORY MODAL ========== */}
      <Modal visible={showMoodHistory} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMoodHistory(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Humörhistorik</Text>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={moods}
            renderItem={({ item }) => (
              <Card style={styles.moodCard}>
                <Card.Content style={styles.moodCardContent}>
                  <View style={styles.moodLeft}>
                    <Text style={styles.moodEmoji}>{getMoodEmoji(item.score)}</Text>
                    <View>
                      <Text style={styles.moodLabel}>{item.label}</Text>
                      <Text style={styles.moodActivity}>{item.activity || 'N/A'}</Text>
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

      {/* ========== CHATBOT MODAL ========== */}
      <Modal visible={showChatbot} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowChatbot(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>AI Terapeut</Text>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={chatMessages}
            inverted
            renderItem={({ item }) => (
              <View
                style={[
                  styles.chatMessage,
                  item.sender === 'user' ? styles.chatUser : styles.chatBot,
                ]}
              >
                <Text
                  style={[
                    styles.chatText,
                    item.sender === 'user' ? { color: '#FFFFFF' } : { color: COLORS.text_primary },
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatList}
          />

          <View style={styles.chatInputContainer}>
            <TextInput
              style={styles.chatInputField}
              placeholder="Skriv ett meddelande..."
              placeholderTextColor={COLORS.text_tertiary}
              value={chatInput}
              onChangeText={setChatInput}
              editable={!sendingMessage}
            />
            <Button
              mode="contained"
              onPress={handleSendChat}
              disabled={!chatInput.trim() || sendingMessage}
              style={styles.chatSendBtn}
              icon="send"
            >
              Skicka
            </Button>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ========== SOUNDS MODAL ========== */}
      <Modal visible={showSounds} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSounds(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Avslappningsljud</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {[
              { name: 'Regn', emoji: '🌧️', duration: '8 min' },
              { name: 'Strand', emoji: '🏖️', duration: '10 min' },
              { name: 'Skogens Ljud', emoji: '🌲', duration: '12 min' },
              { name: 'Fågelsång', emoji: '🐦', duration: '6 min' },
              { name: 'Meditation', emoji: '🧘', duration: '15 min' },
              { name: 'Klassisk Musik', emoji: '🎹', duration: '20 min' },
            ].map((sound, index) => (
              <Card key={index} style={styles.soundCard}>
                <Card.Content style={styles.soundCardContent}>
                  <Text style={styles.soundEmoji}>{sound.emoji}</Text>
                  <View style={styles.soundInfo}>
                    <Text style={styles.soundName}>{sound.name}</Text>
                    <Text style={styles.soundDuration}>⏱️ {sound.duration}</Text>
                  </View>
                  <Button mode="contained" style={styles.playBtn}>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
  avatarBtn: {
    padding: 8,
  },
  statusCardsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  statusCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
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
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  actionCard: {
    width: ITEM_WIDTH,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  actionPrimary: {
    backgroundColor: COLORS.primary + '15',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  actionSecondary: {
    backgroundColor: COLORS.success + '15',
    borderWidth: 1,
    borderColor: COLORS.success + '40',
  },
  actionTertiary: {
    backgroundColor: COLORS.info + '15',
    borderWidth: 1,
    borderColor: COLORS.info + '40',
  },
  actionQuaternary: {
    backgroundColor: COLORS.warning + '15',
    borderWidth: 1,
    borderColor: COLORS.warning + '40',
  },
  actionIconContainer: {
    marginBottom: SPACING.sm,
  },
  actionIcon: {
    fontSize: 40,
  },
  actionTitle: {
    fontSize: TYPOGRAPHY.size14,
    fontWeight: '700',
    color: COLORS.text_primary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  actionButton: {
    paddingHorizontal: SPACING.md,
  },
  actionButtonLabel: {
    fontSize: TYPOGRAPHY.size12,
    fontWeight: '600',
  },
  recentSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
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
  moodLeft: {
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
    marginTop: 2,
  },
  moodActivity: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.text_secondary,
    marginTop: 2,
  },
  moodScore: {
    fontSize: TYPOGRAPHY.size16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  loader: {
    marginVertical: SPACING.xl,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  moodButton: {
    width: `${100 / 5 - 2}%`,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  moodButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  moodButtonEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  moodButtonText: {
    fontSize: TYPOGRAPHY.size12,
    fontWeight: '600',
    color: COLORS.text_primary,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  activityBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  activityBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  activityBtnText: {
    fontSize: TYPOGRAPHY.size12,
    fontWeight: '600',
    color: COLORS.text_primary,
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.size14,
    color: COLORS.text_primary,
    minHeight: 100,
    marginBottom: SPACING.md,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginVertical: SPACING.xl,
    paddingVertical: 8,
  },
  saveBtnLabel: {
    fontSize: TYPOGRAPHY.size16,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  chatList: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  chatMessage: {
    maxWidth: '85%',
    marginVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
  },
  chatUser: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
  },
  chatBot: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB',
  },
  chatText: {
    fontSize: TYPOGRAPHY.size14,
    fontWeight: '500',
  },
  chatInputContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  chatInputField: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.size14,
    color: COLORS.text_primary,
  },
  chatSendBtn: {
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
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
    fontSize: 32,
  },
  soundInfo: {
    flex: 1,
  },
  soundName: {
    fontSize: TYPOGRAPHY.size14,
    fontWeight: '700',
    color: COLORS.text_primary,
  },
  soundDuration: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.text_secondary,
    marginTop: 2,
  },
  playBtn: {
    paddingHorizontal: SPACING.md,
  },
});

export default HomeScreen;
