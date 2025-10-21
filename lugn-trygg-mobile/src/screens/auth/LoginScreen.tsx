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

const { width } = Dimensions.get('window');

const LoginScreen = () => {
  const router = useRouter();
  const { login, loading, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      let errorMessage = 'Inloggning misslyckades';
      
      // Translate Firebase error codes to Swedish
      if (error?.code) {
        switch (error.code) {
          case 'auth/invalid-credential':
          case 'auth/wrong-password':
          case 'auth/user-not-found':
            errorMessage = 'Felaktig e-postadress eller lösenord. Kontrollera dina uppgifter och försök igen.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Ogiltig e-postadress';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Detta konto har inaktiverats';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'För många misslyckade försök. Vänta en stund och försök igen.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Nätverksfel. Kontrollera din internetanslutning.';
            break;
          default:
            errorMessage = error.message || 'Ett oväntat fel uppstod';
        }
      }
      
      Alert.alert('Inloggning misslyckades', errorMessage);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      // For now - show a message that real OAuth will be implemented
      // In production, this will integrate with @react-native-google-signin
      Alert.alert(
        'Google Sign-In', 
        'Google inloggning integreras. Använd email/lösenord för nu. 🚀'
      );
      
      // Future implementation:
      // const result = await GoogleSignin.signIn();
      // const userInfo = {
      //   idToken: result.idToken,
      //   user: result.user,
      // };
      // if (loginWithGoogle) {
      //   await loginWithGoogle(userInfo);
      // }
    } catch (error: any) {
      Alert.alert('Fel', error?.message || 'Google inloggning misslyckades');
    } finally {
      setIsGoogleLoading(false);
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

        {/* Google Sign-In Button */}
        <View style={styles.googleButtonSection}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={isGoogleLoading || loading}
            activeOpacity={0.8}
          >
            {isGoogleLoading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Image
                  source={{
                    uri: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHN0eWxlPnN0eXRlIHsgZmlsdGVyOiBpbnZlcnQoMSk7IH08L3N0eWxlPgo8cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHJ4PSI0IiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
                  }}
                  style={styles.googleLogo}
                />
                <Text style={styles.googleButtonText}>Logga in med Google</Text>
              </>
            )}
          </TouchableOpacity>
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
            labelStyle={styles.loginButtonLabel}
          >
            {loading ? 'Loggar in...' : 'Logga in'}
          </Button>

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Har du inget konto? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.signupLink}>Skapa ett här</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Vad erbjuder vi?</Text>

          <View style={styles.featureCard}>
            <MaterialCommunityIcons
              name="chart-line"
              size={32}
              color={COLORS.primary}
            />
            <View style={styles.featureContent}>
              <Text style={styles.featureCardTitle}>📊 Humörspårning</Text>
              <Text style={styles.featureCardDesc}>Logga ditt dagliga humör och följ trends</Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <MaterialCommunityIcons
              name="brain"
              size={32}
              color={COLORS.success}
            />
            <View style={styles.featureContent}>
              <Text style={styles.featureCardTitle}>🧠 AI Terapeut</Text>
              <Text style={styles.featureCardDesc}>Chatta med AI för mental hälsa</Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <MaterialCommunityIcons
              name="heart-pulse"
              size={32}
              color={COLORS.danger}
            />
            <View style={styles.featureContent}>
              <Text style={styles.featureCardTitle}>❤️ Hälsodata</Text>
              <Text style={styles.featureCardDesc}>Integrera din aktivitet & sömn</Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <MaterialCommunityIcons
              name="book"
              size={32}
              color={COLORS.warning}
            />
            <View style={styles.featureContent}>
              <Text style={styles.featureCardTitle}>📖 AI Berättelser</Text>
              <Text style={styles.featureCardDesc}>Läs personliga wellness-berättelser</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Genom att logga in godkänner du våra användarvillkor och sekretesspolicy
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  logoContainer: {
    marginBottom: SPACING.md,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: TYPOGRAPHY.size32,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  appSubtitle: {
    fontSize: TYPOGRAPHY.size16,
    color: COLORS.text_secondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  decorativeLine: {
    width: 40,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginBottom: SPACING.md,
  },
  welcomeText: {
    fontSize: TYPOGRAPHY.size16,
    fontWeight: '600',
    color: COLORS.text_primary,
    textAlign: 'center',
  },
  googleButtonSection: {
    padding: SPACING.lg,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    fontSize: TYPOGRAPHY.size16,
    fontWeight: '600',
    color: '#1F2937',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1D5DB',
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.size14,
    color: COLORS.text_secondary,
  },
  formSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    fontSize: TYPOGRAPHY.size14,
  },
  errorText: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.danger,
    marginTop: SPACING.sm,
  },
  loginButton: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  loginButtonLabel: {
    fontSize: TYPOGRAPHY.size16,
    fontWeight: '600',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: TYPOGRAPHY.size14,
    color: COLORS.text_secondary,
  },
  signupLink: {
    fontSize: TYPOGRAPHY.size14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  featuresSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    backgroundColor: '#F9FAFB',
  },
  featuresTitle: {
    fontSize: TYPOGRAPHY.size18,
    fontWeight: '700',
    color: COLORS.text_primary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'flex-start',
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureContent: {
    flex: 1,
  },
  featureCardTitle: {
    fontSize: TYPOGRAPHY.size14,
    fontWeight: '700',
    color: COLORS.text_primary,
    marginBottom: 4,
  },
  featureCardDesc: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.text_secondary,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: TYPOGRAPHY.size12,
    color: COLORS.text_tertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default LoginScreen;
