import React from 'react';
import { View, StyleSheet } from 'react-native';
import MoreScreen from '@/src/screens/more/MoreScreen';

export default function MoreTab() {
  return (
    <View style={styles.container}>
      <MoreScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
