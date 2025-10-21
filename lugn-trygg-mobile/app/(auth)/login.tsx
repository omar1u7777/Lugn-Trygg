import React from 'react';
import { View, StyleSheet } from 'react-native';
import LoginScreen from '@/src/screens/auth/LoginScreen';

export default function LoginPage() {
  return (
    <View style={styles.container}>
      <LoginScreen navigation={undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
