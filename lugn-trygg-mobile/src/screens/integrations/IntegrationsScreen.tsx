import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../theme/colors';

interface Device {
  id: string;
  name: string;
  type: string;
  icon: string;
  isConnected: boolean;
  lastSync: string;
}

const DEVICES: Device[] = [
  {
    id: '1',
    name: 'Google Fit',
    type: 'Aktivitetsspårare',
    icon: 'fitness-tracker',
    isConnected: true,
    lastSync: 'Idag 14:30',
  },
  {
    id: '2',
    name: 'Apple Health',
    type: 'Hälsospårare',
    icon: 'heart',
    isConnected: false,
    lastSync: 'Igår 10:45',
  },
  {
    id: '3',
    name: 'Fitbit',
    type: 'Smartwatch',
    icon: 'watch',
    isConnected: true,
    lastSync: 'Idag 09:15',
  },
];

const IntegrationsScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [devices, setDevices] = useState<Device[]>(DEVICES);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const toggleDevice = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((device) =>
        device.id === deviceId
          ? {
              ...device,
              isConnected: !device.isConnected,
              lastSync: !device.isConnected ? 'Nu' : device.lastSync,
            }
          : device
      )
    );
  };

  const connectedCount = devices.filter((d) => d.isConnected).length;

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🔗 Integrationer</Text>
          <Text style={styles.subtitle}>Anslut dina hälsoenheter</Text>
        </View>

        {/* Status */}
        <Card style={styles.statusCard}>
          <Card.Content>
            <View style={styles.statusContainer}>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Anslutna</Text>
                <Text style={styles.statusValue}>{connectedCount}/{devices.length}</Text>
              </View>
              <View style={styles.statusSeparator} />
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Status</Text>
                <Text style={styles.statusValue}>✓ Aktiv</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Devices */}
        <Text style={styles.sectionTitle}>Anslutna Enheter</Text>
        {devices.map((device) => (
          <Card key={device.id} style={styles.deviceCard}>
            <Card.Content style={styles.deviceContent}>
              <MaterialCommunityIcons
                name={device.icon as any}
                size={32}
                color={device.isConnected ? COLORS.success : COLORS.text_tertiary}
              />
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceType}>{device.type}</Text>
                <Text
                  style={[
                    styles.deviceSync,
                    device.isConnected && { color: COLORS.success },
                  ]}
                >
                  {device.isConnected ? '✓ Synkad' : '✕ Ej Ansluten'} • {device.lastSync}
                </Text>
              </View>
              <Switch
                value={device.isConnected}
                onValueChange={() => toggleDevice(device.id)}
                trackColor={{ false: COLORS.border, true: COLORS.primary_light }}
                thumbColor={device.isConnected ? COLORS.primary : COLORS.text_tertiary}
              />
            </Card.Content>
          </Card>
        ))}

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
  statusCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.primary_light,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statusSeparator: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text_primary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  deviceCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.bg_secondary,
  },
  deviceContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text_primary,
  },
  deviceType: {
    fontSize: 12,
    color: COLORS.text_secondary,
    marginTop: 2,
  },
  deviceSync: {
    fontSize: 11,
    color: COLORS.text_tertiary,
    marginTop: 4,
  },
});

export default IntegrationsScreen;
