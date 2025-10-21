import React from 'react';
import { View, StyleSheet } from 'react-native';
import SignUpScreen from '@/src/screens/auth/SignUpScreen';

export default function SignupPage() {
  return (
    <View style={styles.container}>
      <SignUpScreen navigation={undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
