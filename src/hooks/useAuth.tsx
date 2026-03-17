'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

interface AuthState {
  isEditor: boolean;
  isLoading: boolean;
  editorToken: string | null;
  unlock: (passcode: string) => Promise<{ success: boolean; error?: string }>;
  lock: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = 'schedule-editor';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isEditor, setIsEditor] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editorToken, setEditorToken] = useState<string | null>(null);

  // On mount, check localStorage and validate session via /api/auth/status
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      fetch('/api/auth/status')
        .then((res) => res.json())
        .then((data: { authenticated: boolean; token?: string }) => {
          if (data.authenticated && data.token) {
            setIsEditor(true);
            setEditorToken(data.token);
          } else {
            // Cookie expired or invalid -- clear localStorage
            localStorage.removeItem(STORAGE_KEY);
            setIsEditor(false);
            setEditorToken(null);
          }
        })
        .catch(() => {
          localStorage.removeItem(STORAGE_KEY);
          setIsEditor(false);
          setEditorToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const unlock = useCallback(
    async (
      passcode: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const verifyRes = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode }),
        });

        if (!verifyRes.ok) {
          const data = await verifyRes.json().catch(() => ({}));
          return {
            success: false,
            error: data.error ?? 'Invalid passcode',
          };
        }

        // Verify succeeded -- cookie is set. Now retrieve the token.
        const statusRes = await fetch('/api/auth/status');
        const statusData: { authenticated: boolean; token?: string } =
          await statusRes.json();

        if (statusData.authenticated && statusData.token) {
          localStorage.setItem(STORAGE_KEY, 'true');
          setIsEditor(true);
          setEditorToken(statusData.token);
          return { success: true };
        }

        return { success: false, error: 'Failed to retrieve editor token' };
      } catch {
        return { success: false, error: 'Network error' };
      }
    },
    []
  );

  const lock = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIsEditor(false);
    setEditorToken(null);
    // Fire-and-forget cookie cleanup
    fetch('/api/auth/lock', { method: 'POST' }).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider
      value={{ isEditor, isLoading, editorToken, unlock, lock }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
