import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { healthService } from '../../services/health';
import { COLORS, SPACING } from '../../theme/colors';
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

  if (!analysis || analysis.patterns.length === 0) {
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
      {analysis.mood_average !== undefined && (
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
                  <Text
                    style={[
                      styles.impactText,
                      {
                        color:
                          pattern.impact === 'high'
                            ? COLORS.danger
                            : pattern.impact === 'medium'
                            ? COLORS.warning
                            : COLORS.success,
                      },
                    ]}
                  >
                    Impact: {pattern.impact.toUpperCase()}
                  </Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
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
    padding: SPACING.lg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg_secondary,
    padding: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text_primary,
    marginBottom: SPACING.lg,
  },
  card: {
    marginBottom: SPACING.lg,
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
    marginTop: SPACING.sm,
  },
  trendValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text_primary,
    marginTop: SPACING.sm,
  },
  patternItem: {
    paddingVertical: SPACING.md,
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
    marginTop: SPACING.sm,
  },
  impactBadge: {
    marginTop: SPACING.md,
  },
  impactText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  recommendationItem: {
    paddingVertical: SPACING.md,
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
    marginTop: SPACING.sm,
  },
  recAction: {
    fontSize: 12,
    color: COLORS.success,
    marginTop: SPACING.md,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text_primary,
    marginTop: SPACING.lg,
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.text_secondary,
    textAlign: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  button: {
    marginTop: SPACING.lg,
  },
  refreshButton: {
    marginVertical: SPACING.xl,
  },
});

export default AnalysisScreen;
