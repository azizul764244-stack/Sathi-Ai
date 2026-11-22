import type { AppStateResponse, GoogleAuthUser } from '../types';

const GOOGLE_USER_STORAGE_KEY = 'sathi_google_user_v1';

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleOAuth2Namespace {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    prompt?: string;
    callback: (resp: GoogleTokenResponse) => void;
    error_callback?: (err: { type?: string; message?: string }) => void;
  }) => {
    requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
  };
}

interface GoogleAccountsNamespace {
  accounts?: {
    oauth2?: GoogleOAuth2Namespace;
    id?: {
      disableAutoSelect?: () => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleAccountsNamespace;
  }
}

export interface GoogleOAuthConfigResponse {
  configured: boolean;
  clientId: string | null;
  codeFlowReady: boolean;
  redirectUri: string;
}

export class GoogleAuthSetupError extends Error {
  code: 'NOT_CONFIGURED' | 'POPUP_CANCELLED' | 'AUTH_FAILED';
  redirectUri?: string;

  constructor(
    message: string,
    code: 'NOT_CONFIGURED' | 'POPUP_CANCELLED' | 'AUTH_FAILED',
    redirectUri?: string
  ) {
    super(message);
    this.code = code;
    this.redirectUri = redirectUri;
  }
}

function sanitizePhotoUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export function getStoredGoogleUser(): GoogleAuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GOOGLE_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GoogleAuthUser>;
    if (
      parsed &&
      typeof parsed.uid === 'string' &&
      typeof parsed.email === 'string' &&
      parsed.email.includes('@') &&
      typeof parsed.name === 'string'
    ) {
      return {
        uid: parsed.uid,
        name: parsed.name,
        email: parsed.email,
        photoURL: sanitizePhotoUrl(parsed.photoURL),
        loggedInAt: parsed.loggedInAt || new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredGoogleUser(user: GoogleAuthUser): GoogleAuthUser {
  const safeUser: GoogleAuthUser = {
    uid: user.uid,
    name: user.name,
    email: user.email,
    photoURL: sanitizePhotoUrl(user.photoURL),
    loggedInAt: user.loggedInAt || new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(GOOGLE_USER_STORAGE_KEY, JSON.stringify(safeUser));
    } catch {
      // Ignore storage quota errors
    }
  }
  return safeUser;
}

export function clearStoredGoogleUser(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GOOGLE_USER_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function fetchGoogleAuthConfig(): Promise<GoogleOAuthConfigResponse> {
  const res = await fetch('/api/auth/google/config', { cache: 'no-store' });
  if (!res.ok) {
    return {
      configured: false,
      clientId: null,
      codeFlowReady: false,
      redirectUri: `${window.location.origin}/api/auth/google/callback`,
    };
  }
  return (await res.json()) as GoogleOAuthConfigResponse;
}

export async function fetchServerGoogleSession(): Promise<GoogleAuthUser | null> {
  try {
    const res = await fetch('/api/auth/user/session', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { authenticated?: boolean; authUser?: GoogleAuthUser | null };
    if (data.authenticated && data.authUser) {
      return saveStoredGoogleUser(data.authUser);
    }
    return null;
  } catch {
    return null;
  }
}

async function ensureGoogleIdentityScriptLoaded(): Promise<GoogleOAuth2Namespace> {
  if (window.google?.accounts?.oauth2) {
    return window.google.accounts.oauth2;
  }

  await new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src^="https://accounts.google.com/gsi/client"]'
    );

    const onReadyCheck = () => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return true;
      }
      return false;
    };

    if (onReadyCheck()) return;

    const timeout = window.setTimeout(() => {
      reject(new Error('Google Identity Services could not load.'));
    }, 8000);

    const handleLoad = () => {
      window.clearTimeout(timeout);
      if (!onReadyCheck()) {
        reject(new Error('Google Identity Services OAuth2 client unavailable.'));
      }
    };

    const handleError = () => {
      window.clearTimeout(timeout);
      reject(new Error('Failed to load Google Identity Services script.'));
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      // Poll briefly in case script already finished loading before listener attached
      const poll = window.setInterval(() => {
        if (onReadyCheck()) {
          window.clearInterval(poll);
          window.clearTimeout(timeout);
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = handleLoad;
    script.onerror = handleError;
    document.head.appendChild(script);
  });

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services OAuth2 client unavailable.');
  }
  return window.google.accounts.oauth2;
}

async function signInViaCodePopupFallback(): Promise<{
  authUser: GoogleAuthUser;
  isNewUser: boolean;
}> {
  const urlRes = await fetch('/api/auth/google/url', { credentials: 'same-origin' });
  const urlData = (await urlRes.json()) as { url?: string; error?: string };
  if (!urlRes.ok || !urlData.url) {
    throw new GoogleAuthSetupError(
      urlData.error || 'Could not initialize Google Sign-In.',
      'AUTH_FAILED'
    );
  }

  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 650;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const popup = window.open(
      urlData.url,
      'google_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      reject(
        new GoogleAuthSetupError(
          'পপআপ ব্লক করা হয়েছে। অনুগ্রহ করে ব্রাউজারের পপআপ অনুমতি দিয়ে আবার চেষ্টা করুন।',
          'POPUP_CANCELLED'
        )
      );
      return;
    }

