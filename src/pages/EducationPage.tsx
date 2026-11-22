import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  Send,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { AiErrorBanner } from '../components/AiErrorBanner';
import { RichAnswer } from '../components/RichAnswer';
import { SCHOOL_CLASSES } from '../data/educationCatalog';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { AiClientError, streamAiSse } from '../utils/api';
import type {
  AiErrorCode,
  GeminiModelId,
  GeminiModelOption,
  HistoryItem,
  QuotaState,
  ResponseLanguageCode,
} from '../types';

interface EducationPageProps {
  enabled?: boolean;
  isOnline: boolean;
  educationHistory?: HistoryItem[];
  initialQuestion?: string;
  responseLanguage: ResponseLanguageCode;
  activeModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  onClearInitialQuestion: () => void;
  onBusyChange: (busy: boolean) => void;
  onResultSuccess: (item: HistoryItem, quota: QuotaState) => void;
}

const SUBJECTS = [
  { id: 'Mathematics', en: 'Mathematics (General & Higher)', bn: 'গণিত (সাধারণ ও উচ্চতর)' },
  { id: 'Physics', en: 'Physics', bn: 'পদার্থবিজ্ঞান' },
  { id: 'Chemistry', en: 'Chemistry', bn: 'রসায়ন' },
  { id: 'Biology', en: 'Biology', bn: 'জীববিজ্ঞান' },
  { id: 'English Grammar', en: 'English Grammar & Composition', bn: 'ইংরেজি গ্রামার ও রাইটিং' },
  { id: 'Bangla Grammar', en: 'Bangla Grammar & Literature', bn: 'বাংলা ব্যাকরণ ও সাহিত্য' },
  { id: 'ICT', en: 'ICT (Information & Tech)', bn: 'আইসিটি (তথ্য ও যোগাযোগ প্রযুক্তি)' },
];

const LEVELS = [
  { id: 'SSC', en: 'SSC (Class 9–10)', bn: 'এসএসসি (SSC / নবম–দশম)' },
  { id: 'HSC', en: 'HSC (Class 11–12)', bn: 'এইচএসসি (HSC / একাদশ–দ্বাদশ)' },
  { id: 'Class 6-8', en: 'Class 6–8', bn: 'ষষ্ঠ–অষ্টম শ্রেণি' },
  { id: 'Admission', en: 'Admission & Job Exams', bn: 'ভর্তি ও চাকরি পরীক্ষা' },
];

const SAMPLE_QUESTIONS = [
  {
    en: 'Solve x² - 7x + 12 = 0 step by step with explanation.',
    bn: 'x² - 7x + 12 = 0 সমীকরণটি ধাপে ধাপে সমাধান করো।',
  },
  {
    en: 'Explain the difference between Present Perfect and Past Indefinite Tense with examples.',
    bn: 'Present Perfect ও Past Indefinite Tense-এর পার্থক্য উদাহরণসহ লেখো।',
  },
  {
    en: 'Explain photosynthesis reaction and steps clearly for HSC Biology.',
    bn: 'সালোকসংশ্লেষণ প্রক্রিয়া ও বিক্রিয়া ধাপে ধাপে বুঝিয়ে দাও।',
  },
  {
    en: 'Explain Newton’s 2nd Law F = ma with an SSC physics numerical example.',
    bn: 'নিউটনের ২য় সূত্র F = ma একটি গাণিতিক উদাহরণসহ বুঝিয়ে দাও।',
  },
];

