import { useEffect, useRef } from 'react';
import { KeyStorageService } from '../services/keyStorageService';

export const useSessionManager = (isUnlocked: boolean, onLock: () => void) => {
  const idleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundTime = useRef<number | null>(null);

  useEffect(() => {
    if (!isUnlocked) return;

    // --- 5-Minute Idle Timeout ---
    const resetIdle = () => {
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
      idleTimeout.current = setTimeout(async () => {
        console.log("Session locked due to 5-minute inactivity.");
        await KeyStorageService.wipeSession();
        onLock();
      }, 5 * 60 * 1000);
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('touchstart', resetIdle);
    window.addEventListener('keydown', resetIdle);
    resetIdle();

    // --- 30-Second Background Lock ---
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        // App went to background
        backgroundTime.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        // App came to foreground
        if (backgroundTime.current) {
          const timeInBackground = Date.now() - backgroundTime.current;
          if (timeInBackground > 30 * 1000) { // 30 seconds
            console.log("Session locked due to >30s background time.");
            await KeyStorageService.wipeSession();
            onLock();
          }
          backgroundTime.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('touchstart', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
    };
  }, [isUnlocked, onLock]);
};
