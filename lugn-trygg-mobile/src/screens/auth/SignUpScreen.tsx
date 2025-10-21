import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Text,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SPACING } from '../../theme/colors';

const SignUpScreen = ({ navigation }: any) => {
  const router = useRouter();
  const { signup, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!name) {
      newErrors.name = 'Name is required';
    }

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    try {
      await signup(email, password, name);
    } catch (error: any) {
      const errorMessage = error?.message || 'Signup failed';
      Alert.alert('Signup Error', errorMessage);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={COLORS.primary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.subtitle}>Join Lugn & Trygg</Text>

        {/* Name */}
        <TextInput
          label="Full Name"
          value={name}
          onChangeText={setName}
          editable={!loading}
          style={styles.input}
          left={<TextInput.Icon icon="account" />}
          error={!!errors.name}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

        {/* Email */}
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
          style={styles.input}
          left={<TextInput.Icon icon="email" />}
          error={!!errors.email}
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

        {/* Password */}
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          editable={!loading}
          style={styles.input}
          left={<TextInput.Icon icon="lock" />}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowPassword(!showPassword)}
            />
          }
          error={!!errors.password}
        />
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

        {/* Confirm Password */}
        <TextInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirmPassword}
          editable={!loading}
          style={styles.input}
          left={<TextInput.Icon icon="lock" />}
          right={
            <TextInput.Icon
              icon={showConfirmPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            />
          }
          error={!!errors.confirmPassword}
        />
        {errors.confirmPassword && (
          <Text style={styles.errorText}>{errors.confirmPassword}</Text>
        )}

        {/* Sign Up Button */}
        <Button
          mode="contained"
          onPress={handleSignUp}
          loading={loading}
          disabled={loading}
          style={styles.signupButton}
          contentStyle={styles.buttonContent}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </Button>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Already have an account?{' '}
          <Text
            style={styles.footerLink}
            onPress={() => router.navigate('/(auth)/login')}
          >
            Sign In
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg_primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text_primary,
  },
  form: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.text_secondary,
    marginBottom: SPACING.lg,
  },
  input: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.bg_secondary,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginBottom: SPACING.md,
    marginLeft: SPACING.sm,
  },
  signupButton: {
    marginTop: SPACING.md,
  },
  buttonContent: {
    height: 48,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: COLORS.text_secondary,
  },
  footerLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default SignUpScreen;
