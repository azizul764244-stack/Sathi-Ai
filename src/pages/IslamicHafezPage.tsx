import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  BookText,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Loader2,
  MapPin,
  MoonStar,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import { AiErrorBanner } from '../components/AiErrorBanner';
import { RichAnswer } from '../components/RichAnswer';
import { VoiceInputButton } from '../components/VoiceControls';
import {
  BD_PRAYER_CITIES,
  computeBangladeshPrayerTimes,
  ISLAMIC_SURAHS,
  MASNOON_DUAS,
  SAHIH_HADITH_TOPICS,
} from '../data/educationCatalog';
import { AiClientError, streamAiSse } from '../utils/api';
import type {
  AiErrorCode,
  GeminiModelId,
  GeminiModelOption,
  HistoryItem,
  QuotaState,
  ResponseLanguageCode,
} from '../types';

interface IslamicHafezPageProps {
  isOnline: boolean;
  responseLanguage: ResponseLanguageCode;
  activeModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  onBusyChange: (busy: boolean) => void;
  onResultSuccess: (item: HistoryItem, quota: QuotaState) => void;
}

type IslamicTab = 'hafez' | 'tafsir' | 'hadith' | 'dua' | 'prayer';

interface HafezTrackerState {
  completedParas: number[];
  todaySobok: string;
  sobokPara: string;
  amukhPara: string;
  dailyLinesTarget: number;
}

const HAFEZ_STORAGE_KEY = 'sathi_hafez_tracker_v1';

