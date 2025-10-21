import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
