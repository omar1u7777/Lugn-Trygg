import { useRef, useEffect } from 'react';

/**
 * Returns a ref that is `true` while the component is mounted and `false`
 * after it unmounts. Useful for guarding async state updates and side effects.
 */
export function useMountedRef() {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return mountedRef;
}
