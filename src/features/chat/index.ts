/**
 * Chat/AI Feature Module
 * 
 * Centralized exports for AI chat functionality.
 */

// Components
export { default as WorldClassAIChat } from '../../components/WorldClassAIChat';
export { default as VoiceChat } from '../../components/VoiceChat';

// Hooks
export { useChatData } from './hooks/useChatData';

// Types
export type { ChatMessage, ChatSession, AIResponse } from './types';
