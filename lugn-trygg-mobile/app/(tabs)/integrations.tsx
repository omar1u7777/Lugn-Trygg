import React from 'react';
import { View, StyleSheet } from 'react-native';
import IntegrationsScreen from '@/src/screens/integrations/IntegrationsScreen';

export default function IntegrationsTab() {
  return (
    <View style={styles.container}>
      <IntegrationsScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
