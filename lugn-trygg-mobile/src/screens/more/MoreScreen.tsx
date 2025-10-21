import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, Card, Divider, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SPACING } from '../../theme/colors';

interface MenuItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  onPress: () => void;
}

const MoreScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    Alert.alert('Logga ut', 'Är du säker?', [
      { text: 'Avbryt', onPress: () => {} },
      {
        text: 'Logga ut',
        onPress: async () => {
          await logout();
        },
        style: 'destructive',
      },
    ]);
  };

  const menuItems: MenuItem[] = [
    {
      id: 'subscription',
      label: 'Premium',
      description: 'Lås upp avancerade funktioner',
      icon: 'star',
      color: COLORS.warning,
      onPress: () => Alert.alert('Premium', 'Upgradera till premium!'),
    },
    {
      id: 'referral',
      label: 'Referral',
      description: 'Tjäna poäng genom att bjuda in vänner',
      icon: 'gift',
      color: COLORS.success,
      onPress: () => Alert.alert('Referral', 'Dela koden: LUGN2024'),
    },
    {
      id: 'feedback',
      label: 'Feedback',
      description: 'Hjälp oss att förbättra appen',
      icon: 'message-text',
      color: COLORS.info,
      onPress: () => Alert.alert('Feedback', 'Tack för din feedback!'),
    },
    {
      id: 'settings',
      label: 'Inställningar',
      description: 'Ändra dina preferenser',
      icon: 'cog',
      color: COLORS.primary,
      onPress: () => Alert.alert('Inställningar', 'Inställningssidan'),
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <MaterialCommunityIcons name="account" size={48} color="#FFFFFF" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'Användare'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'email@example.com'}</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <View key={item.id}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={item.onPress}
              >
                <View style={styles.menuItemLeft}>
                  <View
                    style={[
                      styles.menuItemIcon,
                      { backgroundColor: item.color + '20' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={24}
                      color={item.color}
                    />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                    <Text style={styles.menuItemDescription}>{item.description}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={COLORS.text_tertiary}
                />
              </TouchableOpacity>
              {index < menuItems.length - 1 && <Divider />}
            </View>
          ))}
        </View>

        {/* About */}
        <Card style={styles.aboutCard}>
          <Card.Content>
            <Text style={styles.aboutTitle}>ℹ️ Om Appen</Text>
            <Text style={styles.aboutVersion}>Lugn & Trygg v1.0.0</Text>
            <Text style={styles.aboutDescription}>
              Din personliga mentor för mental hälsa
            </Text>
          </Card.Content>
        </Card>

        {/* Logout Button */}
        <Button
          mode="contained"
          onPress={handleLogout}
          buttonColor={COLORS.danger}
          textColor="#FFFFFF"
          icon="logout"
          style={styles.logoutButton}
        >
          Logga ut
        </Button>

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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.bg_secondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text_primary,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.text_secondary,
    marginTop: 4,
  },
  menuContainer: {
    marginVertical: SPACING.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bg_primary,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text_primary,
  },
  menuItemDescription: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginTop: 2,
  },
  aboutCard: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    backgroundColor: COLORS.bg_secondary,
  },
  aboutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text_primary,
    marginBottom: SPACING.md,
  },
  aboutVersion: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  aboutDescription: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginTop: SPACING.sm,
  },
  logoutButton: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    borderRadius: 12,
    paddingVertical: SPACING.md,
  },
});

export default MoreScreen;
