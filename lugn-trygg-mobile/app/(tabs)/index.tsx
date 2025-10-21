import React from 'react';
import { View, StyleSheet } from 'react-native';
import HomeScreen from '@/src/screens/home/HomeScreen';

export default function HomeTab() {
  return (
    <View style={styles.container}>
      <HomeScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
