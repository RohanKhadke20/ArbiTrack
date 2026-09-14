import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

/**
 * A wrapper around Dexie's useLiveQuery that automatically decrypts the results
 * using the DBEncryptionService.
 */
export function useSecureLiveQuery<T>(
  querier: () => Promise<T[] | undefined>,
  decryptor: (item: T) => Promise<T>,
  deps: unknown[] = []
): T[] | undefined {
  const rawData = useLiveQuery(querier, deps);
  const [decryptedData, setDecryptedData] = useState<T[] | undefined>(undefined);

  // Wrap decryptor in useCallback so it doesn't trigger the effect on every render
  const stableDecryptor = useCallback((item: T) => decryptor(item), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let isMounted = true;

    const decryptAll = async () => {
      if (rawData === undefined) {
        if (isMounted) setDecryptedData(undefined);
        return;
      }
      
      try {
        const decrypted = await Promise.all(rawData.map(item => stableDecryptor(item)));
        if (isMounted) setDecryptedData(decrypted);
      } catch (err) {
        console.error("Decryption failed in useSecureLiveQuery:", err);
        // If decryption fails (e.g. app locked), we return empty or undefined
        if (isMounted) setDecryptedData([]);
      }
    };

    decryptAll();

    return () => {
      isMounted = false;
    };
  }, [rawData, stableDecryptor]);

  return decryptedData;
}
