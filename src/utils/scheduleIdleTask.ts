type IdleCallback = () => void;

declare global {
  interface Window {
    requestIdleCallback?: (callback: IdleDeadline | ((deadline: IdleDeadline) => void), options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  }

  interface IdleDeadline {
    didTimeout: boolean;
    timeRemaining: () => number;
  }

  interface IdleRequestOptions {
    timeout?: number;
  }
}

export const scheduleIdleTask = (callback: IdleCallback, timeout = 1500) => {
  if (typeof window === 'undefined') {
    callback();
    return -1;
  }

  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(() => callback(), { timeout });
  }

  return window.setTimeout(callback, timeout);
};

export const cancelIdleTask = (handle: number) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle);
    return;
  }

  window.clearTimeout(handle);
};