export const EducationPage: React.FC<EducationPageProps> = ({
  enabled = true,
  isOnline,
  educationHistory = [],
  initialQuestion,
  responseLanguage,
  activeModel,
  availableModels,
  onSwitchModel,
  onClearInitialQuestion,
  onBusyChange,
  onResultSuccess,
}) => {
  const { uiLang, t, formatDate } = useUiLanguage();
  const [subject, setSubject] = useState(SUBJECTS[0].id);
  const [level, setLevel] = useState(LEVELS[0].id);
  const [question, setQuestion] = useState(initialQuestion || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [retryAfterSec, setRetryAfterSec] = useState<number | undefined>(undefined);
  const [answer, setAnswer] = useState<string | null>(null);

  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(
    educationHistory[0]?.id ?? null
  );

  const inFlightRef = useRef(false);

  useEffect(() => {
    if (initialQuestion) {
      setQuestion(initialQuestion);
      onClearInitialQuestion();
    }
  }, [initialQuestion, onClearInitialQuestion]);

  if (!enabled) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('Education Mode is Currently Disabled', 'শিক্ষা AI মোড বর্তমানে বন্ধ রয়েছে')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {t(
            'Education Mode has been turned off by the Administrator from the Admin Panel.',
            'অ্যাডমিন প্যানেল থেকে শিক্ষা AI মোড সাময়িকভাবে বন্ধ করা হয়েছে।'
          )}
        </p>
      </div>
    );
  }

  const executeSolve = async () => {
    if (inFlightRef.current) return;
    if (!isOnline) {
      setError(
        t(
          'You are currently offline. You can read your saved study notes below, or reconnect to internet for new questions.',
          'আপনি এখন অফলাইনে আছেন। নিচে সংরক্ষিত শিক্ষার নোট পড়তে পারেন, অথবা নতুন প্রশ্নের জন্য ইন্টারনেট সংযোগ চালু করুন।'
        )
      );
      return;
    }
    if (!question.trim()) {
      setError(
        t(
          'Please enter a study question.',
          'অনুগ্রহ করে আপনার শ্রেণি ও বিষয় সম্পর্কিত একটি প্রশ্ন লিখুন।'
        )
      );
      setErrorCode(undefined);
      setRetryAfterSec(undefined);
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
          subject,
          level,
          question,
          responseLanguage,
          modelId: activeModel,
        },
        {
          onDelta: (chunk) => {
            setAnswer((prev) => (prev ?? '') + chunk);
          },
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
        setError(err instanceof Error ? err.message : t('Unexpected error occurred.', 'অপ্রত্যাশিত ত্রুটি হয়েছে।'));
      }
      setAnswer(null);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      onBusyChange(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSolve();
  };

  const activeSubjectObj = SUBJECTS.find((s) => s.id === subject) ?? SUBJECTS[0];
  const activeSchoolCurriculum =
    SCHOOL_CLASSES.find((c) => c.id === level) ?? SCHOOL_CLASSES[0];

  const triggerKitAiPrompt = async (promptText: string, modeLabel: string) => {
    if (inFlightRef.current) return;
    setQuestion(promptText);
    if (!isOnline) {
      setError('এই মুহূর্তে ইন্টারনেট নেই। তবে প্রতিটা ক্লাসের বই, সাজেশন, মডেল টেস্ট ও সেভড নোট অফলাইনে পড়তে পারবেন।');
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
          subject: `স্কুল (${modeLabel}) — ${subject}`,
          level,
          question: promptText,
          responseLanguage: responseLanguage === 'en' ? 'bn' : responseLanguage,
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
        setError(err instanceof Error ? err.message : 'উত্তর তৈরি করা যায়নি।');
      }
      setAnswer(null);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      onBusyChange(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('School · Only Class 6 to HSC', 'স্কুল · শুধু ক্লাস ৬ থেকে HSC')}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('School (Class 6 to HSC)', 'স্কুল — শুধু ক্লাস ৬ থেকে HSC')}
          </h1>
        </div>
      </div>

      {/* Quick Class Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SCHOOL_CLASSES.map((cls) => {
          const active = cls.id === level;
          return (
            <button
              key={cls.id}
              type="button"
              onClick={() => setLevel(cls.id)}
              className={`p-3 rounded-xl border text-left transition-colors ${
                active
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-sky-500'
              }`}
            >
              <span
                className={`block text-[10px] font-semibold ${
                  active ? 'text-sky-100' : 'text-sky-700 dark:text-sky-400'
                }`}
              >
                {cls.badgeBn}
              </span>
              <span className="text-xs sm:text-sm font-bold block">{cls.nameBn}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Class Books & Chapters Only */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
        <div>
          <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-400">
            {activeSchoolCurriculum.badgeBn}
          </span>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {activeSchoolCurriculum.nameBn} — পাঠ্যবই ও অধ্যায়সমূহ
          </h2>
        </div>

        <div className="space-y-3">
          {activeSchoolCurriculum.books.map((book) => (
            <div
              key={book.title}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{book.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{book.summary}</p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    void triggerKitAiPrompt(
                      `${activeSchoolCurriculum.nameBn} শ্রেণির "${book.title}" বইটির মূল বিষয় ও গুরুত্বপূর্ণ অধ্যায়গুলো সহজ বাংলায় বুঝিয়ে দাও।`,
                      'বই ও অধ্যায়'
                    )
                  }
                  className="px-3 py-1.5 min-h-[36px] rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>অধ্যায় বুঝিয়ে দাও</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {book.chapters.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      void triggerKitAiPrompt(
                        `${activeSchoolCurriculum.nameBn} — "${book.title}" বইয়ের "${ch}" অধ্যায়টি সহজ বাংলায় উদাহরণসহ বুঝিয়ে দাও।`,
                        ch
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-sky-500 transition-colors"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!isOnline && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
          <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              {t('Offline Mode — Saved Study Notes', 'অফলাইন মোড — সংরক্ষিত শিক্ষার নোট')}
            </p>
            <p className="mt-0.5">
              {t(
                'No Mobile Data / Wi-Fi detected. You can read all your saved SSC/HSC study notes below anytime. Reconnect to ask new live AI questions.',
                'মোবাইল ডাটা বা Wi-Fi নেই। আপনি নিচে সংরক্ষিত সব SSC/HSC শিক্ষার নোট পড়তে পারবেন। নতুন প্রশ্ন করতে ইন্টারনেট চালু করুন।'
              )}
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('Select Subject', 'বিষয় নির্বাচন করুন')}
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {uiLang === 'bn' ? s.bn : s.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('Class / Level', 'শ্রেণি / স্তর')}
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {uiLang === 'bn' ? l.bn : l.en}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t('Enter Your Class Question', 'আপনার ক্লাস ও বিষয় সম্পর্কিত প্রশ্ন লিখুন')}
          </label>
          <textarea
            rows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t(
              'e.g., A right triangle has hypotenuse 10 cm and base 6 cm. Find the height.',
              'যেমন: একটি সমকোণী ত্রিভুজের অতিভুজ ১০ সেমি এবং ভূমি ৬ সেমি হলে লম্ব কত?'
            )}
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('Quick Examples:', 'দ্রুত নমুনা:')}
          </span>
          {SAMPLE_QUESTIONS.map((sample) => {
            const label = uiLang === 'bn' ? sample.bn : sample.en;
            return (
              <button
                key={sample.en}
                type="button"
                onClick={() => setQuestion(label)}
                className="px-3 py-1.5 min-h-[36px] rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/50 text-xs text-slate-700 dark:text-slate-300 transition-colors text-left"
              >
                {label.slice(0, 42)}...
              </button>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit"
            disabled={loading || !isOnline}
            className="min-h-[44px] px-6 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>
              {loading
                ? t('Solving...', 'উত্তর তৈরি হচ্ছে...')
                : t('Get Answer', 'উত্তর দেখুন')}
            </span>
          </button>
        </div>
      </form>

      <AiErrorBanner
        error={error}
        errorCode={errorCode}
        retryAfterSec={retryAfterSec}
        onRetry={executeSolve}
        retrying={loading}
        activeModel={activeModel}
        availableModels={availableModels}
        onSwitchModel={onSwitchModel}
      />

      {loading && !answer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-blue-700 dark:text-blue-400 shrink-0" />
          <span>{t('Generating fast step-by-step answer...', 'দ্রুত সমাধান তৈরি হচ্ছে...')}</span>
        </div>
      )}

      {Boolean(answer) && answer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
            <BookOpen className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('Detailed Solution', 'বিস্তারিত সমাধান')} (
              {uiLang === 'bn' ? activeSubjectObj.bn : activeSubjectObj.en})
            </h2>
          </div>
          <RichAnswer content={answer} isStreaming={loading} language={responseLanguage} />
        </div>
      )}

      {/* Saved Study Notes (Offline Local Storage) */}
      {educationHistory.length > 0 && (
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('Saved Study Notes', 'সংরক্ষিত শিক্ষার নোট')} ({educationHistory.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'Saved in local storage — Readable anytime even without Data / Wi-Fi.',
                  'লোকাল স্টোরেজে সংরক্ষিত — ডাটা বা Wi-Fi ছাড়াই যেকোনো সময় পড়তে পারবেন।'
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {educationHistory.map((note) => {
              const isOpen = expandedNoteId === note.id;
              return (
                <div
                  key={note.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedNoteId(isOpen ? null : note.id)}
                    className="w-full p-3.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatDate(note.createdAt, true)}
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {note.title}
                      </p>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-lg">
                        <span className="font-semibold">{t('Question:', 'প্রশ্ন:')}</span> {note.prompt}
                      </p>
                      <RichAnswer content={note.response} language={responseLanguage} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