    let settled = false;
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedTimer);
    };

    const onMessage = (event: MessageEvent) => {
      const origin = event.origin;
      const isTrustedOrigin =
        origin === window.location.origin ||
        origin.endsWith('.run.app') ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost');
      if (!isTrustedOrigin) return;

      if (event.data?.type === 'GOOGLE_OAUTH_AUTH_SUCCESS' && event.data.authUser) {
        settled = true;
        cleanup();
        const saved = saveStoredGoogleUser(event.data.authUser as GoogleAuthUser);
        resolve({ authUser: saved, isNewUser: Boolean(event.data.isNewUser) });
      } else if (event.data?.type === 'GOOGLE_OAUTH_AUTH_ERROR') {
        settled = true;
        cleanup();
        reject(
          new GoogleAuthSetupError(
            String(event.data.error || 'Google Sign-In failed.'),
            'AUTH_FAILED'
          )
        );
      }
    };

    window.addEventListener('message', onMessage);

    const closedTimer = window.setInterval(() => {
      if (popup.closed && !settled) {
        settled = true;
        cleanup();
        reject(
          new GoogleAuthSetupError(
            'Google অ্যাকাউন্ট নির্বাচন বাতিল করা হয়েছে।',
            'POPUP_CANCELLED'
          )
        );
      }
    }, 350);
  });
}

async function signInWithDemoFallback(): Promise<{
  authUser: GoogleAuthUser;
  state?: AppStateResponse;
  isNewUser: boolean;
}> {
  try {
    const res = await fetch('/api/auth/google/demo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin',
    });
    const data = (await res.json()) as {
      ok?: boolean;
      isNewUser?: boolean;
      authUser?: GoogleAuthUser;
      state?: AppStateResponse;
    };
    if (res.ok && data.ok && data.authUser) {
      const savedUser = saveStoredGoogleUser(data.authUser);
      return {
        authUser: savedUser,
        state: data.state,
        isNewUser: Boolean(data.isNewUser),
      };
    }
  } catch {
    // Fallback cleanly to local session storage if server unreachable
  }

  const localDemoUser = saveStoredGoogleUser({
    uid: 'usr_g_demo_sathi',
    name: 'Sathi Bondhu',
    email: 'sathibd.user@gmail.com',
    photoURL: '/sathi-logo.png',
    loggedInAt: new Date().toISOString(),
  });
  return { authUser: localDemoUser, isNewUser: false };
}

export async function signInWithGoogleOneClick(): Promise<{
  authUser: GoogleAuthUser;
  state?: AppStateResponse;
  isNewUser: boolean;
}> {
  const cfg = await fetchGoogleAuthConfig();

  if (!cfg.configured || !cfg.clientId) {
    return signInWithDemoFallback();
  }

  try {
    const oauth2 = await ensureGoogleIdentityScriptLoaded();

    const accessToken = await new Promise<string>((resolve, reject) => {
      const tokenClient = oauth2.initTokenClient({
        client_id: cfg.clientId!,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: (resp) => {
          if (resp.error) {
            reject(
              new GoogleAuthSetupError(
                resp.error_description || 'Google Sign-In cancelled.',
                resp.error === 'popup_closed_by_user' ? 'POPUP_CANCELLED' : 'AUTH_FAILED'
              )
            );
            return;
          }
          if (!resp.access_token) {
            reject(new GoogleAuthSetupError('Google access token missing.', 'AUTH_FAILED'));
            return;
          }
          resolve(resp.access_token);
        },
        error_callback: (err) => {
          const isPopupClosed =
            err?.type === 'popup_closed' || err?.type === 'popup_failed_to_open';
          reject(
            new GoogleAuthSetupError(
              isPopupClosed
                ? 'Google পপআপ বন্ধ বা ব্লক হয়েছে। আবার চেষ্টা করুন।'
                : err?.message || 'Google Sign-In error.',
              isPopupClosed ? 'POPUP_CANCELLED' : 'AUTH_FAILED'
            )
          );
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });

    const verifyRes = await fetch('/api/auth/google/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ accessToken }),
    });

    const verifyData = (await verifyRes.json()) as {
      ok?: boolean;
      error?: string;
      isNewUser?: boolean;
      authUser?: GoogleAuthUser;
      state?: AppStateResponse;
    };

    if (!verifyRes.ok || !verifyData.ok || !verifyData.authUser) {
      throw new GoogleAuthSetupError(
        verifyData.error || 'Google Sign-In verification failed.',
        'AUTH_FAILED'
      );
    }

    const savedUser = saveStoredGoogleUser(verifyData.authUser);
    return {
      authUser: savedUser,
      state: verifyData.state,
      isNewUser: Boolean(verifyData.isNewUser),
    };
  } catch (err) {
    if (err instanceof GoogleAuthSetupError && err.code === 'POPUP_CANCELLED') {
      throw err;
    }
    if (cfg.codeFlowReady) {
      return signInViaCodePopupFallback();
    }
    throw err;
  }
}

export async function logoutGoogleUser(): Promise<void> {
  try {
    await fetch('/api/auth/user/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin',
    });
  } catch {
    // Still clear local session cleanly
  }
  try {
    window.google?.accounts?.id?.disableAutoSelect?.();
  } catch {
    // Ignore GIS unavailable
  }
  clearStoredGoogleUser();
}
