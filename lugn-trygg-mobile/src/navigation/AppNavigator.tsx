import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HomeScreen from '../screens/home/HomeScreen';
import MoodTrackerScreen from '../screens/home/MoodTrackerScreen';
import IntegrationsScreen from '../screens/integrations/IntegrationsScreen';
import AnalysisScreen from '../screens/analysis/AnalysisScreen';
import ProfileScreen from '../screens/home/ProfileScreen';
import { COLORS } from '../theme/colors';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

export const AppNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.text_tertiary,
        tabBarStyle: {
          backgroundColor: COLORS.bg_primary,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      {/* Home Tab */}
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" color={color} size={size} />
          ),
        }}
      />

      {/* Mood Tab */}
      <Tab.Screen
        name="MoodTab"
        component={MoodTrackerScreen}
        options={{
          title: 'Mood',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="emoticon-happy" color={color} size={size} />
          ),
        }}
      />

      {/* Health/Integrations Tab */}
      <Tab.Screen
        name="HealthTab"
        component={IntegrationsScreen}
        options={{
          title: 'Health',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="heart-pulse" color={color} size={size} />
          ),
        }}
      />

      {/* Analysis Tab */}
      <Tab.Screen
        name="AnalysisTab"
        component={AnalysisScreen}
        options={{
          title: 'Analysis',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="brain" color={color} size={size} />
          ),
        }}
      />

      {/* Profile Tab */}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
