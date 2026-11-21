import React, { useEffect, useRef, useState } from 'react';
import { Briefcase, ExternalLink, Globe, Loader2, Search, ShieldAlert } from 'lucide-react';
import { AiErrorBanner } from '../components/AiErrorBanner';
import { RichAnswer } from '../components/RichAnswer';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import {
  AiClientError,
  getNextFreeRateLimitModel,
  isGeminiRequestInFlight,
  MAX_RATE_LIMIT_RETRIES,
  RATE_LIMIT_RETRY_DELAYS_SEC,
  streamAiSse,
} from '../utils/api';
import type {
  AiErrorCode,
  GeminiModelId,
  GeminiModelOption,
  HistoryItem,
  QuotaState,
  ResponseLanguageCode,
} from '../types';

interface JobsPageProps {
  responseLanguage: ResponseLanguageCode;
  activeModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  onBusyChange: (busy: boolean) => void;
  onResultSuccess: (item: HistoryItem, quota: QuotaState) => void;
}

const JOBS_DEBOUNCE_MS = 1500;
const JOBS_CACHE_KEY = 'sathi_jobs_last_result_v1';
const JOBS_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedJobsPayload {
  cacheKey: string;
  answer: string;
  sources: { title: string; uri: string }[];
  cachedAt: number;
}

function buildJobsCacheKey(
  country: string,
  category: string,
  skills: string,
  responseLanguage: ResponseLanguageCode
): string {
  return JSON.stringify({
    country,
    category,
    skills: skills.trim(),
    responseLanguage,
  });
}

