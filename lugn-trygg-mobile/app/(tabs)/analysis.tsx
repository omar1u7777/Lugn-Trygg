import React from 'react';
import { View, StyleSheet } from 'react-native';
import AnalyticsScreen from '@/src/screens/analysis/AnalyticsScreen';

export default function AnalyticsTab() {
  return (
    <View style={styles.container}>
      <AnalyticsScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
