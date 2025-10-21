import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Text, Card, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../theme/colors';

const AnalyticsScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('week');

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // Sample data
  const stats = {
    averageMood: 7.2,
    trend: 'Improving',
    totalLogged: 23,
    streak: 5,
    bestDay: 'Torsdag',
    bestDayScore: 8.5,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📊 Analys</Text>
          <Text style={styles.subtitle}>Följa ditt välbefinnande över tid</Text>
        </View>

        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          <SegmentedButtons
            value={timeRange}
            onValueChange={setTimeRange}
            buttons={[
              { value: 'week', label: '1 Vecka' },
              { value: 'month', label: '1 Månad' },
              { value: 'all', label: 'Alla' },
            ]}
            style={styles.segmentedButtons}
          />
        </View>

        {/* Main Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statCardContent}>
              <Text style={styles.statEmoji}>😊</Text>
              <Text style={styles.statValue}>{stats.averageMood}</Text>
              <Text style={styles.statLabel}>Genomsnittligt Humör</Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statCardContent}>
              <Text style={styles.statEmoji}>📈</Text>
              <Text style={styles.statValue}>{stats.trend}</Text>
              <Text style={styles.statLabel}>Trend</Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statCardContent}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={styles.statValue}>{stats.streak}</Text>
              <Text style={styles.statLabel}>Dagarschema</Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statCardContent}>
              <Text style={styles.statEmoji}>📝</Text>
              <Text style={styles.statValue}>{stats.totalLogged}</Text>
              <Text style={styles.statLabel}>Loggade Poster</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Weekly Insights */}
        <Card style={styles.insightCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>📅 Veckoinsikter</Text>
            <View style={styles.weeklyChart}>
              {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map((day, index) => (
                <View key={day} style={styles.dayColumn}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: (Math.random() * 100 + 20),
                        backgroundColor: COLORS.primary,
                      },
                    ]}
                  />
                  <Text style={styles.dayLabel}>{day}</Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Patterns */}
        <Card style={styles.patternCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>🔍 Identifierade Mönster</Text>

            <View style={styles.patternItem}>
              <MaterialCommunityIcons name="run" size={24} color={COLORS.success} />
              <View style={styles.patternContent}>
                <Text style={styles.patternTitle}>Motion Förbättrar Humöret</Text>
                <Text style={styles.patternDescription}>
                  Du tenderar att ha ett bättre humör på dagar när du tränar
                </Text>
              </View>
            </View>

            <View style={styles.patternItem}>
              <MaterialCommunityIcons name="bed" size={24} color={COLORS.info} />
              <View style={styles.patternContent}>
                <Text style={styles.patternTitle}>Sömnkvalitet Viktigt</Text>
                <Text style={styles.patternDescription}>
                  En bra natts sömn är starkt kopplad till bättre humör dagen efter
                </Text>
              </View>
            </View>

            <View style={styles.patternItem}>
              <MaterialCommunityIcons name="account-multiple" size={24} color={COLORS.warning} />
              <View style={styles.patternContent}>
                <Text style={styles.patternTitle}>Socialisering Hjälper</Text>
                <Text style={styles.patternDescription}>
                  Tid med vänner och familj ökar ditt allmänna välbefinnande
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Best Day */}
        <Card style={styles.bestDayCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>⭐ Din Bästa Dag</Text>
            <View style={styles.bestDayContent}>
              <Text style={styles.bestDayDay}>{stats.bestDay}</Text>
              <Text style={styles.bestDayScore}>Humörpoäng: {stats.bestDayScore}/10</Text>
              <Text style={styles.bestDayMessage}>🎉 Repetera vad du gjorde denna dagen!</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Recommendations */}
        <Card style={styles.recommendationCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>💡 Rekommendationer</Text>
            <Text style={styles.recommendationText}>
              🏃 Försök träna minst 30 minuter varje dag - det förbättrar ditt humör betydligt
            </Text>
            <Text style={styles.recommendationText}>
              😴 Sov 7-9 timmar per natt för optimal mental hälsa
            </Text>
            <Text style={styles.recommendationText}>
              👥 Umgås regelbundet med nära personer - det ökar lyckan
            </Text>
            <Text style={styles.recommendationText}>
              🧘 Prova mindfulness 10 minuter varje dag för att minska stress
            </Text>
          </Card.Content>
        </Card>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg_primary,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.text_secondary,
    marginTop: SPACING.sm,
  },
  timeRangeContainer: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  segmentedButtons: {
    backgroundColor: COLORS.bg_secondary,
  },
  statsGrid: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: COLORS.bg_secondary,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  statCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  statEmoji: {
    fontSize: 32,
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.text_secondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  insightCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.bg_secondary,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text_primary,
    marginBottom: SPACING.md,
  },
  weeklyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 150,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 4,
  },
  bar: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    marginBottom: SPACING.sm,
  },
  dayLabel: {
    fontSize: 11,
    color: COLORS.text_secondary,
    fontWeight: '500',
  },
  patternCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.bg_secondary,
  },
  patternItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  patternContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  patternTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text_primary,
  },
  patternDescription: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginTop: 4,
  },
  bestDayCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.primary_light,
  },
  bestDayContent: {
    alignItems: 'center',
  },
  bestDayDay: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  bestDayScore: {
    fontSize: 14,
    color: COLORS.text_primary,
    marginTop: SPACING.sm,
  },
  bestDayMessage: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  recommendationCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.bg_secondary,
  },
  recommendationText: {
    fontSize: 13,
    color: COLORS.text_primary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
});

export default AnalyticsScreen;
