// Minimal Sentry interface for CDN-loaded Sentry
interface SentryClient {
  captureException(error: unknown, context?: Record<string, unknown>): void;
}

// Minimal analytics interface
interface AnalyticsClient {
  track(event: string, properties?: Record<string, unknown>): void;
}

// Background Sync API (not in lib.dom.d.ts)
interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

declare global {
  // Utöka Window-objektet med en electron-egenskap
  interface Window {
    electron: {
      // Skicka meddelande till main-processen
      send: (channel: string, data: unknown) => void;

      // Ta emot meddelande från main-processen
      receive: (channel: string, func: (data: unknown) => void) => void;
    };

    // Speech Recognition API
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;

    // React globals (for CDN/legacy interop)
    React: typeof import('react');
    ReactDOM: typeof import('react-dom');

    // Optional CDN-loaded services
    Sentry?: SentryClient;
    analytics?: AnalyticsClient;

    // Webkit prefix for AudioContext
    webkitAudioContext?: typeof AudioContext;
  }

  // Background Sync API augmentation
  interface ServiceWorkerRegistration {
    sync: SyncManager;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
    onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
  }

  interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
  }

  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };
}

// Exporten gör så att TypeScript behandlar denna fil som en modul
export {};
