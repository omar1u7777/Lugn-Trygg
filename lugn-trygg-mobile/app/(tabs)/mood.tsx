import React from 'react';
import { View, StyleSheet } from 'react-native';
import MoodTrackerScreen from '@/src/screens/home/MoodTrackerScreen';

export default function MoodTab() {
  return (
    <View style={styles.container}>
      <MoodTrackerScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
