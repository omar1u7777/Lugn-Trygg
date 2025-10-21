import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';
import { TextInput, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SPACING, TYPOGRAPHY } from '../../theme/colors';
import { 
  GoogleSignin, 
  GoogleSigninButton,
  statusCodes,
} from '@react-native-google-signin/google-signin';

const { width } = Dimensions.get('window');

// Initialize Google Sign-In
GoogleSignin.configure({
  webClientId: '111615148451-abc123def456.apps.googleusercontent.com', // Replace with your Google Cloud web client ID
  iosClientId: 'YOUR_IOS_CLIENT_ID', // iOS client ID
  androidClientId: 'YOUR_ANDROID_CLIENT_ID', // Android client ID
  offlineAccess: true,
  scopes: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
});

const LoginScreen = () => {
  const router = useRouter();
  const { login, loading, user, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user?.uid) {
      router.replace('/(tabs)/');
    }
  }, [user]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!email) {
      newErrors.email = 'Email krävs';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Ogiltig email';
    }

    if (!password) {
      newErrors.password = 'Lösenord krävs';
    } else if (password.length < 6) {
      newErrors.password = 'Lösenord måste vara minst 6 tecken';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    try {
      await login(email, password);
      // Navigation happens automatically via useEffect above
    } catch (error: any) {
      const errorMessage = error?.message || 'Inloggning misslyckades';
      Alert.alert('Fel', errorMessage);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      // Check if device has Play Services (Android)
      await GoogleSignin.hasPlayServices();

      // Sign in
      const userInfo = await GoogleSignin.signIn();
      
      console.log('✅ Google Sign-In successful:', userInfo);

      // If you have a custom backend integration:
      if (loginWithGoogle) {
        await loginWithGoogle(userInfo);
      }

      // On web/Expo, you might need to use the ID token differently
      Alert.alert('Framgång', `Välkommen, ${userInfo.user.name}! 🎉`);
      // Navigation happens automatically via useEffect
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('Användaren avbröt Google Sign-In');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Google Sign-In redan pågår');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Fel', 'Google Play Services inte tillgänglig');
      } else {
        Alert.alert('Fel', error?.message || 'Google inloggning misslyckades');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await GoogleSignin.signOut();
      console.log('Utloggad från Google');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Logo & Title Section */}
        <View style={styles.headerSection}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons
              name="brain"
              size={80}
              color={COLORS.primary}
            />
          </View>

          <Text style={styles.appTitle}>Lugn & Trygg</Text>
          <Text style={styles.appSubtitle}>Din personliga mentor för mental hälsa</Text>

          <View style={styles.decorativeLine} />

          <Text style={styles.welcomeText}>Logga in eller skapa ett konto</Text>
        </View>

        {/* Google Sign-In Button - New Implementation */}
        <View style={styles.googleButtonSection}>
          <GoogleSigninButton
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Light}
            onPress={handleGoogleLogin}
            disabled={isGoogleLoading || loading}
          />
        </View>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>eller</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email/Password Form */}
        <View style={styles.formSection}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>E-postadress</Text>
            <TextInput
              style={styles.input}
              placeholder="din@email.com"
              placeholderTextColor={COLORS.text_tertiary}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrors({ ...errors, email: '' });
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              left={<TextInput.Icon icon="email" />}
              mode="outlined"
              outlineColor={COLORS.border}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text_primary}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Lösenord</Text>
            <TextInput
              style={styles.input}
              placeholder="Minst 6 tecken"
              placeholderTextColor={COLORS.text_tertiary}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrors({ ...errors, password: '' });
              }}
              secureTextEntry={!showPassword}
              editable={!loading}
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              mode="outlined"
              outlineColor={COLORS.border}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text_primary}
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          {/* Login Button */}
          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading || isGoogleLoading}
            style={styles.loginButton}
            labelStyle={styles.buttonLabel}
          >
            Logga in
          </Button>
        </View>

        {/* Sign Up Link */}
        <View style={styles.signupSection}>
          <Text style={styles.signupText}>Har du inget konto? </Text>
          <TouchableOpacity onPress={() => router.push('/signup')}>
            <Text style={styles.signupLink}>Skapa ett här</Text>
          </TouchableOpacity>
        </View>

        {/* Feature Cards */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Vad får du?</Text>

          <View style={styles.featureGrid}>
            {[
              { emoji: '🎭', title: 'Humörspårning', desc: 'Spåra ditt dagliga humör' },
              { emoji: '🤖', title: 'AI Terapeut', desc: 'Stöd när du behöver det' },
              { emoji: '❤️', title: 'Hälsodata', desc: 'Integrera dina enheter' },
              { emoji: '📖', title: 'AI Berättelser', desc: 'Personliga historier' },
            ].map((feature, idx) => (
              <View key={idx} style={styles.featureCard}>
                <Text style={styles.featureEmoji}>{feature.emoji}</Text>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Genom att logga in godkänner du våra användarvillkor och integritetspolicy
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg_primary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  headerSection: {
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  logoContainer: {
    marginBottom: SPACING.md,
  },
  appTitle: {
    fontSize: TYPOGRAPHY.size28,
    fontWeight: '700',
    color: COLORS.text_primary,
    marginBottom: SPACING.xs,
  },
  appSubtitle: {
    fontSize: TYPOGRAPHY.size14,
    color: COLORS.text_secondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  decorativeLine: {
    width: 50,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginBottom: SPACING.md,
  },
  welcomeText: {
    fontSize: TYPOGRAPHY.size16,
    color: COLORS.text_primary,
    fontWeight: '600',
  },
  googleButtonSection: {
    marginVertical: SPACING.lg,
    alignItems: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.text_tertiary,
  },
  formSection: {
    marginVertical: SPACING.md,
  },
  inputContainer: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.size14,
    fontWeight: '600',
    color: COLORS.text_primary,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.bg_secondary,
    fontSize: TYPOGRAPHY.size14,
  },
  errorText: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.danger,
    marginTop: SPACING.xs,
  },
  loginButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  buttonLabel: {
    fontSize: TYPOGRAPHY.size16,
    fontWeight: '600',
  },
  signupSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: SPACING.lg,
  },
  signupText: {
    fontSize: TYPOGRAPHY.size14,
    color: COLORS.text_secondary,
  },
  signupLink: {
    fontSize: TYPOGRAPHY.size14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  featuresSection: {
    marginVertical: SPACING.xl,
  },
  featuresTitle: {
    fontSize: TYPOGRAPHY.size18,
    fontWeight: '700',
    color: COLORS.text_primary,
    marginBottom: SPACING.md,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  featureCard: {
    width: '47%',
    padding: SPACING.md,
    backgroundColor: COLORS.bg_secondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  featureEmoji: {
    fontSize: 28,
    marginBottom: SPACING.sm,
  },
  featureTitle: {
    fontSize: TYPOGRAPHY.size12,
    fontWeight: '600',
    color: COLORS.text_primary,
    textAlign: 'center',
  },
  featureDesc: {
    fontSize: TYPOGRAPHY.size11 || 11,
    color: COLORS.text_secondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  footer: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  footerText: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.text_tertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default LoginScreen;
