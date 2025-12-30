import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FingerprintIcon, DevicePhoneMobileIcon, CheckCircleIcon, XCircleIcon, ShieldCheckIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Dialog } from '../ui/tailwind/Dialog';
import { Button } from '../ui/tailwind/Button';
import { Input } from '../ui/tailwind/Input';
import { Alert } from '../ui/tailwind/Feedback';
import { Typography } from '../ui/tailwind/Typography';
import { Card } from '../ui/tailwind/Card';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onComplete, onCancel }) => {
  // t används för framtida internationalisering
  useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Biometric/WebAuthn state
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'biometric' | 'sms' | null>(null);

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
      } as CredentialCreationOptions);

      if (credential) {
        // In a real implementation, send the credential to the server
        if ((import.meta as any).env?.DEV) {
          console.log('Biometric credential created:', credential);
        }
        setBiometricEnrolled(true);
        setActiveStep(2);
      }
    } catch (err: unknown) {
      console.error('Biometric setup failed:', err);
      // CRITICAL FIX: Better error handling
      const errorMessage = err instanceof Error ? err.message : 'Failed to setup biometric authentication';
      setError(errorMessage);
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
    } catch {
      // CRITICAL FIX: Better error handling
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
    } catch {
      // CRITICAL FIX: Better error handling
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
          <div className="space-y-4">
            <Typography variant="h6" className="mb-2">
              Choose Your 2FA Method
            </Typography>
            <Typography variant="body2" className="text-gray-600 dark:text-gray-400 mb-4">
              Select how you want to secure your account with two-factor authentication.
            </Typography>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card 
                className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                  !biometricSupported ? 'opacity-50 cursor-not-allowed' : ''
                } ${selectedMethod === 'biometric' ? 'ring-2 ring-primary-500' : ''}`}
                onClick={() => {
                  if (biometricSupported) {
                    setSelectedMethod('biometric');
                    setActiveStep(1);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <FingerprintIcon className="w-6 h-6 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <Typography variant="subtitle1" className="font-semibold mb-1">
                      Biometric Authentication
                    </Typography>
                    <Typography variant="body2" className="text-gray-600 dark:text-gray-400 text-sm">
                      Use fingerprint or face recognition
                    </Typography>
                  </div>
                  {biometricSupported ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                </div>
              </Card>

              <Card 
                className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                  selectedMethod === 'sms' ? 'ring-2 ring-primary-500' : ''
                }`}
                onClick={() => {
                  setSelectedMethod('sms');
                  setActiveStep(1);
                }}
              >
                <div className="flex items-start gap-3">
                  <DevicePhoneMobileIcon className="w-6 h-6 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <Typography variant="subtitle1" className="font-semibold mb-1">
                      SMS Authentication
                    </Typography>
                    <Typography variant="body2" className="text-gray-600 dark:text-gray-400 text-sm">
                      Receive codes via text message
                    </Typography>
                  </div>
                  <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                </div>
              </Card>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <Typography variant="h6" className="mb-2">
              Setup Authentication
            </Typography>

            {selectedMethod === 'biometric' && biometricSupported && !phoneNumber ? (
              <div className="text-center space-y-4">
                <FingerprintIcon className="w-16 h-16 text-primary-600 dark:text-primary-400 mx-auto" />
                <Typography variant="h6" className="mb-2">
                  Setup Biometric Authentication
                </Typography>
                <Typography variant="body2" className="text-gray-600 dark:text-gray-400 mb-4">
                  Use your fingerprint or face to securely log in to your account.
                </Typography>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleBiometricSetup}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <FingerprintIcon className="w-5 h-5 mr-2" />
                      Setup Biometric Login
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {!phoneVerified ? (
                  <>
                    <Typography variant="body1" className="mb-2">
                      Enter your phone number to receive verification codes.
                    </Typography>
                    <Input
                      label="Phone Number"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+46 70 123 45 67"
                      required
                      disabled={loading}
                    />
                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={handlePhoneSetup}
                      disabled={loading || !phoneNumber.trim()}
                    >
                      {loading ? (
                        <>
                          <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <DevicePhoneMobileIcon className="w-5 h-5 mr-2" />
                          Send Verification Code
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Typography variant="body1" className="mb-2">
                      Enter the 6-digit code sent to {phoneNumber}
                    </Typography>
                    <Input
                      label="Verification Code"
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      maxLength={6}
                      required
                      disabled={loading}
                    />
                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={handlePhoneVerification}
                      disabled={loading || verificationCode.length !== 6}
                    >
                      {loading ? (
                        <>
                          <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckIcon className="w-5 h-5 mr-2" />
                          Verify Code
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="text-center space-y-4">
            <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto" />
            <Typography variant="h6" className="mb-2">
              Two-Factor Authentication Setup Complete!
            </Typography>
            <Typography variant="body2" className="text-gray-600 dark:text-gray-400 mb-4">
              Your account is now secured with 2FA. You'll be prompted to authenticate
              when logging in from new devices.
            </Typography>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              {biometricEnrolled ? (
                <FingerprintIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <DevicePhoneMobileIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
              )}
              <span className="text-sm font-medium text-green-800 dark:text-green-300">
                {biometricEnrolled ? "Biometric Authentication" : "SMS Authentication"}
              </span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (success) {
    return (
      <Dialog open={true} onClose={onComplete} size="md">
        <div className="p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <Typography variant="h5" className="mb-2">
              Setup Complete!
            </Typography>
            <Typography variant="body1" className="text-gray-600 dark:text-gray-400">
              Two-factor authentication has been successfully configured.
            </Typography>
          </motion.div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onClose={onCancel} size="lg">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheckIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <Typography variant="h5">
            Setup Two-Factor Authentication
          </Typography>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((label, index) => (
            <React.Fragment key={label}>
              <div className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    index <= activeStep
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {index < activeStep ? (
                    <CheckIcon className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className={`ml-2 text-sm ${
                  index <= activeStep
                    ? 'text-primary-600 dark:text-primary-400 font-semibold'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${
                  index < activeStep
                    ? 'bg-primary-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {renderStepContent()}

        <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={onCancel}
            disabled={loading}
            variant="outline"
          >
            Cancel
          </Button>
          {activeStep === 2 && (
            <Button
              onClick={handleComplete}
              variant="primary"
              disabled={loading}
            >
              Complete Setup
            </Button>
          )}
          {activeStep > 0 && activeStep < 2 && (
            <Button
              onClick={() => setActiveStep(activeStep - 1)}
              disabled={loading}
              variant="outline"
            >
              Back
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default TwoFactorSetup;
