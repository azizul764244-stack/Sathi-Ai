import express from 'express';
import dotenv from 'dotenv';
import {
  clearAdminSessionCookie,
  checkLoginRateLimit,
  getAdminSessionFromRequest,
  getClientIp,
  issueAdminSessionCookie,
  recordFailedLoginAttempt,
  requireAdmin,
  resetLoginRateLimit,
  verifyAdminCredentials,
  type AuthenticatedAdminRequest,
} from './adminAuth.js';
import {
  addHistoryItem,
  adminCreateUser,
  adminUpdateAppSettings,
  adminUpdatePlanConfig,
  adminUpdateUserPlan,
  adminUpdateUserQuota,
  adminUpdateUserStatus,
  appendConversationTurn,
  checkFeatureAvailable,
  checkQuotaAvailable,
  clearAllConversations,
  clearApiLogs,
  clearHistoryItems,
  consumeQuota,
  createConversation,
  deleteConversationById,
  deleteHistoryItem,
  ensureGoogleUserActive,
  getActiveAiModel,
  getAdminDashboardData,
  getAppSettings,
  getConversationById,
  getConversations,
  getFullState,
  isValidGeminiModelId,
  loginOrRegisterGoogleUser,
  recordAdminLog,
  recordApiLog,
  rejectPaymentRequest,
  submitPaymentRequest,
  trackAdEvent,
  updateActiveAiModel,
  updateAdSystem,
  updateConversationMeta,
  updateProfile,
  updateQuotaLimits,
  verifyPaymentAndActivate,
} from './store.js';
import {
  advisePhotoThumbnail,
  clearResponseCache,
  discoverSupportedModels,
  generateFlowAiVideo,
  generateOrEditImage,
  generateSocialContent,
  generateVideoPromptAndStoryboard,
  normalizeGeminiError,
  streamAssistantChat,
  streamEducationQuestion,
  streamHealthGuidance,
  streamInternationalJobs,
  synthesizeSpeechAudio,
  transcribeVoiceAudio,
  verifyGeminiConnection,
} from './gemini.js';
import { normalizeLanguageCode } from '../src/constants/languages.js';
import {
  getGlobalAyahNumber,
  OFFLINE_FALLBACK_SURAHS,
  QURAN_SURAHS,
  type QuranAyahItem,
} from '../src/data/quranSurahs.js';
import { transliterateQuranToBengali } from '../src/utils/quranTransliteration.js';
import type {
  GoogleAuthUser,
  PaymentMethod,
  ResponseLanguageCode,
  SubscriptionPlanId,
} from '../src/types.js';
import {
  clearUserSessionCookie,
  createSignedOAuthState,
  exchangeGoogleAuthCode,
  getGoogleOAuthConfig,
  getUserSessionFromRequest,
  issueUserSessionCookie,
  resolveRequestOrigin,
  verifyGoogleAccessToken,
  verifySameOriginMutation,
  verifySignedOAuthState,
} from './userAuth.js';

dotenv.config();

export function createApiApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '15mb' }));

function logAiOutcome(params: {
  endpoint: string;
  tool: string;
  language: ResponseLanguageCode;
  startedAt: number;
  model?: string;
  cached?: boolean;
  err?: unknown;
}): void {
  const latencyMs = Date.now() - params.startedAt;
  const model = params.model || getActiveAiModel();
  if (!params.err) {
    recordApiLog({
      endpoint: params.endpoint,
      tool: params.tool,
      model,
      language: params.language,
      status: 'success',
      httpStatus: 200,
      latencyMs,
      cached: Boolean(params.cached),
    });
    return;
  }

  const normalized = normalizeGeminiError(params.err, model);
  const status =
    normalized.errorCode === 'rate_limit'
      ? 'rate_limit_429'
      : normalized.errorCode === 'quota_exhausted'
        ? 'quota_429'
        : 'error';

  recordApiLog({
    endpoint: params.endpoint,
    tool: params.tool,
    model,
    language: params.language,
    status,
    httpStatus: normalized.status,
    latencyMs,
    cached: false,
    errorCode: normalized.errorCode,
    errorMessage: normalized.message,
  });
}

function sendAccessDeniedOrQuota(
  res: express.Response,
  check: ReturnType<typeof checkQuotaAvailable>,
  endpoint: string,
  tool: string,
  language: ResponseLanguageCode
): void {
  const httpStatus = check.status ?? 429;
  const errorCode = check.errorCode ?? 'quota_exhausted';
  recordApiLog({
    endpoint,
    tool,
    model: getActiveAiModel(),
    language,
    status: errorCode === 'quota_exhausted' ? 'quota_429' : 'error',
    httpStatus,
    latencyMs: 1,
    cached: false,
    errorCode,
    errorMessage: check.message,
  });
  res.status(httpStatus).json({
    error: check.message,
    errorCode,
    quota: check.quota,
    retryable: false,
  });
}

function sendAiError(res: express.Response, err: unknown, attemptedModel?: string): void {
  const normalized = normalizeGeminiError(err, attemptedModel);
  res.status(normalized.status).json({
    error: normalized.message,
    errorCode: normalized.errorCode,
    retryable: normalized.retryable,
    retryAfterSec: normalized.retryAfterSec,
  });
}

function initSse(res: express.Response): (payload: unknown) => void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  return (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
}

function resolveRequestedLanguage(bodyLang: unknown): ResponseLanguageCode {
  if (typeof bodyLang === 'string' && bodyLang.trim()) {
    return normalizeLanguageCode(bodyLang);
  }
  return getFullState().user.preferredLanguage;
}

function resolveRequestedModel(bodyModelId: unknown): string {
  const settings = getAppSettings();
  if (
    settings.aiSettings.allowUserModelSwitch &&
    typeof bodyModelId === 'string' &&
    isValidGeminiModelId(bodyModelId.trim())
  ) {
    return bodyModelId.trim();
  }
  return getActiveAiModel();
}

// ============================================================
// Public Application State & Language Routes
// ============================================================

app.get('/api/state', (req, res) => {
  const sessionUser = getUserSessionFromRequest(req);
  if (sessionUser) {
    ensureGoogleUserActive(sessionUser);
  }
  res.json(getFullState());
});

// ============================================================
// Real Google OAuth / Google Identity Services Auth Routes
// ============================================================

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

app.get('/api/auth/google/config', (req, res) => {
  const cfg = getGoogleOAuthConfig();
  const origin = resolveRequestOrigin(req);
  res.json({
    configured: cfg.configured,
    clientId: cfg.configured ? cfg.clientId : null,
    codeFlowReady: cfg.codeFlowReady,
    redirectUri: `${origin}/api/auth/google/callback`,
  });
});

app.get('/api/auth/user/session', (req, res) => {
  const authUser = getUserSessionFromRequest(req);
  if (!authUser) {
    res.json({ authenticated: false, authUser: null });
    return;
  }
  ensureGoogleUserActive(authUser);
  res.json({ authenticated: true, authUser });
});

app.post('/api/auth/google/token', async (req, res) => {
  const cfg = getGoogleOAuthConfig();
  if (!cfg.configured) {
    res.status(503).json({
      error: 'Google OAuth Client ID (GOOGLE_CLIENT_ID) is not configured on the server yet.',
      code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
    });
    return;
  }

  const accessToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
  if (!accessToken) {
    res.status(400).json({ error: 'Missing Google access token.' });
    return;
  }

  try {
    const identity = await verifyGoogleAccessToken(accessToken, cfg.clientId);
    const { user, isNewUser } = loginOrRegisterGoogleUser(identity);
    const authUser: GoogleAuthUser = {
      uid: user.id,
      name: user.name,
      email: user.email,
      photoURL: user.avatarUrl,
      loggedInAt: new Date().toISOString(),
    };
    issueUserSessionCookie(req, res, authUser);
    res.json({
      ok: true,
      isNewUser,
      authUser,
      state: getFullState(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Google sign-in verification failed.';
    res.status(401).json({ error: message, code: 'GOOGLE_TOKEN_INVALID' });
  }
});

app.post('/api/auth/google/demo', (req, res) => {
  if (!verifySameOriginMutation(req)) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }

  const demoIdentity = {
    googleId: 'demo-sathi-user',
    email: 'sathibd.user@gmail.com',
    name: 'Sathi Bondhu',
    avatarUrl: '/sathi-logo.png',
  };

  const { user, isNewUser } = loginOrRegisterGoogleUser(demoIdentity);
  const authUser: GoogleAuthUser = {
    uid: user.id,
    name: user.name,
    email: user.email,
    photoURL: user.avatarUrl || '/sathi-logo.png',
    loggedInAt: new Date().toISOString(),
  };
  issueUserSessionCookie(req, res, authUser);
  res.json({
    ok: true,
    demoMode: true,
    isNewUser,
    authUser,
    state: getFullState(),
  });
});

app.get('/api/auth/google/url', (req, res) => {
  const cfg = getGoogleOAuthConfig();
  if (!cfg.codeFlowReady) {
    res.status(503).json({
      error: 'Google OAuth code flow requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
    });
    return;
  }
  const origin = resolveRequestOrigin(req);
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = createSignedOAuthState(origin);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    access_type: 'online',
    state,
  });
  res.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    redirectUri,
  });
});

