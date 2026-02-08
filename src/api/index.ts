// Re-export everything from the modular API files
export * from './auth';
export * from './client';
export * from './mood';
export * from './dashboard';
export * from './errors';
export * from './constants';
export * from './notifications';
export * from './journaling';
export * from './meditation';
export * from './users';
export * from './onboarding';
export * from './ai';
export * from './admin';
export * from './leaderboard';
export * from './challenges';
export * from './memories';
export * from './sync';
export * from './chat';
export * from './audio';
export * from './rewards';
export * from './social';
export * from './feedback';
export * from './health';
export * from './integrations';
export * from './security';
export * from './subscription';
export * from './voice';
export * from './consent';
export * from './crisis';
export * from './cbt';
export * from './dataRetention';

// Legacy exports for backward compatibility
export { api as default } from './client';
export { API_BASE_URL } from './client';