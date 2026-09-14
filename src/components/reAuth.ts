/**
 * reAuth.ts
 * Exported separately from Guards.tsx so that fast-refresh works correctly.
 */

export const withReAuth = async (action: () => Promise<void> | void): Promise<boolean> => {
  try {
    await action();
    return true;
  } catch (err) {
    console.error("Action error in bypassed reauth:", err);
    return false;
  }
};
