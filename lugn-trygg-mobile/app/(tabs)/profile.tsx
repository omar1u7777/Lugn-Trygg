import React from 'react';
import { View, StyleSheet } from 'react-native';
import ProfileScreen from '@/src/screens/home/ProfileScreen';

export default function ProfileTab() {
  return (
    <View style={styles.container}>
      <ProfileScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
