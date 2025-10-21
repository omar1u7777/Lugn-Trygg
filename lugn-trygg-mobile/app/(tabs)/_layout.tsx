import { Tabs } from 'expo-router';
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const tabBarActiveTintColor = Colors[colorScheme ?? 'light'].tint;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons size={28} name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai-stories"
        options={{
          title: 'Stories',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons size={28} name="book-open" color={color} />,
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons size={28} name="chart-line" color={color} />,
        }}
      />
      <Tabs.Screen
        name="integrations"
        options={{
          title: 'Integrations',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons size={28} name="watch-vibrate" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons size={28} name="menu" color={color} />,
        }}
      />
    </Tabs>
  );
}
