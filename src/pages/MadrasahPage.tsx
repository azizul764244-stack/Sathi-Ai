import React, { useRef, useState } from 'react';
import {
  BookOpen,
  Camera,
  GraduationCap,
  ImagePlus,
  Loader2,
  Send,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { AiErrorBanner } from '../components/AiErrorBanner';
import { ClassStudyKitPanel } from '../components/ClassStudyKitPanel';
import { RichAnswer } from '../components/RichAnswer';
import { VoiceInputButton } from '../components/VoiceControls';
import { ALIA_CLASSES, QAWMI_CLASSES } from '../data/educationCatalog';
import { AiClientError, streamAiSse } from '../utils/api';
import type {
  AiErrorCode,
  GeminiModelId,
  GeminiModelOption,
  HistoryItem,
  QuotaState,
  ResponseLanguageCode,
} from '../types';

interface MadrasahPageProps {
  board: 'qawmi' | 'alia';
  isOnline: boolean;
  responseLanguage: ResponseLanguageCode;
  activeModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  onBusyChange: (busy: boolean) => void;
  onResultSuccess: (item: HistoryItem, quota: QuotaState) => void;
}

export const MadrasahPage: React.FC<MadrasahPageProps> = ({
  board,
  isOnline,
  responseLanguage,
  activeModel,
  availableModels,
  onSwitchModel,
  onBusyChange,
  onResultSuccess,
}) => {
  const classes = board === 'qawmi' ? QAWMI_CLASSES : ALIA_CLASSES;
  const [selectedClassId, setSelectedClassId] = useState(classes[0].id);
  const [question, setQuestion] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [retryAfterSec, setRetryAfterSec] = useState<number | undefined>(undefined);
  const [answer, setAnswer] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const activeClass = classes.find((c) => c.id === selectedClassId) ?? classes[0];

  const boardTitle =
    board === 'qawmi'
      ? 'কওমি মাদ্রাসা — নূরানী থেকে দাওরায়ে হাদিস পর্যন্ত'
      : 'আলিয়া মাদ্রাসা — ইবতেদায়ী থেকে কামিল পর্যন্ত';

  const boardSubtitle =
    board === 'qawmi'
      ? 'নূরানী, হিফজ, তাইসীর, মীযান, হেদায়াতুন নাহু, কাফিয়া, শরহে বেকায়া, জালালাইন, মিশকাত ও দাওরায়ে হাদিস — বই, সাজেশন, মডেল টেস্ট ও নোট।'
      : 'ইবতেদায়ী, দাখিল, আলিম, ফাজিল ও কামিল — প্রতিটা ক্লাসের বই, সাজেশন, মডেল টেস্ট ও সহজ বাংলা নোট।';

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setImagePreview(dataUrl);
      const [meta, base64] = dataUrl.split(',');
      const mimeMatch = meta.match(/data:(.*);base64/);
      setImageMimeType(mimeMatch ? mimeMatch[1] : file.type);
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const runAiRequest = async (promptToSend: string, modeLabel = 'মাদ্রাসা AI') => {
    if (inFlightRef.current) return;
    if (!isOnline) {
      setError('এই মুহূর্তে ইন্টারনেট নেই। তবে উপরের প্রতিটি ক্লাসের বই, সাজেশন, মডেল টেস্ট ও নোট অফলাইনে পড়তে পারবেন।');
      return;
    }
    if (!promptToSend.trim() && !imageBase64) {
      setError('অনুগ্রহ করে কিতাবের নাম, প্রশ্ন লিখুন অথবা কিতাবের পাতার ছবি দিন।');
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
          subject: `${board === 'qawmi' ? 'কওমি মাদ্রাসা' : 'আলিয়া মাদ্রাসা'} — ${modeLabel}`,
          level: activeClass.nameBn,
          question: promptToSend,
          imageBase64,
          imageMimeType,
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
        setError(err instanceof Error ? err.message : 'উত্তর তৈরি করা যায়নি। আবার চেষ্টা করুন।');
      }
      setAnswer(null);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      onBusyChange(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runAiRequest(question, activeClass.nameBn);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white p-5 sm:p-6 space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-200">
          <GraduationCap className="w-4 h-4" />
          <span>{board === 'qawmi' ? 'কওমি মাদ্রাসা সিলেবাস (সব ক্লাস)' : 'বাংলাদেশ মাদ্রাসা শিক্ষা বোর্ড (আলিয়া)'}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold">{boardTitle}</h1>
        <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed max-w-2xl">{boardSubtitle}</p>
      </div>

      {!isOnline && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
          <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
          <span>অফলাইনেও প্রতিটা ক্লাসের বই, সাজেশন, মডেল টেস্ট ও নোট পড়া যাবে।</span>
        </div>
      )}

      {/* All Class Buttons */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
          আপনার ক্লাস / জামাত নির্বাচন করুন ({classes.length}টি স্তর):
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {classes.map((cls) => {
            const active = cls.id === activeClass.id;
            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => setSelectedClassId(cls.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  active
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-emerald-500'
                }`}
              >
                <span
                  className={`block text-[10px] font-semibold mb-0.5 ${
                    active ? 'text-emerald-100' : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {cls.badgeBn}
                </span>
                <span className="text-xs sm:text-sm font-bold leading-snug block">{cls.nameBn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Books, Suggestions, Model Test, Notes Panel for Selected Class */}
      <ClassStudyKitPanel
        key={activeClass.id}
        curriculum={activeClass}
        disabled={loading}
        onTriggerAiPrompt={(promptText, label) => {
          setQuestion(promptText);
          void runAiRequest(promptText, label);
        }}
      />

      {/* Ask Kitab Question / Voice / Photo Solver */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {activeClass.nameBn} — কিতাবের ইবারত, অনুবাদ বা প্রশ্ন জিজ্ঞেস করুন
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ভয়েস দিয়ে প্রশ্ন করুন অথবা বইয়ের পাতার ছবি তুলে আপলোড করুন — সহজ বাংলায় উত্তর পাবেন।
            </p>
          </div>
          <VoiceInputButton
            language="bn"
            onTranscript={(txt) => setQuestion((prev) => (prev.trim() ? `${prev.trim()} ${txt}` : txt))}
            onError={(err) => setError(typeof err === 'string' ? err : err.message)}
            disabled={loading || !isOnline}
            compact
          />
        </div>

        <textarea
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={
            board === 'qawmi'
              ? 'যেমন: মীযানুস সরফের মুদারি বাব, অথবা কিতাবের কোনো ইবারতের তারকীব ও বাংলা অর্থ লিখে দিন...'
              : 'যেমন: দাখিল/আলিম আরবি অনুবাদ, হাদিসের ব্যাখ্যা বা ফিকহের মাসআলা জানতে লিখুন...'
          }
          className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Camera className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>ছবি তুলে প্রশ্ন</span>
              <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
            </label>
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
              <ImagePlus className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>গ্যালারি থেকে ছবি</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>

            {imagePreview && (
              <div className="flex items-center gap-2">
                <img src={imagePreview} alt="আপলোড ছবি" className="w-10 h-10 rounded-lg object-cover border" />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setImageBase64(undefined);
                    setImageMimeType(undefined);
                  }}
                  aria-label="ছবি সরান"
                  className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isOnline}
            className="min-h-[44px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{loading ? 'উত্তর তৈরি হচ্ছে...' : 'সহজ বাংলায় উত্তর নিন'}</span>
          </button>
        </div>
      </form>

      <AiErrorBanner
        error={error}
        errorCode={errorCode}
        retryAfterSec={retryAfterSec}
        onRetry={() => void runAiRequest(question, activeClass.nameBn)}
        retrying={loading}
        activeModel={activeModel}
        availableModels={availableModels}
        onSwitchModel={onSwitchModel}
      />

      {loading && !answer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>সহজ বাংলায় বিস্তারিত উত্তর তৈরি হচ্ছে...</span>
        </div>
      )}

      {Boolean(answer) && answer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
            <BookOpen className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              সহজ বাংলা সমাধান ({activeClass.nameBn})
            </h2>
          </div>
          <RichAnswer content={answer} isStreaming={loading} language="bn" />
        </div>
      )}
    </div>
  );
};
