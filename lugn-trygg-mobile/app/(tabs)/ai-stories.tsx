import React from 'react';
import { View, StyleSheet } from 'react-native';
import AIStoriesScreen from '@/src/screens/ai-stories/AIStoriesScreen';

export default function AIStoriesTab() {
  return (
    <View style={styles.container}>
      <AIStoriesScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
