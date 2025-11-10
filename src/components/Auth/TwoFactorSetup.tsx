import React, { useState, useEffect } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Chip,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Fingerprint as FingerprintIcon,
  Smartphone as SmartphoneIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onComplete, onCancel }) => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Biometric/WebAuthn state
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);

  // SMS/Phone state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);

  const steps = [
    'Choose Method',
    'Setup Authentication',
    'Verify & Complete'
  ];

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    if (window.PublicKeyCredential) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setBiometricSupported(available);
      } catch (err) {
        console.error('Biometric support check failed:', err);
        setBiometricSupported(false);
      }
    }
  };

  const handleBiometricSetup = async () => {
    if (!biometricSupported) {
      setError('Biometric authentication is not supported on this device');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create WebAuthn credential
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: "Lugn & Trygg",
            id: window.location.hostname,
          },
          user: {
            id: new Uint8Array(16), // Would be actual user ID
            name: "user@example.com", // Would be actual user email
            displayName: "User",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" }, // ES256
            { alg: -257, type: "public-key" }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      });

      if (credential) {
        // In a real implementation, send the credential to the server
        console.log('Biometric credential created:', credential);
        setBiometricEnrolled(true);
        setActiveStep(2);
      }
    } catch (err: any) {
      console.error('Biometric setup failed:', err);
      setError(err.message || 'Failed to setup biometric authentication');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSetup = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // In a real implementation, send SMS verification code
      // For demo, we'll simulate success
      await new Promise(resolve => setTimeout(resolve, 2000));
      setActiveStep(1);
    } catch (err) {
      setError('Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneVerification = async () => {
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // In a real implementation, verify the code with the server
      // For demo, accept any 6-digit code
      if (verificationCode.length === 6 && /^\d+$/.test(verificationCode)) {
        setPhoneVerified(true);
        setActiveStep(2);
      } else {
        setError('Invalid verification code');
      }
    } catch (err) {
      setError('Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    setSuccess(true);
    setTimeout(() => {
      onComplete();
    }, 2000);
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" gutterBottom>
              Choose Your 2FA Method
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Select how you want to secure your account with two-factor authentication.
            </Typography>

            <Box display="flex" flexDirection="column" gap={2} maxWidth={400} mx="auto">
              <Button
                variant="outlined"
                startIcon={<FingerprintIcon />}
                onClick={() => setActiveStep(1)}
                disabled={!biometricSupported}
                sx={{ p: spacing.lg, justifyContent: 'flex-start' }}
              >
                <Box textAlign="left">
                  <Typography variant="subtitle1">Biometric Authentication</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Use fingerprint or face recognition
                  </Typography>
                </Box>
                {biometricSupported ? (
                  <CheckIcon color="success" sx={{ ml: 'auto' }} />
                ) : (
                  <ErrorIcon color="error" sx={{ ml: 'auto' }} />
                )}
              </Button>

              <Button
                variant="outlined"
                startIcon={<SmartphoneIcon />}
                onClick={() => setActiveStep(1)}
                sx={{ p: spacing.lg, justifyContent: 'flex-start' }}
              >
                <Box textAlign="left">
                  <Typography variant="subtitle1">SMS Authentication</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Receive codes via text message
                  </Typography>
                </Box>
                <CheckIcon color="success" sx={{ ml: 'auto' }} />
              </Button>
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ py: 4 }}>
            <Typography variant="h6" gutterBottom>
              Setup Authentication
            </Typography>

            {biometricSupported && !phoneNumber ? (
              <Box textAlign="center">
                <FingerprintIcon sx={{ fontSize: 64, color: 'primary.main', mb: spacing.md }} />
                <Typography variant="h6" gutterBottom>
                  Setup Biometric Authentication
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Use your fingerprint or face to securely log in to your account.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <FingerprintIcon />}
                  onClick={handleBiometricSetup}
                  disabled={loading}
                  size="large"
                >
                  {loading ? 'Setting up...' : 'Setup Biometric Login'}
                </Button>
              </Box>
            ) : (
              <Box maxWidth={400} mx="auto">
                {!phoneVerified ? (
                  <>
                    <Typography variant="body1" gutterBottom>
                      Enter your phone number to receive verification codes.
                    </Typography>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+46 70 123 45 67"
                      sx={{ mb: spacing.md }}
                    />
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={loading ? <CircularProgress size={20} /> : <SmartphoneIcon />}
                      onClick={handlePhoneSetup}
                      disabled={loading || !phoneNumber.trim()}
                    >
                      {loading ? 'Sending...' : 'Send Verification Code'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Typography variant="body1" gutterBottom>
                      Enter the 6-digit code sent to {phoneNumber}
                    </Typography>
                    <TextField
                      fullWidth
                      label="Verification Code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="123456"
                      inputProps={{ maxLength: 6 }}
                      sx={{ mb: spacing.md }}
                    />
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={loading ? <CircularProgress size={20} /> : <CheckIcon />}
                      onClick={handlePhoneVerification}
                      disabled={loading || verificationCode.length !== 6}
                    >
                      {loading ? 'Verifying...' : 'Verify Code'}
                    </Button>
                  </>
                )}
              </Box>
            )}
          </Box>
        );

      case 2:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: spacing.md }} />
            <Typography variant="h6" gutterBottom>
              Two-Factor Authentication Setup Complete!
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Your account is now secured with 2FA. You'll be prompted to authenticate
              when logging in from new devices.
            </Typography>

            <Box sx={{ mt: spacing.lg }}>
              <Chip
                icon={biometricEnrolled ? <FingerprintIcon /> : <SmartphoneIcon />}
                label={biometricEnrolled ? "Biometric Authentication" : "SMS Authentication"}
                color="success"
                variant="outlined"
              />
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  if (success) {
    return (
      <Dialog open={true} maxWidth="sm" fullWidth>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: spacing.md }} />
            <Typography variant="h5" gutterBottom>
              Setup Complete!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Two-factor authentication has been successfully configured.
            </Typography>
          </motion.div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <SecurityIcon />
        Setup Two-Factor Authentication
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: spacing.xl }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: spacing.lg }}>
            {error}
          </Alert>
        )}

        {renderStepContent()}
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        {activeStep === 2 && (
          <Button
            onClick={handleComplete}
            variant="contained"
            disabled={loading}
          >
            Complete Setup
          </Button>
        )}
        {activeStep > 0 && activeStep < 2 && (
          <Button
            onClick={() => setActiveStep(activeStep - 1)}
            disabled={loading}
          >
            Back
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TwoFactorSetup;