app.get(['/api/auth/google/callback', '/api/auth/google/callback/'], async (req, res) => {
  const cfg = getGoogleOAuthConfig();
  const rawError = typeof req.query.error === 'string' ? req.query.error : '';
  if (rawError) {
    res.status(400).send(
      `<!doctype html><html><body style="font-family:sans-serif;padding:24px;text-align:center;">
        <p>Google Sign-In cancelled or failed: ${escapeHtml(rawError)}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'GOOGLE_OAUTH_AUTH_ERROR', error: ${JSON.stringify(rawError).replace(/</g, '\\u003c')} }, '*');
            window.close();
          }
        </script>
      </body></html>`
    );
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const verifiedState = verifySignedOAuthState(state);

  if (!cfg.codeFlowReady || !code || !verifiedState) {
    res.status(400).send(
      `<!doctype html><html><body style="font-family:sans-serif;padding:24px;text-align:center;">
        <p>Invalid or expired Google Sign-In state. Please try again.</p>
      </body></html>`
    );
    return;
  }

  try {
    const redirectUri = `${verifiedState.origin}/api/auth/google/callback`;
    const identity = await exchangeGoogleAuthCode(code, redirectUri, cfg.clientId, cfg.clientSecret);
    const { user, isNewUser } = loginOrRegisterGoogleUser(identity);
    const authUser: GoogleAuthUser = {
      uid: user.id,
      name: user.name,
      email: user.email,
      photoURL: user.avatarUrl,
      loggedInAt: new Date().toISOString(),
    };
    issueUserSessionCookie(req, res, authUser);

    const payloadJson = JSON.stringify({
      type: 'GOOGLE_OAUTH_AUTH_SUCCESS',
      authUser,
      isNewUser,
    }).replace(/</g, '\\u003c');

    res.send(`<!doctype html>
      <html>
        <head><title>Signing in to Sathi AI BD...</title></head>
        <body style="font-family:sans-serif;padding:24px;text-align:center;color:#0f172a;">
          <p>Authentication successful. Returning to Sathi AI BD...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage(${payloadJson}, '*');
              window.close();
            } else {
              window.location.replace('/');
            }
          </script>
        </body>
      </html>`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Authentication failed.';
    res.status(401).send(
      `<!doctype html><html><body style="font-family:sans-serif;padding:24px;text-align:center;">
        <p>${escapeHtml(msg)}</p>
      </body></html>`
    );
  }
});

app.post('/api/auth/user/logout', (req, res) => {
  if (!verifySameOriginMutation(req)) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }
  clearUserSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/gemini/health', async (_req, res) => {
  const discoveredModels = await discoverSupportedModels(false);
  res.json({
    configured: Boolean(process.env.GEMINI_API_KEY),
    apiVersion: 'v1beta',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    activeModel: getActiveAiModel(),
    discoveredModels,
  });
});

app.post('/api/gemini/test', async (req, res) => {
  const { modelId, exactOnly } = req.body ?? {};
  const adminSession = getAdminSessionFromRequest(req);
  const targetModel =
    adminSession.authenticated && typeof modelId === 'string' && isValidGeminiModelId(modelId.trim())
      ? modelId.trim()
      : resolveRequestedModel(modelId);
  const result = await verifyGeminiConnection(targetModel, Boolean(exactOnly));
  res.status(result.ok ? 200 : result.configured ? 502 : 503).json(result);
});

app.post('/api/language', (req, res) => {
  const rawLang = req.body?.language ?? req.body?.preferredLanguage;
  const lang = normalizeLanguageCode(typeof rawLang === 'string' ? rawLang : undefined);
  const user = updateProfile({ preferredLanguage: lang });
  res.json({ user, state: getFullState() });
});

// ============================================================
// Hidden Admin Authentication Routes (Server-Side Authoritative)
// ============================================================

app.get('/api/auth/session', (req, res) => {
  res.json(getAdminSessionFromRequest(req));
});

app.post('/api/auth/admin-login', (req, res) => {
  const ip = getClientIp(req);
  const rateCheck = checkLoginRateLimit(ip);
  if (!rateCheck.allowed) {
    res.status(429).json({
      error: `অতিরিক্ত ভুল চেষ্টার কারণে লগইন সাময়িকভাবে সীমাবদ্ধ করা হয়েছে। অনুগ্রহ করে ${rateCheck.retryAfterSec} সেকেন্ড পর চেষ্টা করুন।`,
      retryAfterSec: rateCheck.retryAfterSec,
    });
    return;
  }

  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const verification = verifyAdminCredentials(email, password);

  if (!verification.ok || !verification.email) {
    recordFailedLoginAttempt(ip);
    recordAdminLog(
      'admin_login_failed',
      `অবৈধ অ্যাডমিন লগইন প্রচেষ্টা (${email.trim().slice(0, 60) || 'অজানা ইমেইল'})`,
      email.trim() || 'anonymous',
      ip
    );
    res.status(401).json({
      error: verification.reason || 'অ্যাডমিন অনুমোদন ব্যর্থ হয়েছে।',
    });
    return;
  }

  resetLoginRateLimit(ip);
  const token = issueAdminSessionCookie(req, res, verification.email);
  recordAdminLog('admin_login', 'অ্যাডমিন প্যানেলে সফলভাবে লগইন করেছেন', verification.email, ip);
  res.json({
    session: {
      authenticated: true,
      role: 'admin',
      email: verification.email,
      configured: true,
      missingVars: [],
    },
    token,
  });
});

app.post('/api/auth/admin-logout', (req, res) => {
  const existing = getAdminSessionFromRequest(req);
  const ip = getClientIp(req);
  if (existing.authenticated && existing.email) {
    recordAdminLog('admin_logout', 'অ্যাডমিন প্যানেল থেকে লগআউট করেছেন', existing.email, ip);
  }
  clearAdminSessionCookie(req, res);
  res.json({ ok: true });
});

// ============================================================
// AI Feature Routes (Guarded by Maintenance, Account Status & Quota + Real API Logs)
// ============================================================

// 1. Education AI
app.post('/api/ai/education', async (req, res) => {
  const startedAt = Date.now();
  const { subject, level, question, imageBase64, imageMimeType, responseLanguage, modelId, stream } = req.body ?? {};
  const settings = getAppSettings();
  const wantsStream =
    settings.aiSettings.streamEnabled &&
    (Boolean(stream) || req.headers.accept?.includes('text/event-stream'));

  if (!question && !imageBase64) {
    res.status(400).json({ error: 'অনুগ্রহ করে একটি প্রশ্ন লিখুন বা ছবি আপলোড করুন।' });
    return;
  }

  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);
  const quotaCheck = checkFeatureAvailable('educationEnabled');
  if (!quotaCheck.ok) {
    sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/education', 'education', lang);
    return;
  }

  if (wantsStream) {
    const writeSse = initSse(res);
    try {
      const result = await streamEducationQuestion(
        {
          subject: subject || 'সাধারণ',
          level: level || 'এসএসসি / এইচএসসি',
          question: question || '',
          imageBase64,
          imageMimeType,
          responseLanguage: lang,
          modelId: requestedModel,
        },
        (text) => writeSse({ type: 'delta', text })
      );

      const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
      const historyItem = addHistoryItem({
        tool: 'education',
        toolLabelBn: 'শিক্ষা AI',
        title: `${subject || 'শিক্ষা'}: ${(question || 'ছবি থেকে প্রশ্ন সমাধান').slice(0, 56)}`,
        prompt: question || 'ছবি আপলোড করে প্রশ্ন সমাধান',
        response: result.answer,
      });

      logAiOutcome({
        endpoint: '/api/ai/education',
        tool: 'education',
        language: lang,
        startedAt,
        model: result.modelUsed,
        cached: result.cached,
      });

      writeSse({
        type: 'done',
        answer: result.answer,
        modelUsed: result.modelUsed,
        historyItem,
        quota: updatedQuota,
      });
      res.end();
    } catch (err) {
      logAiOutcome({ endpoint: '/api/ai/education', tool: 'education', language: lang, startedAt, model: requestedModel, err });
      const normalized = normalizeGeminiError(err, requestedModel);
      writeSse({
        type: 'error',
        error: normalized.message,
        errorCode: normalized.errorCode,
        retryable: normalized.retryable,
        retryAfterSec: normalized.retryAfterSec,
      });
      res.end();
    }
    return;
  }

  try {
    const result = await streamEducationQuestion(
      {
        subject: subject || 'সাধারণ',
        level: level || 'এসএসসি / এইচএসসি',
        question: question || '',
        imageBase64,
        imageMimeType,
        responseLanguage: lang,
        modelId: requestedModel,
      },
      () => {}
    );
    const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
    const historyItem = addHistoryItem({
      tool: 'education',
      toolLabelBn: 'শিক্ষা AI',
      title: `${subject || 'শিক্ষা'}: ${(question || 'ছবি থেকে প্রশ্ন সমাধান').slice(0, 56)}`,
      prompt: question || 'ছবি আপলোড করে প্রশ্ন সমাধান',
      response: result.answer,
    });
    logAiOutcome({
      endpoint: '/api/ai/education',
      tool: 'education',
      language: lang,
      startedAt,
      model: result.modelUsed,
      cached: result.cached,
    });
    res.json({
      answer: result.answer,
      modelUsed: result.modelUsed,
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/education', tool: 'education', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

// 2. International Jobs (Google Search Grounded + SSE streaming)
app.post('/api/ai/jobs', async (req, res) => {
  const startedAt = Date.now();
  const { country, category, skills, responseLanguage, modelId, stream, clientManagedRetry } =
    req.body ?? {};
  const settings = getAppSettings();
  const wantsStream =
    settings.aiSettings.streamEnabled &&
    (Boolean(stream) || req.headers.accept?.includes('text/event-stream'));

  if (!country || !category) {
    res.status(400).json({ error: 'অনুগ্রহ করে দেশ এবং কাজের ধরন নির্বাচন করুন।' });
    return;
  }

  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);
  const quotaCheck = checkQuotaAvailable();
  if (!quotaCheck.ok) {
    sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/jobs', 'jobs', lang);
    return;
  }

  if (wantsStream) {
    const writeSse = initSse(res);
    try {
      const result = await streamInternationalJobs(
        {
          country,
          category,
          skills: skills || '',
          responseLanguage: lang,
          modelId: requestedModel,
          clientManagedRetry: Boolean(clientManagedRetry),
        },
        (text) => writeSse({ type: 'delta', text })
      );

      const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
      const historyItem = addHistoryItem({
        tool: 'jobs',
        toolLabelBn: 'বিদেশে চাকরি',
        title: `${country} — ${category}`,
        prompt: `${country} | ${category}${skills ? ` | ${skills}` : ''}`,
        response: result.answer,
        sources: result.sources,
      });

      logAiOutcome({
        endpoint: '/api/ai/jobs',
        tool: 'jobs',
        language: lang,
        startedAt,
        model: result.modelUsed,
        cached: result.cached,
      });

      writeSse({
        type: 'done',
        answer: result.answer,
        sources: result.sources,
        modelUsed: result.modelUsed,
        historyItem,
        quota: updatedQuota,
      });
      res.end();
    } catch (err) {
      logAiOutcome({ endpoint: '/api/ai/jobs', tool: 'jobs', language: lang, startedAt, model: requestedModel, err });
      const normalized = normalizeGeminiError(err, requestedModel);
      writeSse({
        type: 'error',
        error: normalized.message,
        errorCode: normalized.errorCode,
        retryable: normalized.retryable,
        retryAfterSec: normalized.retryAfterSec,
      });
      res.end();
    }
    return;
  }

  try {
    const result = await streamInternationalJobs(
      {
        country,
        category,
        skills: skills || '',
        responseLanguage: lang,
        modelId: requestedModel,
        clientManagedRetry: Boolean(clientManagedRetry),
      },
      () => {}
    );
    const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
    const historyItem = addHistoryItem({
      tool: 'jobs',
      toolLabelBn: 'বিদেশে চাকরি',
      title: `${country} — ${category}`,
      prompt: `${country} | ${category}${skills ? ` | ${skills}` : ''}`,
      response: result.answer,
      sources: result.sources,
    });
    logAiOutcome({
      endpoint: '/api/ai/jobs',
      tool: 'jobs',
      language: lang,
      startedAt,
      model: result.modelUsed,
      cached: result.cached,
    });
    res.json({
      answer: result.answer,
      sources: result.sources,
      modelUsed: result.modelUsed,
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/jobs', tool: 'jobs', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

// 3. Health Assistant
app.post('/api/ai/health', async (req, res) => {
  const startedAt = Date.now();
  const { mode, query, responseLanguage, modelId, stream } = req.body ?? {};
  const settings = getAppSettings();
  const wantsStream =
    settings.aiSettings.streamEnabled &&
    (Boolean(stream) || req.headers.accept?.includes('text/event-stream'));

  if (!query || !String(query).trim()) {
    res.status(400).json({ error: 'অনুগ্রহ করে আপনার স্বাস্থ্য বিষয়ক প্রশ্নটি লিখুন।' });
    return;
  }

  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);
  const quotaCheck = checkQuotaAvailable();
  if (!quotaCheck.ok) {
    sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/health', 'health', lang);
    return;
  }

  if (wantsStream) {
    const writeSse = initSse(res);
    try {
      const result = await streamHealthGuidance(
        {
          mode: mode || 'general',
          query: String(query),
          responseLanguage: lang,
          modelId: requestedModel,
        },
        (text) => writeSse({ type: 'delta', text })
      );

      const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
      const historyItem = addHistoryItem({
        tool: 'health',
        toolLabelBn: 'স্বাস্থ্য সহকারী',
        title: String(query).slice(0, 60),
        prompt: String(query),
        response: result.answer,
      });

      logAiOutcome({
        endpoint: '/api/ai/health',
        tool: 'health',
        language: lang,
        startedAt,
        model: result.modelUsed,
        cached: result.cached,
      });

      writeSse({
        type: 'done',
        answer: result.answer,
        isUrgent: result.isUrgent,
        modelUsed: result.modelUsed,
        historyItem,
        quota: updatedQuota,
      });
      res.end();
    } catch (err) {
      logAiOutcome({ endpoint: '/api/ai/health', tool: 'health', language: lang, startedAt, model: requestedModel, err });
      const normalized = normalizeGeminiError(err, requestedModel);
      writeSse({
        type: 'error',
        error: normalized.message,
        errorCode: normalized.errorCode,
        retryable: normalized.retryable,
        retryAfterSec: normalized.retryAfterSec,
      });
      res.end();
    }
    return;
  }

  try {
    const result = await streamHealthGuidance(
      {
        mode: mode || 'general',
        query: String(query),
        responseLanguage: lang,
        modelId: requestedModel,
      },
      () => {}
    );
    const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
    const historyItem = addHistoryItem({
      tool: 'health',
      toolLabelBn: 'স্বাস্থ্য সহকারী',
      title: String(query).slice(0, 60),
      prompt: String(query),
      response: result.answer,
    });
    logAiOutcome({
      endpoint: '/api/ai/health',
      tool: 'health',
      language: lang,
      startedAt,
      model: result.modelUsed,
      cached: result.cached,
    });
    res.json({
      answer: result.answer,
      isUrgent: result.isUrgent,
      modelUsed: result.modelUsed,
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/health', tool: 'health', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

// 4. Social Media AI
app.post('/api/ai/social', async (req, res) => {
  const startedAt = Date.now();
  const { platform, topic, tone, responseLanguage, modelId } = req.body ?? {};
  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);

  try {
    if (!topic || !String(topic).trim()) {
      res.status(400).json({ error: 'অনুগ্রহ করে ভিডিও বা পোস্টের বিষয় লিখুন।' });
      return;
    }

    const quotaCheck = checkQuotaAvailable();
    if (!quotaCheck.ok) {
      sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/social', 'social', lang);
      return;
    }

    const result = await generateSocialContent({
      platform: platform || 'YouTube',
      topic: String(topic),
      tone: tone || 'তথ্যবহুল ও আকর্ষণীয়',
      responseLanguage: lang,
      modelId: requestedModel,
    });

    const updatedQuota = consumeQuota();

    const formattedResponse =
      lang === 'en'
        ? `### ${result.platform} Content Package\n\n` +
          `**Title:** ${result.titles?.[0] || ''}\n\n` +
          `**Script (Hook):** ${result.script?.hook || ''}\n\n` +
          `**Script (Body):** ${result.script?.body || ''}\n\n` +
          `**Caption:** ${result.caption || ''}\n\n` +
          `**Hashtags:** ${(result.hashtags || []).join(' ')}\n\n` +
          `**AI Video Prompt:** \`${result.aiVideoPrompt || ''}\``
        : `### ${result.platform} কনটেন্ট প্যাকেজ\n\n` +
          `**শিরোনাম:** ${result.titles?.[0] || ''}\n\n` +
          `**স্ক্রিপ্ট (Hook):** ${result.script?.hook || ''}\n\n` +
          `**স্ক্রিপ্ট (মূল অংশ):** ${result.script?.body || ''}\n\n` +
          `**ক্যাপশন:** ${result.caption || ''}\n\n` +
          `**হ্যাশট্যাগ:** ${(result.hashtags || []).join(' ')}\n\n` +
          `**AI ভিডিও প্রম্পট:** \`${result.aiVideoPrompt || ''}\``;

    const historyItem = addHistoryItem({
      tool: 'social',
      toolLabelBn: 'সোশ্যাল মিডিয়া AI',
      title: `${result.platform}: ${String(topic).slice(0, 48)}`,
      prompt: String(topic),
      response: formattedResponse,
    });

    logAiOutcome({
      endpoint: '/api/ai/social',
      tool: 'social',
      language: lang,
      startedAt,
      model: requestedModel,
    });

    res.json({
      result,
      modelUsed: requestedModel,
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/social', tool: 'social', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

// 5. Video Prompt & Storyboard + Video API Adapter
app.post('/api/ai/video-prompt', async (req, res) => {
  const startedAt = Date.now();
  const { idea, mode, style, aspectRatio, responseLanguage, modelId } = req.body ?? {};
  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);

  try {
    if (!idea || !String(idea).trim()) {
      res.status(400).json({ error: 'অনুগ্রহ করে ভিডিওর দৃশ্য বা ধারণা লিখুন।' });
      return;
    }

    const quotaCheck = checkFeatureAvailable('videoGenerationEnabled');
    if (!quotaCheck.ok) {
      sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/video-prompt', 'video', lang);
      return;
    }

    const result = await generateVideoPromptAndStoryboard({
      idea: String(idea),
      mode: mode || 'text-to-video',
      style: style || 'সিনেম্যাটিক ডকুমেন্টারি',
      aspectRatio: aspectRatio || '16:9',
      responseLanguage: lang,
      modelId: requestedModel,
    });

    const updatedQuota = consumeQuota();

    const historyItem = addHistoryItem({
      tool: 'video',
      toolLabelBn: 'ভিডিও স্টুডিও',
      title: result.titleBn || String(idea).slice(0, 56),
      prompt: String(idea),
      response: `**ইংরেজি প্রম্পট:**\n${result.englishPrompt}\n\n**নেগেটিভ প্রম্পট:** ${result.negativePrompt}\n\n**স্টাইল নোট:** ${result.styleNotesBn}`,
    });

    logAiOutcome({
      endpoint: '/api/ai/video-prompt',
      tool: 'video',
      language: lang,
      startedAt,
      model: requestedModel,
    });

    res.json({
      result,
      modelUsed: requestedModel,
      apiConnected: Boolean(process.env.GEMINI_API_KEY || process.env.VIDEO_API_KEY),
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/video-prompt', tool: 'video', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

app.post('/api/video/generate', async (req, res) => {
  const startedAt = Date.now();
  const {
    idea,
    mode,
    style,
    aspectRatio,
    durationSec,
    duration,
    imageBase64,
    imageMimeType,
    responseLanguage,
    modelId,
  } = req.body ?? {};
  const resolvedDurationSec =
    typeof durationSec === 'number'
      ? durationSec
      : duration !== undefined
        ? Number(duration)
        : 6;
  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);

  try {
    if (!idea || !String(idea).trim()) {
      res.status(400).json({ error: 'ভিডিও তৈরি করতে একটি প্রম্পট বা ধারণা লিখুন।' });
      return;
    }

    const quotaCheck = checkFeatureAvailable('videoGenerationEnabled');
    if (!quotaCheck.ok) {
      sendAccessDeniedOrQuota(res, quotaCheck, '/api/video/generate', 'video', lang);
      return;
    }

    // Storyboard-only mode explicitly uses storyboard generator
    if (mode === 'storyboard') {
      const result = await generateVideoPromptAndStoryboard({
        idea: String(idea),
        mode: 'text-to-video',
        style: style || 'সিনেম্যাটিক ডকুমেন্টারি',
        aspectRatio: aspectRatio || '16:9',
        responseLanguage: lang,
        modelId: requestedModel,
      });
      const updatedQuota = consumeQuota();
      logAiOutcome({
        endpoint: '/api/video/generate',
        tool: 'video',
        language: lang,
        startedAt,
        model: requestedModel,
      });
      res.json({
        mode: 'storyboard',
        modelUsed: requestedModel,
        apiConnected: Boolean(process.env.GEMINI_API_KEY),
        result,
        quota: updatedQuota,
      });
      return;
    }

    // Live Flow AI short video generation via Gemini Omni
    const videoPrompt = style
      ? `${String(idea).trim()}. Visual style: ${String(style).trim()}.`
      : String(idea).trim();

    const generated = await generateFlowAiVideo({
      prompt: videoPrompt,
      aspectRatio: aspectRatio || '16:9',
      durationSec: Number.isFinite(resolvedDurationSec) ? resolvedDurationSec : 6,
      imageBase64: typeof imageBase64 === 'string' ? imageBase64 : undefined,
      imageMimeType: typeof imageMimeType === 'string' ? imageMimeType : undefined,
    });

    const updatedQuota = consumeQuota();
    const historyItem = addHistoryItem({
      tool: 'video',
      toolLabelBn: 'ভিডিও স্টুডিও (Flow AI)',
      title: String(idea).trim().slice(0, 56),
      prompt: String(idea).trim(),
      response: `Flow AI (${generated.modelUsed}) ভিডিও তৈরি সম্পন্ন হয়েছে (${aspectRatio || '16:9'})।`,
    });

    logAiOutcome({
      endpoint: '/api/video/generate',
      tool: 'video',
      language: lang,
      startedAt,
      model: generated.modelUsed,
    });

    res.json({
      mode: 'live',
      apiConnected: true,
      videoDataUrl: generated.videoDataUrl,
      videoUri: generated.videoUri,
      mimeType: generated.mimeType,
      modelUsed: generated.modelUsed,
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({
      endpoint: '/api/video/generate',
      tool: 'video',
      language: lang,
      startedAt,
      model: 'gemini-omni-1.2-flash',
      err,
    });
    sendAiError(res, err);
  }
});

// 5b. AI Image Generation & Editing (ChatGPT-style text/image-to-image)
app.post('/api/ai/image-generate', async (req, res) => {
  const startedAt = Date.now();
  const {
    prompt,
    aspectRatio,
    quality,
    imageBase64,
    imageMimeType,
    referenceImageBase64,
    referenceMimeType,
    responseLanguage,
  } = req.body ?? {};
  const lang = resolveRequestedLanguage(responseLanguage);
  const resolvedQuality = quality === 'hd' || quality === 'high' ? 'hd' : 'standard';
  const resolvedImageBase64 =
    typeof imageBase64 === 'string'
      ? imageBase64
      : typeof referenceImageBase64 === 'string'
        ? referenceImageBase64
        : undefined;
  const resolvedImageMime =
    typeof imageMimeType === 'string'
      ? imageMimeType
      : typeof referenceMimeType === 'string'
        ? referenceMimeType
        : undefined;

  try {
    const quotaCheck = checkFeatureAvailable('imageGenerationEnabled');
    if (!quotaCheck.ok) {
      sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/image-generate', 'photo', lang);
      return;
    }

    const generated = await generateOrEditImage({
      prompt: typeof prompt === 'string' ? prompt : '',
      aspectRatio,
      quality: resolvedQuality,
      imageBase64: resolvedImageBase64,
      imageMimeType: resolvedImageMime,
      responseLanguage: lang,
    });

    const updatedQuota = generated.cached ? getFullState().quota : consumeQuota();
    const historyItem = addHistoryItem({
      tool: 'photo',
      toolLabelBn: 'AI ইমেজ স্টুডিও',
      title: (typeof prompt === 'string' && prompt.trim() ? prompt.trim() : 'AI ইমেজ এডিট').slice(0, 56),
      prompt: typeof prompt === 'string' ? prompt : 'ইমেজ এডিট',
      response: generated.description || `ছবি তৈরি সম্পন্ন হয়েছে (${generated.modelUsed})।`,
    });

    logAiOutcome({
      endpoint: '/api/ai/image-generate',
      tool: 'photo',
      language: lang,
      startedAt,
      model: generated.modelUsed,
      cached: generated.cached,
    });

    res.json({
      imageDataUrl: generated.imageDataUrl,
      description: generated.description,
      descriptionText: generated.description,
      modelUsed: generated.modelUsed,
      cached: Boolean(generated.cached),
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    const imgModel = quality === 'hd' ? 'gemini-nano-banana-2.1' : 'gemini-2.5-flash-image';
    logAiOutcome({
      endpoint: '/api/ai/image-generate',
      tool: 'photo',
      language: lang,
      startedAt,
      model: imgModel,
      err,
    });
    sendAiError(res, err, imgModel);
  }
});

// 6. AI Photo & Thumbnail Advisor
app.post('/api/ai/photo-advisor', async (req, res) => {
  const startedAt = Date.now();
  const { topic, imageBase64, imageMimeType, responseLanguage, modelId } = req.body ?? {};
  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);

  try {
    const quotaCheck = checkQuotaAvailable();
    if (!quotaCheck.ok) {
      sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/photo-advisor', 'photo', lang);
      return;
    }

    const advice = await advisePhotoThumbnail({
      topic: topic || 'বাংলা টেক ও এডুকেশন ইউটিউব ভিডিও',
      imageBase64,
      imageMimeType,
      responseLanguage: lang,
      modelId: requestedModel,
    });

    const updatedQuota = consumeQuota();
    logAiOutcome({
      endpoint: '/api/ai/photo-advisor',
      tool: 'photo',
      language: lang,
      startedAt,
      model: requestedModel,
    });

    res.json({
      advice,
      modelUsed: requestedModel,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/photo-advisor', tool: 'photo', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

// ============================================================
// Subscriptions, Payments, User Profile & Model Switch
// ============================================================

app.post('/api/subscription/submit-payment', (req, res) => {
  const { planId, method, senderNumber, transactionId } = req.body ?? {};
  if (planId !== '1_month' && planId !== '3_months') {
    res.status(400).json({ error: 'সঠিক সাবস্ক্রিপশন প্ল্যান নির্বাচন করুন।' });
    return;
  }

  const paymentCfg = getAppSettings().paymentConfig;
  const normalizedMethod = String(method || '') as PaymentMethod;
  const methodAllowed =
    (normalizedMethod === 'bKash' && paymentCfg.bkashEnabled) ||
    (normalizedMethod === 'Nagad' && paymentCfg.nagadEnabled) ||
    (normalizedMethod === 'Rocket' && paymentCfg.rocketEnabled) ||
    (normalizedMethod === 'Card' && paymentCfg.cardEnabled);

  if (!methodAllowed) {
    res.status(400).json({
      error: 'নির্বাচিত পেমেন্ট মাধ্যমটি বর্তমানে সক্রিয় নয়। অনুগ্রহ করে সক্রিয় বিকাশ বা নগদ ব্যবহার করুন।',
    });
    return;
  }

  if (!senderNumber || String(senderNumber).trim().length < 6) {
    res.status(400).json({ error: 'সঠিক পেমেন্ট নম্বর বা অ্যাকাউন্ট তথ্য দিন।' });
    return;
  }
  if (!transactionId || String(transactionId).trim().length < 5) {
    res.status(400).json({ error: 'বৈধ ট্রানজেকশন আইডি (TrxID) প্রদান করুন।' });
    return;
  }

  const payment = submitPaymentRequest({
    planId,
    method: normalizedMethod,
    senderNumber: String(senderNumber),
    transactionId: String(transactionId),
  });

  res.json({
    payment,
    state: getFullState(),
    message:
      'আপনার পেমেন্ট তথ্য জমা হয়েছে। অ্যাডমিন যাচাই না করা পর্যন্ত পেইড সাবস্ক্রিপশন সক্রিয় হবে না।',
  });
});

app.post('/api/ads/track', (req, res) => {
  const event = req.body?.event;
  if (
    event === 'banner_impression' ||
    event === 'interstitial_impression' ||
    event === 'click'
  ) {
    const stats = trackAdEvent(event);
    res.json({ stats });
    return;
  }
  res.status(400).json({ error: 'Invalid ad event' });
});

// User manual model switch (if permitted in App Settings)
app.post('/api/model', (req, res) => {
  const settings = getAppSettings();
  const adminSession = getAdminSessionFromRequest(req);
  if (!settings.aiSettings.allowUserModelSwitch && !adminSession.authenticated) {
    res.status(403).json({
      error: 'অ্যাডমিন কর্তৃক মডেল পরিবর্তন লক করা আছে।',
    });
    return;
  }
  const { modelId } = req.body ?? {};
  const updated = updateActiveAiModel(String(modelId || ''));
  if (!updated) {
    res.status(400).json({ error: 'অকার্যকর বা অসমর্থিত এআই মডেল নির্বাচিত হয়েছে।' });
    return;
  }
  res.json({ modelId: updated, state: getFullState() });
});

app.post('/api/profile', (req, res) => {
  const user = updateProfile(req.body ?? {});
  res.json({ user, state: getFullState() });
});

app.delete('/api/history/:id', (req, res) => {
  const history = deleteHistoryItem(req.params.id);
  res.json({ history });
});

app.post('/api/history/clear', (_req, res) => {
  const history = clearHistoryItems();
  res.json({ history });
});

// ============================================================
// Protected Admin APIs (STRICT requireAdmin RBAC Verification)
// ============================================================

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  res.json(getAdminDashboardData());
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const data = getAdminDashboardData();
  const users = q
    ? data.users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
      )
    : data.users;
  res.json({ users });
});

app.post('/api/admin/users', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const { name, email, phone, location, planId } = req.body ?? {};
  if (!name || !String(name).trim() || !email || !String(email).trim()) {
    res.status(400).json({ error: 'ব্যবহারকারীর নাম এবং ইমেইল প্রদান করুন।' });
    return;
  }
  const validPlan: SubscriptionPlanId =
    planId === 'pro' || planId === '1_month' || planId === '3_months' ? planId : 'free';
  const created = adminCreateUser({
    name: String(name),
    email: String(email),
    phone: typeof phone === 'string' ? phone : undefined,
    location: typeof location === 'string' ? location : undefined,
    planId: validPlan,
  });
  recordAdminLog(
    'user_create',
    `নতুন ব্যবহারকারী যোগ করেছেন: ${created.name} (${created.email})`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ user: created, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/users/:id/status', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const status = req.body?.status === 'suspended' ? 'suspended' : 'active';
  const updated = adminUpdateUserStatus(req.params.id, status);
  if (!updated) {
    res.status(404).json({ error: 'ব্যবহারকারী পাওয়া যায়নি।' });
    return;
  }
  recordAdminLog(
    status === 'suspended' ? 'user_suspend' : 'user_activate',
    `${updated.name}-এর অ্যাকাউন্ট ${status === 'suspended' ? 'স্থগিত' : 'সক্রিয়'} করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ user: updated, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/users/:id/plan', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const planId = String(req.body?.planId || '') as SubscriptionPlanId;
  const expiresAt = typeof req.body?.expiresAt === 'string' ? req.body.expiresAt : undefined;
  const updated = adminUpdateUserPlan(req.params.id, planId, expiresAt);
  if (!updated) {
    res.status(404).json({ error: 'ব্যবহারকারী বা প্ল্যান পাওয়া যায়নি।' });
    return;
  }
  recordAdminLog(
    'user_plan_update',
    `${updated.name}-এর প্ল্যান "${updated.subscription.planNameBn}"-এ পরিবর্তন করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ user: updated, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/users/:id/quota', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const { dailyLimit, monthlyLimit, resetUsage } = req.body ?? {};
  const updated = adminUpdateUserQuota(req.params.id, {
    dailyLimit: dailyLimit !== undefined ? Number(dailyLimit) : undefined,
    monthlyLimit: monthlyLimit !== undefined ? Number(monthlyLimit) : undefined,
    resetUsage: Boolean(resetUsage),
  });
  if (!updated) {
    res.status(404).json({ error: 'ব্যবহারকারী পাওয়া যায়নি।' });
    return;
  }
  recordAdminLog(
    'user_quota_update',
    `${updated.name}-এর কোটা (দৈনিক ${updated.quota.dailyLimit}, মাসিক ${updated.quota.monthlyLimit}) হালনাগাদ হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ user: updated, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/plans/:id', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const planId = req.params.id as SubscriptionPlanId;
  const { nameBn, descriptionBn, priceBdt, durationDays, dailyLimit, monthlyLimit, enabled } =
    req.body ?? {};
  const updated = adminUpdatePlanConfig(planId, {
    nameBn: typeof nameBn === 'string' ? nameBn : undefined,
    descriptionBn: typeof descriptionBn === 'string' ? descriptionBn : undefined,
    priceBdt: priceBdt !== undefined ? Number(priceBdt) : undefined,
    durationDays: durationDays !== undefined ? Number(durationDays) : undefined,
    dailyLimit: dailyLimit !== undefined ? Number(dailyLimit) : undefined,
    monthlyLimit: monthlyLimit !== undefined ? Number(monthlyLimit) : undefined,
    enabled: typeof enabled === 'boolean' ? enabled : undefined,
  });
  if (!updated) {
    res.status(404).json({ error: 'সাবস্ক্রিপশন প্ল্যান পাওয়া যায়নি।' });
    return;
  }
  recordAdminLog(
    'plan_update',
    `প্ল্যান "${updated.nameBn}"-এর মূল্য (৳${updated.priceBdt}) ও কোটা সীমা হালনাগাদ করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ plan: updated, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/payments/:id/verify', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const outcome = verifyPaymentAndActivate(req.params.id);
  if (!outcome) {
    res.status(404).json({ error: 'পেমেন্ট অনুরোধ পাওয়া যায়নি।' });
    return;
  }
  recordAdminLog(
    'payment_verify',
    `${outcome.payment.userName}-এর পেমেন্ট (${outcome.payment.transactionId}) যাচাই ও প্রো সক্রিয় করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ ...outcome, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/payments/:id/reject', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const payment = rejectPaymentRequest(req.params.id, req.body?.reason);
  if (!payment) {
    res.status(404).json({ error: 'পেমেন্ট অনুরোধ পাওয়া যায়নি।' });
    return;
  }
  recordAdminLog(
    'payment_reject',
    `${payment.userName}-এর পেমেন্ট (${payment.transactionId}) বাতিল করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ payment, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/ads', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const ads = updateAdSystem(req.body ?? {});
  recordAdminLog(
    'ads_update',
    'বিজ্ঞাপন নেটওয়ার্ক ও প্রদর্শনী সেটিংস পরিবর্তন করা হয়েছে',
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ ads, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/quota', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const { dailyLimit, monthlyLimit } = req.body ?? {};
  const quota = updateQuotaLimits(Number(dailyLimit || 12), Number(monthlyLimit || 150));
  recordAdminLog(
    'quota_update',
    `ডিফল্ট ব্যবহার কোটা (দৈনিক ${quota.dailyLimit}, মাসিক ${quota.monthlyLimit}) আপডেট করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ quota, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/model', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const { modelId } = req.body ?? {};
  const updated = updateActiveAiModel(String(modelId || ''));
  if (!updated) {
    res.status(400).json({ error: 'অকার্যকর বা অসমর্থিত এআই মডেল নির্বাচিত হয়েছে।' });
    return;
  }
  recordAdminLog(
    'model_update',
    `গ্লোবাল Gemini মডেল "${updated}"-এ পরিবর্তন করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ modelId: updated, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/settings', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const updated = adminUpdateAppSettings(req.body ?? {});
  recordAdminLog(
    'app_settings_update',
    `অ্যাপ সেটিংস হালনাগাদ (রক্ষণাবেক্ষণ: ${updated.maintenanceMode.enabled ? 'চালু' : 'বন্ধ'}, ভাষা: ${updated.defaultLanguage})`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ appSettings: updated, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/api-logs/clear', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  clearApiLogs();
  recordAdminLog(
    'api_logs_clear',
    'সিস্টেমের API ও ৪২৯ ত্রুটি লগ পরিষ্কার করা হয়েছে',
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ dashboard: getAdminDashboardData() });
});

app.post('/api/admin/cache/clear', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const cleared = clearResponseCache();
  recordAdminLog(
    'cache_clear',
    `সার্ভারের এআই রেসপন্স ক্যাশ (${cleared}টি এন্ট্রি) পরিষ্কার করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ cleared, dashboard: getAdminDashboardData() });
});

// ============================================================
// Multilingual AI Assistant Chat, Conversations & Voice Routes
// ============================================================

app.get('/api/conversations', (_req, res) => {
  res.json({ conversations: getConversations() });
});

app.post('/api/conversations', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
  const language = resolveRequestedLanguage(req.body?.language);
  const conversation = createConversation(title, language);
  res.json({ conversation, conversations: getConversations() });
});

app.patch('/api/conversations/:id', (req, res) => {
  const updated = updateConversationMeta(req.params.id, {
    title: req.body?.title,
    pinned: req.body?.pinned,
    language: req.body?.language ? resolveRequestedLanguage(req.body.language) : undefined,
  });
  if (!updated) {
    res.status(404).json({ error: 'কথোপকথনটি পাওয়া যায়নি।' });
    return;
  }
  res.json({ conversations: updated });
});

app.delete('/api/conversations/:id', (req, res) => {
  const conversations = deleteConversationById(req.params.id);
  res.json({ conversations });
});

app.post('/api/conversations/clear', (_req, res) => {
  const conversations = clearAllConversations();
  res.json({ conversations });
});

app.post('/api/ai/chat', async (req, res) => {
  const startedAt = Date.now();
  const {
    conversationId,
    message,
    imageBase64,
    imageMimeType,
    imageDataUrl,
    responseLanguage,
    modelId,
    stream,
  } = req.body ?? {};
  const settings = getAppSettings();
  const wantsStream =
    settings.aiSettings.streamEnabled &&
    (Boolean(stream) || req.headers.accept?.includes('text/event-stream'));
  const trimmedMsg = typeof message === 'string' ? message.trim() : '';

  if (!trimmedMsg && !imageBase64) {
    res.status(400).json({ error: 'অনুগ্রহ করে কিছু লিখুন, ভয়েস দিন অথবা একটি ছবি আপলোড করুন।' });
    return;
  }

  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);
  const quotaCheck = checkFeatureAvailable('generalChatEnabled');
  if (!quotaCheck.ok) {
    sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/chat', 'assistant', lang);
    return;
  }

  const existingConv =
    typeof conversationId === 'string' ? getConversationById(conversationId) : undefined;
  const priorHistory = (existingConv?.messages ?? []).map((m) => ({
    role: m.role,
    text: m.text,
  }));

  if (wantsStream) {
    const writeSse = initSse(res);
    try {
      const result = await streamAssistantChat(
        {
          history: priorHistory,
          message: trimmedMsg,
          imageBase64,
          imageMimeType,
          responseLanguage: lang,
          modelId: requestedModel,
        },
        (text) => writeSse({ type: 'delta', text })
      );

      const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
      const { conversation, conversations } = appendConversationTurn({
        conversationId: existingConv?.id,
        userText: trimmedMsg || 'ছবি বিশ্লেষণ',
        assistantText: result.answer,
        imageDataUrl: typeof imageDataUrl === 'string' ? imageDataUrl : undefined,
        language: lang,
        modelUsed: result.modelUsed,
        cached: result.cached,
      });

      logAiOutcome({
        endpoint: '/api/ai/chat',
        tool: 'assistant',
        language: lang,
        startedAt,
        model: result.modelUsed,
        cached: result.cached,
      });

      writeSse({
        type: 'done',
        answer: result.answer,
        modelUsed: result.modelUsed,
        cached: Boolean(result.cached),
        conversation,
        conversations,
        quota: updatedQuota,
      });
      res.end();
    } catch (err) {
      logAiOutcome({ endpoint: '/api/ai/chat', tool: 'assistant', language: lang, startedAt, model: requestedModel, err });
      const normalized = normalizeGeminiError(err, requestedModel);
      writeSse({
        type: 'error',
        error: normalized.message,
        errorCode: normalized.errorCode,
        retryable: normalized.retryable,
        retryAfterSec: normalized.retryAfterSec,
      });
      res.end();
    }
    return;
  }

  try {
    const result = await streamAssistantChat(
      {
        history: priorHistory,
        message: trimmedMsg,
        imageBase64,
        imageMimeType,
        responseLanguage: lang,
        modelId: requestedModel,
      },
      () => {}
    );

    const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
    const { conversation, conversations } = appendConversationTurn({
      conversationId: existingConv?.id,
      userText: trimmedMsg || 'ছবি বিশ্লেষণ',
      assistantText: result.answer,
      imageDataUrl: typeof imageDataUrl === 'string' ? imageDataUrl : undefined,
      language: lang,
      modelUsed: result.modelUsed,
      cached: result.cached,
    });

    logAiOutcome({
      endpoint: '/api/ai/chat',
      tool: 'assistant',
      language: lang,
      startedAt,
      model: result.modelUsed,
      cached: result.cached,
    });

    res.json({
      answer: result.answer,
      modelUsed: result.modelUsed,
      cached: Boolean(result.cached),
      conversation,
      conversations,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/chat', tool: 'assistant', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

app.post('/api/ai/transcribe', async (req, res) => {
  const startedAt = Date.now();
  const lang = resolveRequestedLanguage(req.body?.responseLanguage);
  try {
    const { audioBase64, mimeType } = req.body ?? {};
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'ভয়েস অডিও পাওয়া যায়নি। আবার রেকর্ড করুন।' });
      return;
    }
    const result = await transcribeVoiceAudio({
      audioBase64,
      mimeType: typeof mimeType === 'string' ? mimeType : 'audio/webm',
      responseLanguage: lang,
    });
    logAiOutcome({
      endpoint: '/api/ai/transcribe',
      tool: 'voice-input',
      language: lang,
      startedAt,
      model: 'gemini-3.5-transcribe',
    });
    res.json(result);
  } catch (err) {
    logAiOutcome({
      endpoint: '/api/ai/transcribe',
      tool: 'voice-input',
      language: lang,
      startedAt,
      model: 'gemini-3.5-transcribe',
      err,
    });
    sendAiError(res, err);
  }
});

app.post('/api/ai/tts', async (req, res) => {
  const startedAt = Date.now();
  const lang = resolveRequestedLanguage(req.body?.responseLanguage);
  try {
    const { text } = req.body ?? {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'শোনার জন্য টেক্সট পাওয়া যায়নি।' });
      return;
    }
    const result = await synthesizeSpeechAudio({
      text,
      responseLanguage: lang,
    });
    logAiOutcome({
      endpoint: '/api/ai/tts',
      tool: 'voice-output',
      language: lang,
      startedAt,
      model: 'gemini-3.8-flash-lite-tts',
      cached: result.cached,
    });
    res.json(result);
  } catch (err) {
    logAiOutcome({
      endpoint: '/api/ai/tts',
      tool: 'voice-output',
      language: lang,
      startedAt,
      model: 'gemini-3.8-flash-lite-tts',
      err,
    });
    sendAiError(res, err);
  }
});

const quranSurahCache = new Map<
  number,
  { surah: (typeof QURAN_SURAHS)[number]; ayahs: QuranAyahItem[] }
>();

const BISMILLAH_PREFIXES = [
  'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ',
  'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ',
];

function stripLeadingBismillah(surahNum: number, idx: number, text: string): string {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (surahNum === 1 || surahNum === 9 || idx !== 0) return clean;
  for (const prefix of BISMILLAH_PREFIXES) {
    if (clean.startsWith(prefix)) {
      return clean.slice(prefix.length).trim();
    }
  }
  return clean;
}

const quranAudioCache = new Map<string, Buffer>();

async function loadQuranSurahData(
  num: number
): Promise<{ surah: (typeof QURAN_SURAHS)[number]; ayahs: QuranAyahItem[] }> {
  const cached = quranSurahCache.get(num);
  if (cached) return cached;

  const surahMeta = QURAN_SURAHS.find((s) => s.number === num) ?? QURAN_SURAHS[0];

  try {
    const response = await fetch(
      `https://api.alquran.cloud/v1/surah/${num}/editions/quran-simple-enhanced,bn.bengali,en.transliteration,ar.alafasy`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!response.ok) {
      throw new Error(`Quran API status ${response.status}`);
    }
    const payload = (await response.json()) as {
      code?: number;
      data?: Array<{
        ayahs?: Array<{
          number?: number;
          numberInSurah?: number;
          text?: string;
        }>;
      }>;
    };

    const arAyahs = payload?.data?.[0]?.ayahs ?? [];
    const bnAyahs = payload?.data?.[1]?.ayahs ?? [];
    const trAyahs = payload?.data?.[2]?.ayahs ?? [];
    const auAyahs = payload?.data?.[3]?.ayahs ?? [];

    if (arAyahs.length === 0) {
      throw new Error('Empty ayah list from Quran API');
    }

    const curatedFallback = OFFLINE_FALLBACK_SURAHS[num];
    const ayahs: QuranAyahItem[] = arAyahs.map((arItem, idx) => {
      const numberInSurah = arItem.numberInSurah ?? idx + 1;
      const globalNumber =
        arItem.number ??
        auAyahs[idx]?.number ??
        getGlobalAyahNumber(num, numberInSurah);
      const audioUrl = `/api/quran/audio/${num}/${numberInSurah}`;
      const arabic = stripLeadingBismillah(num, idx, arItem.text ?? '');
      const transliterationEn = (trAyahs[idx]?.text ?? '').trim();
      const curatedAyah = curatedFallback?.find((f) => f.numberInSurah === numberInSurah);
      const pronunciationBn =
        curatedAyah?.pronunciationBn || transliterateQuranToBengali(transliterationEn);
      const meaningBn = (bnAyahs[idx]?.text ?? curatedAyah?.meaningBn ?? '').trim();
      return {
        numberInSurah,
        globalNumber,
        audioUrl,
        arabic,
        transliterationEn,
        pronunciationBn,
        meaningBn,
      };
    });

    const result = { surah: surahMeta, ayahs };
    quranSurahCache.set(num, result);
    return result;
  } catch {
    // Secondary CDN fallback covering all 114 Surahs (Arabic + Bengali translation + transliteration)
    try {
      const cdnRes = await fetch(
        `https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/chapters/bn/${num}.json`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (cdnRes.ok) {
        const cdnData = (await cdnRes.json()) as {
          verses?: Array<{
            id?: number;
            text?: string;
            translation?: string;
            transliteration?: string;
          }>;
        };
        const verses = cdnData.verses ?? [];
        if (verses.length > 0) {
          const curatedFallback = OFFLINE_FALLBACK_SURAHS[num];
          const ayahs: QuranAyahItem[] = verses.map((v, idx) => {
            const numberInSurah = v.id ?? idx + 1;
            const globalNumber = getGlobalAyahNumber(num, numberInSurah);
            const curatedAyah = curatedFallback?.find((f) => f.numberInSurah === numberInSurah);
            const transliterationEn = (v.transliteration ?? '').trim();
            return {
              numberInSurah,
              globalNumber,
              audioUrl: `/api/quran/audio/${num}/${numberInSurah}`,
              arabic: stripLeadingBismillah(num, idx, v.text ?? ''),
              transliterationEn,
              pronunciationBn:
                curatedAyah?.pronunciationBn || transliterateQuranToBengali(transliterationEn),
              meaningBn: (v.translation ?? curatedAyah?.meaningBn ?? '').trim(),
            };
          });
          const result = { surah: surahMeta, ayahs };
          quranSurahCache.set(num, result);
          return result;
        }
      }
    } catch {
      // continue to offline curated fallback
    }

    const fallbackAyahs = OFFLINE_FALLBACK_SURAHS[num];
    if (fallbackAyahs) {
      const enriched = fallbackAyahs.map((a) => {
        const globalNumber = getGlobalAyahNumber(num, a.numberInSurah);
        return {
          ...a,
          globalNumber,
          audioUrl: `/api/quran/audio/${num}/${a.numberInSurah}`,
        };
      });
      return { surah: surahMeta, ayahs: enriched };
    }
    throw new Error('এই মুহূর্তে সূরাটি লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
  }
}

app.get('/api/quran/surah/:number', async (req, res) => {
  const num = Number(req.params.number);
  if (!Number.isInteger(num) || num < 1 || num > 114) {
    res.status(400).json({ error: 'সূরা নম্বর অবশ্যই ১ থেকে ১১৪-এর মধ্যে হতে হবে।' });
    return;
  }

  try {
    const result = await loadQuranSurahData(num);
    res.json(result);
  } catch (err) {
    res.status(502).json({
      error:
        err instanceof Error
          ? err.message
          : 'এই মুহূর্তে সূরাটি লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
    });
  }
});

function sendAudioBufferWithRange(
  req: express.Request,
  res: express.Response,
  audioBuf: Buffer
): void {
  const totalLen = audioBuf.length;
  const rangeHeader = req.headers.range;
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), totalLen - 1) : totalLen - 1;
      if (start <= end && start < totalLen) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalLen}`);
        res.setHeader('Content-Length', String(end - start + 1));
        res.end(audioBuf.subarray(start, end + 1));
        return;
      }
    }
  }

  res.setHeader('Content-Length', String(totalLen));
  res.end(audioBuf);
}

app.get('/api/quran/audio/:surah/:ayah', async (req, res) => {
  const surahNum = Number(req.params.surah);
  const ayahNum = Number(req.params.ayah);
  const surahMeta = QURAN_SURAHS.find((s) => s.number === surahNum);
  if (
    !surahMeta ||
    !Number.isInteger(ayahNum) ||
    ayahNum < 1 ||
    ayahNum > surahMeta.ayahCount
  ) {
    res.status(400).json({ error: 'সঠিক সূরা ও আয়াত নম্বর পাওয়া যায়নি।' });
    return;
  }

  const cacheKey = `${surahNum}:${ayahNum}`;
  let audioBuf = quranAudioCache.get(cacheKey);

  if (!audioBuf) {
    const pad3 = (n: number) => String(n).padStart(3, '0');
    const primaryUrl = `https://everyayah.com/data/Alafasy_128kbps/${pad3(surahNum)}${pad3(ayahNum)}.mp3`;
    const globalNum = getGlobalAyahNumber(surahNum, ayahNum);
    const secondaryUrl = `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalNum}.mp3`;

    for (const candidateUrl of [primaryUrl, secondaryUrl]) {
      try {
        const upstream = await fetch(candidateUrl, { signal: AbortSignal.timeout(12000) });
        const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
        if (
          upstream.ok &&
          (contentType.startsWith('audio/') ||
            contentType.includes('octet-stream') ||
            contentType === '')
        ) {
          const arrBuf = await upstream.arrayBuffer();
          if (arrBuf.byteLength > 512) {
            audioBuf = Buffer.from(arrBuf);
            break;
          }
        }
      } catch {
        // try next source
      }
    }

    if (!audioBuf) {
      res.status(502).json({ error: 'এই আয়াতের নির্ভরযোগ্য তেলাওয়াত অডিও পাওয়া যায়নি।' });
      return;
    }

    if (quranAudioCache.size > 150) {
      const oldestKey = quranAudioCache.keys().next().value;
      if (oldestKey) quranAudioCache.delete(oldestKey);
    }
    quranAudioCache.set(cacheKey, audioBuf);
  }

  sendAudioBufferWithRange(req, res, audioBuf);
});

const quranSurahAudioCache = new Map<number, Buffer>();
const MAX_CACHED_SURAH_AUDIO_BYTES = 6 * 1024 * 1024;

app.get('/api/quran/surah-audio/:surah', async (req, res) => {
  const surahNum = Number(req.params.surah);
  if (!Number.isInteger(surahNum) || surahNum < 1 || surahNum > 114) {
    res.status(400).json({ error: 'সঠিক সূরা নম্বর পাওয়া যায়নি।' });
    return;
  }

  const cached = quranSurahAudioCache.get(surahNum);
  if (cached) {
    sendAudioBufferWithRange(req, res, cached);
    return;
  }

  const pad3 = (n: number) => String(n).padStart(3, '0');
  const primaryUrl = `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${surahNum}.mp3`;
  const secondaryUrl = `https://cdn.mp3quran.net/audio/mishary-alafasy/r1/${pad3(surahNum)}.mp3`;

  const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;

  for (const candidateUrl of [primaryUrl, secondaryUrl]) {
    try {
      const upstream = await fetch(candidateUrl, {
        headers: rangeHeader ? { Range: rangeHeader } : undefined,
        signal: AbortSignal.timeout(25000),
      });
      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      if (
        !upstream.ok ||
        (!contentType.startsWith('audio/') &&
          !contentType.includes('octet-stream') &&
          contentType !== '')
      ) {
        continue;
      }

      const contentLenHeader = Number(upstream.headers.get('content-length') || '0');

      // Small/medium full Surahs (without Range request): buffer & cache for instant replay/range
      if (
        !rangeHeader &&
        upstream.status === 200 &&
        contentLenHeader > 512 &&
        contentLenHeader <= MAX_CACHED_SURAH_AUDIO_BYTES
      ) {
        const buf = Buffer.from(await upstream.arrayBuffer());
        if (quranSurahAudioCache.size > 15) {
          const oldestKey = quranSurahAudioCache.keys().next().value;
          if (oldestKey !== undefined) quranSurahAudioCache.delete(oldestKey);
        }
        quranSurahAudioCache.set(surahNum, buf);
        sendAudioBufferWithRange(req, res, buf);
        return;
      }

      // Stream directly for large Surahs or partial Range requests
      res.status(upstream.status);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const cr = upstream.headers.get('content-range');
      if (cr) res.setHeader('Content-Range', cr);
      const cl = upstream.headers.get('content-length');
      if (cl) res.setHeader('Content-Length', cl);

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      req.on('close', () => {
        void reader.cancel().catch(() => {});
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
      res.end();
      return;
    } catch {
      // try fallback CDN
    }
  }

  if (!res.headersSent) {
    res.status(502).json({ error: 'এই সূরার নির্ভরযোগ্য আরবি তিলাওয়াত অডিও পাওয়া যায়নি।' });
  }
});

const quranBnTtsCache = new Map<string, Buffer>();

function splitBengaliTtsChunks(text: string, maxLen = 175): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (normalized.length <= maxLen) return [normalized];

  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxLen) {
    let splitIdx = -1;
    for (const sep of ['।', '?', '!', ';', ',', '—', '-']) {
      const idx = remaining.lastIndexOf(sep, maxLen);
      if (idx > maxLen * 0.35 && idx > splitIdx) {
        splitIdx = idx + 1;
      }
    }
    if (splitIdx === -1) {
      const spaceIdx = remaining.lastIndexOf(' ', maxLen);
      splitIdx = spaceIdx > 20 ? spaceIdx : maxLen;
    }
    const piece = remaining.slice(0, splitIdx).trim();
    if (piece) chunks.push(piece);
    remaining = remaining.slice(splitIdx).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

const quranBnSurahAudioCache = new Map<number, Buffer>();

async function fetchBengaliTtsChunkBuffer(chunk: string): Promise<Buffer> {
  const ttsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=bn&client=tw-ob&ttsspeed=0.92&q=${encodeURIComponent(chunk)}`;
  const upstream = await fetch(ttsUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!upstream.ok) {
    throw new Error(`Bengali TTS status ${upstream.status}`);
  }
  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.byteLength < 128) {
    throw new Error('Empty Bengali TTS audio');
  }
  return buf;
}

app.get('/api/quran/bn-meaning-audio/:surah', async (req, res) => {
  const surahNum = Number(req.params.surah);
  if (!Number.isInteger(surahNum) || surahNum < 1 || surahNum > 114) {
    res.status(400).json({ error: 'সঠিক সূরা নম্বর পাওয়া যায়নি।' });
    return;
  }

  const cached = quranBnSurahAudioCache.get(surahNum);
  if (cached) {
    sendAudioBufferWithRange(req, res, cached);
    return;
  }

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  try {
    const surahData = await loadQuranSurahData(surahNum);
    // Exact unmodified full Bengali translation of the entire Surah (zero words dropped/altered)
    const fullMeaningText = surahData.ayahs
      .map((a) => a.meaningBn.trim())
      .filter(Boolean)
      .join(' ');

    if (!fullMeaningText) {
      res.status(404).json({ error: 'এই সূরার বাংলা অর্থ পাওয়া যায়নি।' });
      return;
    }

    const chunks = splitBengaliTtsChunks(fullMeaningText, 175);
    const CONCURRENCY = 4;

    // For Surahs up to ~45 TTS segments (~8000 chars), build complete MP3 buffer & cache for instant Range/Pause/Resume
    if (chunks.length <= 45) {
      const partBuffers: Buffer[] = new Array(chunks.length);
      for (let start = 0; start < chunks.length; start += CONCURRENCY) {
        if (closed) return;
        const batch = chunks.slice(start, start + CONCURRENCY);
        await Promise.all(
          batch.map(async (chunk, offset) => {
            partBuffers[start + offset] = await fetchBengaliTtsChunkBuffer(chunk);
          })
        );
      }

      const completeBuf = Buffer.concat(partBuffers);
      if (quranBnSurahAudioCache.size > 30) {
        const oldestKey = quranBnSurahAudioCache.keys().next().value;
        if (oldestKey !== undefined) quranBnSurahAudioCache.delete(oldestKey);
      }
      quranBnSurahAudioCache.set(surahNum, completeBuf);
      sendAudioBufferWithRange(req, res, completeBuf);
      return;
    }

    // For very long Surahs (e.g. Al-Baqarah), stream all segments sequentially without dropping a single word
    res.status(200);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    for (let start = 0; start < chunks.length; start += CONCURRENCY) {
      if (closed) break;
      const batch = chunks.slice(start, start + CONCURRENCY);
      const buffers = await Promise.all(batch.map((c) => fetchBengaliTtsChunkBuffer(c)));
      for (const b of buffers) {
        if (closed) break;
        res.write(b);
      }
    }
    res.end();
  } catch {
    if (!res.headersSent) {
      res.status(502).json({ error: 'বাংলা অর্থের ভয়েস অডিও তৈরি করা যায়নি।' });
    } else {
      res.end();
    }
  }
});

async function handleBengaliTtsRequest(
  rawText: string,
  req: express.Request,
  res: express.Response
): Promise<void> {
  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    res.status(400).json({ error: 'শোনার জন্য বাংলা টেক্সট পাওয়া যায়নি।' });
    return;
  }

  let audioBuf = quranBnTtsCache.get(cleaned);
  if (!audioBuf) {
    try {
      const chunks = splitBengaliTtsChunks(cleaned, 175);
      const partBuffers: Buffer[] = new Array(chunks.length);
      const CONCURRENCY = 4;

      for (let start = 0; start < chunks.length; start += CONCURRENCY) {
        const batch = chunks.slice(start, start + CONCURRENCY);
        await Promise.all(
          batch.map(async (chunk, offset) => {
            partBuffers[start + offset] = await fetchBengaliTtsChunkBuffer(chunk);
          })
        );
      }

      audioBuf = Buffer.concat(partBuffers);
      if (quranBnTtsCache.size > 120) {
        const oldestKey = quranBnTtsCache.keys().next().value;
        if (oldestKey) quranBnTtsCache.delete(oldestKey);
      }
      quranBnTtsCache.set(cleaned, audioBuf);
    } catch {
      res.status(502).json({ error: 'বাংলা ভয়েস অডিও তৈরি করা যায়নি।' });
      return;
    }
  }

  sendAudioBufferWithRange(req, res, audioBuf);
}

app.get('/api/quran/tts-bn', async (req, res) => {
  const rawText = typeof req.query.text === 'string' ? req.query.text : '';
  await handleBengaliTtsRequest(rawText, req, res);
});

app.post('/api/quran/tts-bn', async (req, res) => {
  const rawText = typeof req.body?.text === 'string' ? req.body.text : '';
  await handleBengaliTtsRequest(rawText, req, res);
});

  return app;
}

let cachedDefaultApp: express.Express | null = null;

export default function handler(req: express.Request, res: express.Response): void {
  if (!cachedDefaultApp) {
    cachedDefaultApp = createApiApp();
  }
  cachedDefaultApp(req, res);
}