function loadHafezState(): HafezTrackerState {
  if (typeof window === 'undefined') {
    return {
      completedParas: [1, 30],
      todaySobok: 'সূরা বাকারা (আয়াত ১-২০)',
      sobokPara: 'পারা ১ — অর্ধেক পৃষ্ঠা করে রিভিশন',
      amukhPara: 'পারা ৩০ (আমপারা)',
      dailyLinesTarget: 15,
    };
  }
  try {
    const raw = window.localStorage.getItem(HAFEZ_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HafezTrackerState>;
      return {
        completedParas: Array.isArray(parsed.completedParas) ? parsed.completedParas : [1, 30],
        todaySobok: parsed.todaySobok || 'সূরা বাকারা (আয়াত ১-২০)',
        sobokPara: parsed.sobokPara || 'পারা ১ রিভিশন',
        amukhPara: parsed.amukhPara || 'পারা ৩০ (আমপারা)',
        dailyLinesTarget: Number(parsed.dailyLinesTarget || 15),
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    completedParas: [1, 30],
    todaySobok: 'সূরা বাকারা (আয়াত ১-২০)',
    sobokPara: 'পারা ১ রিভিশন',
    amukhPara: 'পারা ৩০ (আমপারা)',
    dailyLinesTarget: 15,
  };
}

export const IslamicHafezPage: React.FC<IslamicHafezPageProps> = ({
  isOnline,
  activeModel,
  availableModels,
  onSwitchModel,
  onBusyChange,
  onResultSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<IslamicTab>('hafez');
  const [hafez, setHafez] = useState<HafezTrackerState>(() => loadHafezState());
  const [selectedCityId, setSelectedCityId] = useState<string>('dhaka');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [retryAfterSec, setRetryAfterSec] = useState<number | undefined>(undefined);
  const [answer, setAnswer] = useState<string | null>(null);

  const inFlightRef = useRef(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(HAFEZ_STORAGE_KEY, JSON.stringify(hafez));
    } catch {
      // ignore
    }
  }, [hafez]);

  const togglePara = (paraNum: number) => {
    setHafez((prev) => {
      const exists = prev.completedParas.includes(paraNum);
      const nextParas = exists
        ? prev.completedParas.filter((p) => p !== paraNum)
        : [...prev.completedParas, paraNum].sort((a, b) => a - b);
      return { ...prev, completedParas: nextParas };
    });
  };

  const activeCity =
    BD_PRAYER_CITIES.find((c) => c.id === selectedCityId) ?? BD_PRAYER_CITIES[0];
  const prayerTimes = useMemo(() => computeBangladeshPrayerTimes(activeCity, new Date()), [activeCity]);

  const askIslamicAi = async (promptText: string, topicLabel: string) => {
    if (inFlightRef.current) return;
    if (!isOnline) {
      setError('ইন্টারনেট সংযোগ নেই। তবে হাফেজ ট্র্যাকার, হাদিস, দোয়া এবং নামাজের সময়সূচি অফলাইনেই ব্যবহার করা যাবে।');
      return;
    }
    if (!promptText.trim()) {
      setError('অনুগ্রহ করে সূরা, হাদিস বা মাসআলা লিখে জিজ্ঞেস করুন।');
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    onBusyChange(true);
    setError(null);
    setErrorCode(undefined);
    setRetryAfterSec(undefined);
    setAnswer('');

    try {
      await streamAiSse<{ answer: string; historyItem: HistoryItem; quota: QuotaState }>(
        '/api/ai/education',
        {
          subject: `ইসলাম ও হাফেজ — ${topicLabel}`,
          level: 'সহজ বাংলা',
          question: promptText,
          responseLanguage: 'bn',
          modelId: activeModel,
        },
        {
          onDelta: (chunk) => setAnswer((prev) => (prev ?? '') + chunk),
          onDone: (data) => {
            setAnswer(data.answer);
            onResultSuccess(data.historyItem, data.quota);
          },
        }
      );
    } catch (err) {
      if (err instanceof AiClientError) {
        setError(err.message);
        setErrorCode(err.errorCode);
        setRetryAfterSec(err.retryAfterSec);
      } else {
        setError(err instanceof Error ? err.message : 'উত্তর তৈরি করা যায়নি। আবার চেষ্টা করুন।');
      }
      setAnswer(null);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      onBusyChange(false);
    }
  };

  const progressPct = Math.round((hafez.completedParas.length / 30) * 100);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-teal-900 via-emerald-900 to-slate-900 text-white p-5 sm:p-6 space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-200">
          <MoonStar className="w-4 h-4" />
          <span>সহজ বাংলায় ইসলামিক জ্ঞান ও হিফজ সহায়িকা</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold">
          ইসলাম ও হাফেজ — হাফেজ ট্র্যাকার, তাফসীর, হাদিস, দোয়া ও নামাজের সময়
        </h1>
      </div>

      {/* 5 Main Feature Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(
          [
            { id: 'hafez', label: 'হাফেজ ট্র্যাকার', icon: CheckCircle2 },
            { id: 'tafsir', label: 'কোরআন তাফসীর', icon: BookOpen },
            { id: 'hadith', label: 'সহীহ হাদিস', icon: BookText },
            { id: 'dua', label: 'মাসনূন দোয়া', icon: HeartHandshake },
            { id: 'prayer', label: 'নামাজের সময়', icon: Clock },
          ] as { id: IslamicTab; label: string; icon: React.FC<{ className?: string }> }[]
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                active
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Hafez Tracker */}
      {activeTab === 'hafez' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  ৩০ পারা হিফজ ট্র্যাকার ({hafez.completedParas.length} / ৩০ পারা সম্পন্ন — {progressPct}%)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  যেকোনো পারা নম্বরে ট্যাপ করে হিফজ সম্পন্ন মার্ক করুন (অফলাইনেও সেভ থাকবে)।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHafez((prev) => ({ ...prev, completedParas: [] }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>রিসেট</span>
              </button>
            </div>

            <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {Array.from({ length: 30 }, (_, idx) => idx + 1).map((paraNum) => {
                const done = hafez.completedParas.includes(paraNum);
                return (
                  <button
                    key={paraNum}
                    type="button"
                    onClick={() => togglePara(paraNum)}
                    className={`min-h-[42px] rounded-xl border text-xs font-bold transition-colors ${
                      done
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                    }`}
                  >
                    পারা {paraNum}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold mb-1">আজকের সবক (নতুন পড়া)</label>
                <input
                  type="text"
                  value={hafez.todaySobok}
                  onChange={(e) => setHafez((p) => ({ ...p, todaySobok: e.target.value }))}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">সবকপাড়া (৭ দিনের পড়া)</label>
                <input
                  type="text"
                  value={hafez.sobokPara}
                  onChange={(e) => setHafez((p) => ({ ...p, sobokPara: e.target.value }))}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">আমুখতা (পুরানো পারা)</label>
                <input
                  type="text"
                  value={hafez.amukhPara}
                  onChange={(e) => setHafez((p) => ({ ...p, amukhPara: e.target.value }))}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                void askIslamicAi(
                  `একজন কোরআনের হাফেজের জন্য "${hafez.todaySobok}" সবক মুখস্থ করার সহজ রুটিন, এবং একই ধরনের আয়াত (মুতাশাবিহাত) না ভুলার কার্যকর কৌশল সহজ বাংলায় বলো।`,
                  'হাফেজ হিফজ গাইড'
                )
              }
              className="w-full min-h-[42px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI দিয়ে হিফজ মজবুত করা ও মুতাশাবিহাত টিপস নিন</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: Quran Tafsir */}
      {activeTab === 'tafsir' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              সহজ বাংলায় কোরআন তাফসীর
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              যেকোনো সূরায় ক্লিক করুন বা নিচে সূরা/আয়াত নম্বর লিখে শানে নুযূল ও তাফসীর জানুন।
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ISLAMIC_SURAHS.map((surah) => (
              <button
                key={surah.id}
                type="button"
                disabled={loading}
                onClick={() =>
                  void askIslamicAi(
                    `পবিত্র কোরআনের "${surah.nameBn}"-এর শানে নুযূল, সরল বাংলা অনুবাদ, মূল শিক্ষা এবং সহজ তাফসীর বুঝিয়ে বলো।`,
                    'কোরআন তাফসীর'
                  )
                }
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-left flex items-center justify-between gap-2 transition-colors"
              >
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{surah.nameBn}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{surah.ayahs}</p>
                </div>
                <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Sahih Hadith */}
      {activeTab === 'hadith' && (
        <div className="space-y-3">
          {SAHIH_HADITH_TOPICS.map((h) => (
            <div
              key={h.id}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {h.topicBn} · {h.refBn}
                </span>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    void askIslamicAi(
                      `"${h.topicBn}" বিষয়ক এই হাদিসটির (${h.refBn}) বিস্তারিত শিক্ষা ও বাস্তব জীবনে আমলের উপায় সহজ বাংলায় ব্যাখ্যা করো।`,
                      'হাদিস ব্যাখ্যা'
                    )
                  }
                  className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100"
                >
                  বিস্তারিত ব্যাখ্যা
                </button>
              </div>
              <p className="text-base sm:text-lg font-semibold text-right text-slate-900 dark:text-white" dir="rtl">
                {h.arabic}
              </p>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {h.meaningBn}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: Masnoon Dua */}
      {activeTab === 'dua' && (
        <div className="space-y-3">
          {MASNOON_DUAS.map((dua) => (
            <div
              key={dua.titleBn}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-2"
            >
              <h3 className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {dua.titleBn}
              </h3>
              <p className="text-base sm:text-lg font-semibold text-right text-slate-900 dark:text-white" dir="rtl">
                {dua.arabic}
              </p>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                উচ্চারণ: {dua.pronunciationBn}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                অর্থ: {dua.meaningBn}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* TAB 5: Bangladesh Prayer Times */}
      {activeTab === 'prayer' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  বাংলাদেশ নামাজের সময়সূচি ({activeCity.nameBn})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  আজকের তারিখ অনুযায়ী ফরজ ওয়াক্ত, সেহরি ও ইফতারের আনুমানিক সময় (হানাফী আসর)
                </p>
              </div>
            </div>

            <select
              value={selectedCityId}
              onChange={(e) => setSelectedCityId(e.target.value)}
              className="min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              {BD_PRAYER_CITIES.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.nameBn} বিভাগ
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'সেহরির শেষ সময়', time: prayerTimes.sehriEnd, accent: 'bg-slate-100 dark:bg-slate-800' },
              { label: 'ফজর', time: prayerTimes.fajr, accent: 'bg-emerald-50 dark:bg-emerald-950/40' },
              { label: 'সূর্যোদয়', time: prayerTimes.sunrise, accent: 'bg-amber-50 dark:bg-amber-950/30' },
              { label: 'যোহর', time: prayerTimes.dhuhr, accent: 'bg-emerald-50 dark:bg-emerald-950/40' },
              { label: 'আসর (হানাফী)', time: prayerTimes.asr, accent: 'bg-emerald-50 dark:bg-emerald-950/40' },
              { label: 'মাগরিব / ইফতার', time: prayerTimes.maghrib, accent: 'bg-emerald-50 dark:bg-emerald-950/40' },
              { label: 'ইশা', time: prayerTimes.isha, accent: 'bg-emerald-50 dark:bg-emerald-950/40' },
            ].map((slot) => (
              <div
                key={slot.label}
                className={`p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 ${slot.accent}`}
              >
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{slot.label}</p>
                <p className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {slot.time}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ask Any Islamic / Tafsir / Hadith / Dua Question via AI */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void askIslamicAi(query, 'ইসলামিক প্রশ্নোত্তর');
        }}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            কোরআন তাফসীর, হাদিস, দোয়া বা নামাজের মাসআলা জানতে লিখুন বা ভয়েসে বলুন
          </label>
          <VoiceInputButton
            language="bn"
            onTranscript={(txt) => setQuery((p) => (p.trim() ? `${p.trim()} ${txt}` : txt))}
            onError={(err) => setError(typeof err === 'string' ? err : err.message)}
            disabled={loading || !isOnline}
            compact
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="যেমন: সূরা রহমানের মূল শিক্ষা, বা নামাজে ভুল হলে সাহু সিজদার নিয়ম..."
            className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !isOnline}
            className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{loading ? 'তৈরি হচ্ছে...' : 'জানতে চাই'}</span>
          </button>
        </div>
      </form>

      <AiErrorBanner
        error={error}
        errorCode={errorCode}
        retryAfterSec={retryAfterSec}
        onRetry={() => void askIslamicAi(query, 'ইসলামিক প্রশ্নোত্তর')}
        retrying={loading}
        activeModel={activeModel}
        availableModels={availableModels}
        onSwitchModel={onSwitchModel}
      />

      {loading && !answer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>সহজ বাংলায় উত্তর তৈরি হচ্ছে...</span>
        </div>
      )}

      {Boolean(answer) && answer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          <RichAnswer content={answer} isStreaming={loading} language="bn" />
        </div>
      )}
    </div>
  );
};