function readValidJobsCache(cacheKey: string): {
  answer: string;
  sources: { title: string; uri: string }[];
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(JOBS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedJobsPayload>;
    if (
      parsed.cacheKey === cacheKey &&
      typeof parsed.cachedAt === 'number' &&
      Date.now() - parsed.cachedAt < JOBS_CACHE_TTL_MS &&
      typeof parsed.answer === 'string' &&
      parsed.answer.trim().length > 0
    ) {
      return {
        answer: parsed.answer,
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function writeJobsCache(
  cacheKey: string,
  answer: string,
  sources: { title: string; uri: string }[]
): void {
  if (typeof window === 'undefined' || !answer.trim()) return;
  try {
    const payload: CachedJobsPayload = {
      cacheKey,
      answer,
      sources,
      cachedAt: Date.now(),
    };
    window.localStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota/private-mode storage errors
  }
}

const COUNTRIES = [
  { id: 'Saudi Arabia', en: 'Saudi Arabia', bn: 'সৌদি আরব (Saudi Arabia)' },
  { id: 'UAE', en: 'United Arab Emirates (UAE)', bn: 'সংযুক্ত আরব আমিরাত (UAE)' },
  { id: 'Qatar', en: 'Qatar', bn: 'কাতার (Qatar)' },
  { id: 'Malaysia', en: 'Malaysia', bn: 'মালয়েশিয়া (Malaysia)' },
  { id: 'Singapore', en: 'Singapore', bn: 'সিঙ্গাপুর (Singapore)' },
  { id: 'South Korea (EPS)', en: 'South Korea (EPS)', bn: 'দক্ষিণ কোরিয়া (EPS)' },
  { id: 'Europe (Italy/Romania/Poland)', en: 'Europe (Italy / Romania / Poland)', bn: 'ইউরোপ (ইতালি / রোমানিয়া / পোল্যান্ড)' },
];

const CATEGORIES = [
  { id: 'Electrician & Technician', en: 'Electrician & Technician', bn: 'ইলেকট্রিশিয়ান ও টেকনিশিয়ান' },
  { id: 'Construction & Welding', en: 'Construction & Welding', bn: 'নির্মাণ ও ওয়েল্ডিং কর্মী' },
  { id: 'Driving & Delivery', en: 'Driving & Delivery', bn: 'ড্রাইভিং ও ডেলিভারি' },
  { id: 'Hospitality & Hotel Staff', en: 'Hospitality & Hotel Staff', bn: 'হসপিটালিটি ও হোটেল স্টাফ' },
  { id: 'Factory & Warehouse', en: 'Factory & Warehouse Worker', bn: 'ফ্যাক্টরি ও ওয়্যারহাউস কর্মী' },
  { id: 'IT & Engineering', en: 'IT & Engineering', bn: 'আইটি ও ইঞ্জিনিয়ারিং' },
  { id: 'Nursing & Caregiver', en: 'Nursing & Caregiver', bn: 'নার্সিং ও কেয়ারগিভার' },
];

export const JobsPage: React.FC<JobsPageProps> = ({
  responseLanguage,
  activeModel,
  availableModels,
  onSwitchModel,
  onBusyChange,
  onResultSuccess,
}) => {
  const { uiLang, t } = useUiLanguage();
  const [country, setCountry] = useState(COUNTRIES[0].id);
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [skills, setSkills] = useState('');
  const [debouncing, setDebouncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [queueNotice, setQueueNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [retryAfterSec, setRetryAfterSec] = useState<number | undefined>(undefined);
  const [retryCountdownSec, setRetryCountdownSec] = useState<number | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<{ title: string; uri: string }[]>([]);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const autoRetryAttemptRef = useRef(0);
  const activeModelRef = useRef<GeminiModelId>(activeModel);
  const latestParamsRef = useRef({ country, category, skills, responseLanguage });

  latestParamsRef.current = { country, category, skills, responseLanguage };

  useEffect(() => {
    activeModelRef.current = activeModel;
  }, [activeModel]);

  const clearDebounceTimer = () => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setDebouncing(false);
  };

  const clearRetryCountdown = () => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setRetryCountdownSec(null);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  const executeSearch = async () => {
    clearRetryCountdown();

    if (inFlightRef.current || isGeminiRequestInFlight()) {
      setQueueNotice(
        t(
          'Please wait... Another Gemini request is already running.',
          'অনুগ্রহ করে অপেক্ষা করুন... একটি Gemini অনুরোধ ইতিমধ্যেই চলছে।'
        )
      );
      return;
    }

    const params = latestParamsRef.current;
    const cacheKey = buildJobsCacheKey(
      params.country,
      params.category,
      params.skills,
      params.responseLanguage
    );

    inFlightRef.current = true;
    setLoading(true);
    onBusyChange(true);
    setQueueNotice(null);
    setError(null);
    setErrorCode(undefined);
    setRetryAfterSec(undefined);
    setAnswer('');
    setSources([]);

    let rateLimitErrorForAutoRetry: AiClientError | null = null;

    try {
      await streamAiSse<{
        answer: string;
        sources: { title: string; uri: string }[];
        historyItem: HistoryItem;
        quota: QuotaState;
      }>(
        '/api/ai/jobs',
        {
          country: params.country,
          category: params.category,
          skills: params.skills,
          responseLanguage: params.responseLanguage,
          modelId: activeModelRef.current,
          clientManagedRetry: true,
        },
        {
          onDelta: (chunk) => {
            if (!mountedRef.current) return;
            setAnswer((prev) => (prev ?? '') + chunk);
          },
          onDone: (data) => {
            autoRetryAttemptRef.current = 0;
            writeJobsCache(cacheKey, data.answer, data.sources || []);
            if (!mountedRef.current) return;
            setAnswer(data.answer);
            setSources(data.sources || []);
            onResultSuccess(data.historyItem, data.quota);
          },
        }
      );
    } catch (err) {
      if (!mountedRef.current) return;
      setAnswer(null);
      if (err instanceof AiClientError) {
        setError(err.message);
        setErrorCode(err.errorCode);
        setRetryAfterSec(err.retryAfterSec);
        if (
          err.status === 429 ||
          err.errorCode === 'rate_limit' ||
          err.errorCode === 'quota_exhausted'
        ) {
          rateLimitErrorForAutoRetry = err;
        }
      } else {
        setError(
          err instanceof Error
            ? err.message
            : t('Unexpected error occurred.', 'অপ্রত্যাশিত ত্রুটি হয়েছে।')
        );
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        onBusyChange(false);
      }
    }

    if (
      mountedRef.current &&
      rateLimitErrorForAutoRetry &&
      autoRetryAttemptRef.current < MAX_RATE_LIMIT_RETRIES
    ) {
      const delaySec = RATE_LIMIT_RETRY_DELAYS_SEC[autoRetryAttemptRef.current];
      autoRetryAttemptRef.current += 1;

      // Rotate strictly across free-tier models: gemini-2.5-flash-lite -> gemini-2.5-flash -> gemini-3.1-flash-lite
      const nextFreeModel = getNextFreeRateLimitModel(activeModelRef.current, availableModels);
      if (nextFreeModel && nextFreeModel !== activeModelRef.current) {
        activeModelRef.current = nextFreeModel;
        try {
          await onSwitchModel(nextFreeModel);
        } catch {
          // activeModelRef already points to nextFreeModel for the upcoming retry
        }
      }

      if (!mountedRef.current) return;
      let remaining = delaySec;
      setRetryCountdownSec(remaining);
      countdownIntervalRef.current = window.setInterval(() => {
        if (!mountedRef.current) return;
        remaining -= 1;
        if (remaining <= 0) {
          clearRetryCountdown();
          void executeSearch();
        } else {
          setRetryCountdownSec(remaining);
        }
      }, 1000);
    }
  };

  const handleManualRetry = () => {
    clearDebounceTimer();
    clearRetryCountdown();
    if (inFlightRef.current || isGeminiRequestInFlight()) {
      setQueueNotice(
        t(
          'Please wait... Another Gemini request is already running.',
          'অনুগ্রহ করে অপেক্ষা করুন... একটি Gemini অনুরোধ ইতিমধ্যেই চলছে।'
        )
      );
      return;
    }
    autoRetryAttemptRef.current = 0;
    void executeSearch();
  };

  const handleBeforeModelSwitchRetry = () => {
    clearDebounceTimer();
    clearRetryCountdown();
    setQueueNotice(null);
  };

  const handleBannerSwitchModel = async (modelId: GeminiModelId) => {
    activeModelRef.current = modelId;
    await onSwitchModel(modelId);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const cacheKey = buildJobsCacheKey(country, category, skills, responseLanguage);
    const cached = readValidJobsCache(cacheKey);
    if (cached) {
      clearDebounceTimer();
      clearRetryCountdown();
      autoRetryAttemptRef.current = 0;
      setQueueNotice(null);
      setError(null);
      setErrorCode(undefined);
      setRetryAfterSec(undefined);
      setAnswer(cached.answer);
      setSources(cached.sources);
      return;
    }

    if (inFlightRef.current || loading || isGeminiRequestInFlight()) {
      setQueueNotice(
        t(
          'Please wait... Another Gemini request is already running.',
          'অনুগ্রহ করে অপেক্ষা করুন... একটি Gemini অনুরোধ ইতিমধ্যেই চলছে।'
        )
      );
      return;
    }

    clearRetryCountdown();
    autoRetryAttemptRef.current = 0;
    setQueueNotice(null);
    setError(null);
    setErrorCode(undefined);
    setRetryAfterSec(undefined);

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    setDebouncing(true);
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      if (!mountedRef.current) return;
      setDebouncing(false);
      void executeSearch();
    }, JOBS_DEBOUNCE_MS);
  };

  const activeCountryObj = COUNTRIES.find((c) => c.id === country) ?? COUNTRIES[0];
  const activeCatObj = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t(
            'International Employment · Verified Google Search Grounding',
            'আন্তর্জাতিক কর্মসংস্থান · Google সার্চ ভিত্তিক যাচাইকৃত সূত্র'
          )}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('Global Job Information & Guidance', 'বিদেশে চাকরির তথ্য ও নির্দেশিকা')}
        </h1>
      </div>

      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
          {t(
            'Safety Notice: Always verify visas and recruiting agency licenses through BMET (Ami Probashi) and official embassy portals before making payments.',
            'নিরাপত্তা পরামর্শ: বিদেশে যাওয়ার আগে সর্বদা BMET (আমি প্রবাসী অ্যাপ) ও সংশ্লিষ্ট দূতাবাসের অফিশিয়াল পোর্টাল থেকে ভিসা ও রিক্রুটিং এজেন্সির লাইসেন্স যাচাই করুন।'
          )}
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('Select Destination Country', 'গন্তব্য দেশ নির্বাচন করুন')}
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {COUNTRIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {uiLang === 'bn' ? c.bn : c.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('Job Category', 'কাজের ক্ষেত্র')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {uiLang === 'bn' ? cat.bn : cat.en}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t('Your Experience or Skills (Optional)', 'আপনার অভিজ্ঞতা বা দক্ষতা (ঐচ্ছিক)')}
          </label>
          <input
            type="text"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder={t(
              'e.g., 3 years experience, SSC pass, valid driving license...',
              'যেমন: ৩ বছরের অভিজ্ঞতা, SSC পাস, বৈধ ড্রাইভিং লাইসেন্স আছে...'
            )}
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || debouncing}
            className="min-h-[44px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            {loading || debouncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>
              {debouncing
                ? t('Please wait...', 'অপেক্ষা করুন...')
                : loading
                  ? t('Searching Verified Info...', 'যাচাইকৃত তথ্য খোঁজা হচ্ছে...')
                  : t('Find Jobs & Guide', 'চাকরি ও আবেদন গাইড খুঁজুন')}
            </span>
          </button>
        </div>
      </form>

      {queueNotice && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-2.5 text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200"
        >
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{queueNotice}</span>
        </div>
      )}

      <AiErrorBanner
        error={error}
        errorCode={errorCode}
        retryAfterSec={retryAfterSec}
        retryCountdownSec={retryCountdownSec}
        onRetry={handleManualRetry}
        onBeforeModelSwitchRetry={handleBeforeModelSwitchRetry}
        retrying={loading}
        activeModel={activeModel}
        availableModels={availableModels}
        onSwitchModel={handleBannerSwitchModel}
      />

      {loading && !answer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-blue-700 dark:text-blue-400 shrink-0" />
          <span>{t('Searching verified job details & links...', 'যাচাইকৃত চাকরির তথ্য ও সূত্র খোঁজা হচ্ছে...')}</span>
        </div>
      )}

      {answer && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <Briefcase className="w-5 h-5 text-blue-700 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {uiLang === 'bn' ? activeCountryObj.bn : activeCountryObj.en} —{' '}
                {uiLang === 'bn' ? activeCatObj.bn : activeCatObj.en}
              </h2>
            </div>
            <RichAnswer content={answer} isStreaming={loading} language={responseLanguage} />
          </div>

          {sources.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('Verified Web Sources & Job Links', 'যাচাইকৃত ওয়েব সূত্র ও চাকরির লিংক')}
                </h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 flex items-center justify-between gap-3 text-sm text-blue-700 dark:text-blue-400 hover:underline min-h-[44px]"
                  >
                    <span className="truncate font-medium">{src.title}</span>
                    <ExternalLink className="w-4 h-4 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
