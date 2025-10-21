import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { apiService } from '../../services/api';
import { COLORS, SPACING } from '../../theme/colors';

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const statsData = await apiService.getStats('month');
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* User Info */}
      <Card style={styles.card}>
        <View style={styles.profileHeader}>
          <MaterialCommunityIcons
            name="account-circle"
            size={80}
            color={COLORS.primary}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user?.name || 'User'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>
      </Card>

      {/* Stats */}
      {stats && (
        <Card style={styles.card}>
          <Card.Title title="📊 Monthly Statistics" />
          <Card.Content>
            <View style={styles.statRow}>
              <View>
                <Text style={styles.statLabel}>Avg Mood</Text>
                <Text style={styles.statValue}>
                  {stats.mood_average?.toFixed(1) || 'N/A'}/10
                </Text>
              </View>
              <View>
                <Text style={styles.statLabel}>Entries</Text>
                <Text style={styles.statValue}>
                  {stats.mood_count || 0}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Settings */}
      <Card style={styles.card}>
        <Card.Title title="⚙️ Settings" />
        <Card.Content>
          <Button
            mode="outlined"
            onPress={() => loadStats()}
            style={styles.settingsButton}
            icon="refresh"
          >
            Refresh Data
          </Button>

          <Button
            mode="contained-tonal"
            onPress={handleLogout}
            style={styles.settingsButton}
            icon="logout"
            textColor={COLORS.danger}
          >
            Logout
          </Button>
        </Card.Content>
      </Card>

      {/* About */}
      <Card style={styles.card}>
        <Card.Title title="ℹ️ About" />
        <Card.Content>
          <Text style={styles.aboutText}>
            Lugn & Trygg v1.0.0{'\n'}
            Health & Mood Tracker{'\n'}
            {'\n'}
            Made with ❤️ for your wellbeing
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
    padding: SPACING.lg,
  },
  card: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.bg_primary,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  profileInfo: {
    marginLeft: SPACING.lg,
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  email: {
    fontSize: 14,
    color: COLORS.text_secondary,
    marginTop: SPACING.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text_secondary,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  settingsButton: {
    marginBottom: SPACING.md,
  },
  aboutText: {
    fontSize: 14,
    color: COLORS.text_primary,
    lineHeight: 20,
  },
});

export default ProfileScreen;
