import crypto from 'crypto';
import type express from 'express';
import { parseCookieHeader } from './adminAuth.js';
import type { GoogleAuthUser } from '../src/types.js';

export const USER_COOKIE_NAME = 'sathi_user_session';
const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const EPHEMERAL_USER_SECRET = crypto.randomBytes(32).toString('hex');

interface UserSessionPayload {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  iat: number;
  exp: number;
  jti: string;
}

interface OAuthStatePayload {
  nonce: string;
  origin: string;
  exp: number;
}

export interface VerifiedGoogleIdentity {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
}

function getUserSessionSecret(): string {
  const configured =
    process.env.USER_SESSION_SECRET?.trim() || process.env.ADMIN_SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_USER_SECRET;
}

function constantTimeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function signBase64Payload(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getUserSessionSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyBase64Payload<T>(token: string): T | null {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getUserSessionSecret())
    .update(data)
    .digest('base64url');

  if (!constantTimeCompare(sig, expectedSig)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function sanitizeExternalAvatarUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
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

export function getGoogleOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  configured: boolean;
  codeFlowReady: boolean;
} {
  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    ''
  ).trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId),
    codeFlowReady: Boolean(clientId && clientSecret),
  };
}

export function resolveRequestOrigin(req: express.Request): string {
  const envAppUrl = process.env.APP_URL?.trim();
  if (envAppUrl) {
    try {
      return new URL(envAppUrl).origin;
    } catch {
      // Fallback to forwarded host headers
    }
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto =
    typeof forwardedProto === 'string' && forwardedProto.trim()
      ? forwardedProto.split(',')[0].trim()
      : req.protocol || 'http';
  const forwardedHost = req.headers['x-forwarded-host'];
  const host =
    (typeof forwardedHost === 'string' && forwardedHost.split(',')[0].trim()) ||
    req.get('host') ||
    'localhost:3000';
  return `${proto}://${host}`;
}

export function createSignedOAuthState(origin: string): string {
  const payload: OAuthStatePayload = {
    nonce: crypto.randomBytes(16).toString('hex'),
    origin,
    exp: Date.now() + OAUTH_STATE_TTL_MS,
  };
  return signBase64Payload(payload);
}

export function verifySignedOAuthState(state: string): OAuthStatePayload | null {
  const payload = verifyBase64Payload<OAuthStatePayload>(state);
  if (!payload || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
    return null;
  }
  if (typeof payload.origin !== 'string' || typeof payload.nonce !== 'string') {
    return null;
  }
  return payload;
}

function isHttpsRequest(req: express.Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  return typeof proto === 'string' && proto.toLowerCase().includes('https');
}

export function verifySameOriginMutation(req: express.Request): boolean {
  const xRequestedWith = req.headers['x-requested-with'];
  if (typeof xRequestedWith === 'string' && xRequestedWith.trim().length > 0) {
    return true;
  }
  const origin = req.headers.origin;
  const host =
    (typeof req.headers['x-forwarded-host'] === 'string' &&
      req.headers['x-forwarded-host'].split(',')[0].trim()) ||
    req.get('host');
  if (typeof origin === 'string' && host) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

export function issueUserSessionCookie(
  req: express.Request,
  res: express.Response,
  user: GoogleAuthUser
): void {
  const now = Date.now();
  const payload: UserSessionPayload = {
    uid: user.uid,
    email: user.email.toLowerCase(),
    name: user.name,
    photoURL: user.photoURL,
    iat: now,
    exp: now + USER_SESSION_TTL_MS,
    jti: crypto.randomBytes(12).toString('hex'),
  };
  const token = signBase64Payload(payload);
  const https = isHttpsRequest(req);
  const cookieAttrs = https
    ? 'HttpOnly; SameSite=None; Secure; Partitioned'
    : 'HttpOnly; SameSite=Lax';
  const maxAgeSec = Math.floor(USER_SESSION_TTL_MS / 1000);
  res.append(
    'Set-Cookie',
    `${USER_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; ${cookieAttrs}; Max-Age=${maxAgeSec}`
  );
}

export function clearUserSessionCookie(req: express.Request, res: express.Response): void {
  const https = isHttpsRequest(req);
  const cookieAttrs = https
    ? 'HttpOnly; SameSite=None; Secure; Partitioned'
    : 'HttpOnly; SameSite=Lax';
  res.append(
    'Set-Cookie',
    `${USER_COOKIE_NAME}=; Path=/; ${cookieAttrs}; Max-Age=0`
  );
}

export function getUserSessionFromRequest(req: express.Request): GoogleAuthUser | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies[USER_COOKIE_NAME];
  if (!token) return null;

  const payload = verifyBase64Payload<UserSessionPayload>(token);
  if (
    !payload ||
    typeof payload.uid !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.exp !== 'number' ||
    Date.now() > payload.exp
  ) {
    return null;
  }

  return {
    uid: payload.uid,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    photoURL: sanitizeExternalAvatarUrl(payload.photoURL),
    loggedInAt: new Date(payload.iat || Date.now()).toISOString(),
  };
}

export async function verifyGoogleAccessToken(
  accessToken: string,
  expectedClientId: string
): Promise<VerifiedGoogleIdentity> {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('Google access token is required.');
  }

  // Verify token audience/client binding via Google tokeninfo endpoint
  const tokenInfoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
  );
  if (!tokenInfoRes.ok) {
    throw new Error('Google OAuth token verification failed.');
  }
  const tokenInfo = (await tokenInfoRes.json()) as {
    aud?: string;
    azp?: string;
    email_verified?: string | boolean;
  };
  if (
    expectedClientId &&
    tokenInfo.aud !== expectedClientId &&
    tokenInfo.azp !== expectedClientId
  ) {
    throw new Error('Google OAuth token audience mismatch.');
  }

  // Fetch verified user profile from Google UserInfo endpoint
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) {
    throw new Error('Could not fetch Google account profile.');
  }

  const profile = (await profileRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    throw new Error('Verified Gmail account is required.');
  }

  return {
    googleId: profile.sub,
    email: profile.email.trim().toLowerCase(),
    name: (profile.name || profile.email.split('@')[0]).trim(),
    avatarUrl: sanitizeExternalAvatarUrl(profile.picture),
  };
}

export async function exchangeGoogleAuthCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<VerifiedGoogleIdentity> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    throw new Error('Failed to exchange Google OAuth authorization code.');
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error('Google OAuth token response missing access_token.');
  }

  return verifyGoogleAccessToken(tokenData.access_token, clientId);
}
