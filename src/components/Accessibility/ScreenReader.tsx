import React, { useEffect, useRef, memo } from 'react';

/**
 * Props for the ScreenReaderOnly component.
 * This component visually hides content but makes it available to screen readers.
 */
interface ScreenReaderOnlyProps {
  /** The content to be hidden visually but accessible to screen readers. */
  children: React.ReactNode;
  /** Whether to announce changes to the content. */
  announce?: boolean;
  /** The politeness level for announcements. */
  politeness?: 'polite' | 'assertive';
  /** Whether the announcement should be atomic. */
  atomic?: boolean;
}

/**
 * Component that renders content visible only to screen readers.
 * Uses Tailwind's sr-only class for visual hiding.
 */
export const ScreenReaderOnly: React.FC<ScreenReaderOnlyProps> = memo(({
  children,
  announce = false,
  politeness = 'polite',
  atomic = true,
}) => {
  return (
    <span
      className="sr-only"
      aria-live={announce ? politeness : undefined}
      aria-atomic={announce ? atomic : undefined}
    >
      {children}
    </span>
  );
});

/**
 * Props for the LiveRegion component.
 * Used for dynamic content that should be announced to screen readers.
 */
interface LiveRegionProps {
  /** The content to be announced. */
  children: React.ReactNode;
  /** The politeness level for announcements. */
  politeness?: 'polite' | 'assertive';
  /** Whether the announcement should be atomic. */
  atomic?: boolean;
  /** The ARIA role for the live region. */
  role?: 'status' | 'alert' | 'log';
}

/**
 * Component that creates a live region for screen reader announcements.
 * Content changes within this region are announced to assistive technologies.
 */
export const LiveRegion: React.FC<LiveRegionProps> = memo(({
  children,
  politeness = 'polite',
  atomic = true,
  role = 'status',
}) => {
  return (
    <div
      role={role}
      aria-live={politeness}
      aria-atomic={atomic}
    >
      {children}
    </div>
  );
});

/**
 * Props for the ScreenReaderAnnouncer component.
 * Used to announce messages to screen readers with optional delay.
 */
interface ScreenReaderAnnouncerProps {
  /** The message to announce. If empty or whitespace, no announcement occurs. */
  message: string;
  /** The politeness level for the announcement. */
  politeness?: 'polite' | 'assertive';
  /** Delay in milliseconds before announcing. */
  delay?: number;
}

/**
 * Component that announces a message to screen readers after an optional delay.
 * Handles edge cases like empty messages and cleans up timeouts on unmount.
 */
export const ScreenReaderAnnouncer: React.FC<ScreenReaderAnnouncerProps> = memo(({
  message,
  politeness = 'polite',
  delay = 0,
}) => {
  const [announce, setAnnounce] = React.useState(false);

  useEffect(() => {
    const trimmedMessage = message?.trim();
    if (trimmedMessage) {
      const timeoutId = setTimeout(() => {
        setAnnounce(true);
        // Reset after a short period to allow re-announcement if message changes
        setTimeout(() => setAnnounce(false), 1000);
      }, delay);

      return () => clearTimeout(timeoutId);
    } else {
      setAnnounce(false);
      return undefined;
    }
  }, [message, delay]);

  if (!announce) return null;

  return (
    <LiveRegion politeness={politeness}>
      {message.trim()}
    </LiveRegion>
  );
});

/**
 * Hook for programmatic screen reader announcements.
 * Provides a function to announce messages and a component to render the live region.
 *
 * @returns An object with `announce` function and `Announcer` component.
 */
export const useScreenReader = () => {
  const announceRef = useRef<HTMLDivElement>(null);

  const announce = React.useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    if (announceRef.current && message?.trim()) {
      announceRef.current.textContent = message.trim();
      announceRef.current.setAttribute('aria-live', politeness);
    }
  }, []);

  /**
   * Component that must be rendered in the DOM for announcements to work.
   * Place this in a persistent location, like the app root.
   */
  const Announcer = React.memo(() => (
    <div
      ref={announceRef}
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  ));

  return {
    announce,
    Announcer,
  };
};

// Named exports are preferred for better tree-shaking and explicit imports
