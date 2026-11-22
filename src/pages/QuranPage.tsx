import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  Copy,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  OFFLINE_FALLBACK_SURAHS,
  QURAN_SURAHS,
  type QuranAyahItem,
  type QuranSurahMeta,
} from '../data/quranSurahs';
import { transliterateQuranToBengali } from '../utils/quranTransliteration';

const SURAH_CACHE_STORAGE_KEY = 'sathi_quran_surah_cache_v3';
const SAVED_SURAHS_STORAGE_KEY = 'sathi_quran_saved_surahs_v1';

type VoiceKind = 'arabic' | 'meaning';

interface ActiveVoiceState {
  surahNumber: number;
  kind: VoiceKind;
  status: 'loading' | 'playing' | 'paused';
  currentTimeSec: number;
  durationSec: number;
}

interface SavedSurahRecord {
  surahNumber: number;
  nameBn: string;
  nameAr: string;
  meaningBn: string;
  revelationBn: 'মক্কী' | 'মাদানী';
  ayahCount: number;
  arabicFull: string;
  pronunciationFull: string;
  meaningFull: string;
  savedAt: string;
}

function toBnDigits(input: number | string): string {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(input).replace(/\d/g, (d) => bn[Number(d)] ?? d);
}

function formatDurationBn(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '০:০০';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${toBnDigits(mins)}:${toBnDigits(String(secs).padStart(2, '0'))}`;
}

function loadCachedSurahAyahs(surahNumber: number): QuranAyahItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SURAH_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, QuranAyahItem[]>;
    const list = map[String(surahNumber)];
    if (!Array.isArray(list) || list.length === 0) return null;
    return list.map((item) => ({
      ...item,
      pronunciationBn:
        item.pronunciationBn || transliterateQuranToBengali(item.transliterationEn || ''),
    }));
  } catch {
    return null;
  }
}

function saveCachedSurahAyahs(surahNumber: number, ayahs: QuranAyahItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(SURAH_CACHE_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, QuranAyahItem[]>) : {};
    map[String(surahNumber)] = ayahs;
    window.localStorage.setItem(SURAH_CACHE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota overflow
  }
}

function loadSavedSurahs(): SavedSurahRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_SURAHS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedSurahs(list: SavedSurahRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_SURAHS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

async function copyPlainText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

export const QuranPage: React.FC = () => {
  const [viewTab, setViewTab] = useState<'surahs' | 'saved'>('surahs');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSurah, setSelectedSurah] = useState<QuranSurahMeta | null>(null);
  const [ayahs, setAyahs] = useState<QuranAyahItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedSurahs, setSavedSurahs] = useState<SavedSurahRecord[]>(() => loadSavedSurahs());
  const [activeVoice, setActiveVoice] = useState<ActiveVoiceState | null>(null);
  const [audioError, setAudioError] = useState<{
    surahNumber: number;
    kind: VoiceKind;
    message: string;
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTokenRef = useRef<number>(0);
  const selectedSurahRef = useRef<QuranSurahMeta | null>(null);

  useEffect(() => {
    selectedSurahRef.current = selectedSurah;
  }, [selectedSurah]);

  const stopAllPlayback = () => {
    playTokenRef.current += 1;

    if (audioRef.current) {
      try {
        audioRef.current.onplaying = null;
        audioRef.current.oncanplay = null;
        audioRef.current.onwaiting = null;
        audioRef.current.onpause = null;
        audioRef.current.ontimeupdate = null;
        audioRef.current.onloadedmetadata = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      } catch {
        // ignore
      }
      audioRef.current = null;
    }

    setActiveVoice(null);
  };

  useEffect(() => {
    return () => {
      stopAllPlayback();
    };
  }, []);

  const savedSurahSet = useMemo(
    () => new Set(savedSurahs.map((item) => item.surahNumber)),
    [savedSurahs]
  );

  const filteredSurahs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return QURAN_SURAHS;
    return QURAN_SURAHS.filter(
      (s) =>
        String(s.number) === q ||
        toBnDigits(s.number) === q ||
        s.nameBn.toLowerCase().includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.meaningBn.toLowerCase().includes(q) ||
        s.nameAr.includes(q)
    );
  }, [searchQuery]);

  const arabicFull = useMemo(
    () =>
      ayahs
        .map((a) => a.arabic.trim())
        .filter(Boolean)
        .join(' '),
    [ayahs]
  );

  const pronunciationFull = useMemo(
    () =>
      ayahs
        .map((a) => a.pronunciationBn.trim())
        .filter(Boolean)
        .join(' '),
    [ayahs]
  );

  const meaningFull = useMemo(
    () =>
      ayahs
        .map((a) => a.meaningBn.trim())
        .filter(Boolean)
        .join(' '),
    [ayahs]
  );

  const openSurah = async (surah: QuranSurahMeta) => {
    stopAllPlayback();
    setAudioError(null);
    setSelectedSurah(surah);
    selectedSurahRef.current = surah;
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const cached = loadCachedSurahAyahs(surah.number);
    if (cached && cached.length > 0) {
      setAyahs(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setAyahs([]);

    try {
      const res = await fetch(`/api/quran/surah/${surah.number}`);
      const data = (await res.json()) as {
        ayahs?: QuranAyahItem[];
        error?: string;
      };
      if (!res.ok || !Array.isArray(data.ayahs) || data.ayahs.length === 0) {
        throw new Error(data.error || 'সূরাটি লোড করা যায়নি।');
      }
      const normalized = data.ayahs.map((item) => ({
        ...item,
        pronunciationBn:
          item.pronunciationBn || transliterateQuranToBengali(item.transliterationEn || ''),
      }));
      if (selectedSurahRef.current?.number !== surah.number) return;
      setAyahs(normalized);
      saveCachedSurahAyahs(surah.number, normalized);
    } catch (err) {
      if (selectedSurahRef.current?.number !== surah.number) return;
      const fallback = OFFLINE_FALLBACK_SURAHS[surah.number];
      if (fallback) {
        setAyahs(fallback);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'ইন্টারনেট সংযোগ না থাকায় সূরাটি লোড করা যায়নি। আবার চেষ্টা করুন।'
        );
      }
    } finally {
      if (selectedSurahRef.current?.number === surah.number) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    persistSavedSurahs(savedSurahs);
  }, [savedSurahs]);

  const handleCopyFullSurah = async (params: {
    id: string;
    nameBn: string;
    nameAr: string;
    arabicText: string;
    pronunciationText: string;
    meaningText: string;
  }) => {
    const formatted = [
      `সূরা ${params.nameBn} (${params.nameAr})`,
      '',
      '১. সম্পূর্ণ আরবি সূরা:',
      params.arabicText,
      '',
      '২. সম্পূর্ণ বাংলা উচ্চারণ:',
      params.pronunciationText,
      '',
      '৩. সম্পূর্ণ বাংলা অর্থ:',
      params.meaningText,
    ].join('\n');

    await copyPlainText(formatted);
    setCopiedId(params.id);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === params.id ? null : prev));
    }, 2000);
  };

  const handleToggleSaveSurah = (surah: QuranSurahMeta) => {
    setSavedSurahs((prev) => {
      if (prev.some((item) => item.surahNumber === surah.number)) {
        return prev.filter((item) => item.surahNumber !== surah.number);
      }
      const record: SavedSurahRecord = {
        surahNumber: surah.number,
        nameBn: surah.nameBn,
        nameAr: surah.nameAr,
        meaningBn: surah.meaningBn,
        revelationBn: surah.revelationBn,
        ayahCount: surah.ayahCount,
        arabicFull,
        pronunciationFull,
        meaningFull,
        savedAt: new Date().toISOString(),
      };
      return [record, ...prev];
    });
  };

  const handleRemoveSavedSurah = (surahNumber: number) => {
    setSavedSurahs((prev) => prev.filter((item) => item.surahNumber !== surahNumber));
  };

  /**
   * Starts continuous audio strictly bound to (surah.number, kind) synchronously inside the
   * click gesture so mobile browsers (iOS Safari / Android Chrome) play reliably without blocks.
   */
  const startSurahAudio = (surah: QuranSurahMeta, kind: VoiceKind) => {
    // Always stop any other active audio first so two audios never play together
    stopAllPlayback();
    setAudioError(null);

    const targetSurahNumber = surah.number;
    const token = playTokenRef.current;

    const audioUrl =
      kind === 'arabic'
        ? `/api/quran/surah-audio/${targetSurahNumber}`
        : `/api/quran/bn-meaning-audio/${targetSurahNumber}`;

    setActiveVoice({
      surahNumber: targetSurahNumber,
      kind,
      status: 'loading',
      currentTimeSec: 0,
      durationSec: 0,
    });

    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audioRef.current = audio;

    const isStillValid = () =>
      playTokenRef.current === token &&
      selectedSurahRef.current?.number === targetSurahNumber;

    audio.onloadedmetadata = () => {
      if (!isStillValid()) return;
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      setActiveVoice((prev) =>
        prev && prev.surahNumber === targetSurahNumber && prev.kind === kind
          ? { ...prev, durationSec: dur }
          : prev
      );
    };

    audio.onplaying = () => {
      if (!isStillValid()) return;
      setActiveVoice((prev) =>
        prev && prev.surahNumber === targetSurahNumber && prev.kind === kind
          ? {
              ...prev,
              status: 'playing',
              durationSec: Number.isFinite(audio.duration) ? audio.duration : prev.durationSec,
            }
          : prev
      );
    };

    audio.oncanplay = () => {
      if (!isStillValid()) return;
      setActiveVoice((prev) =>
        prev &&
        prev.surahNumber === targetSurahNumber &&
        prev.kind === kind &&
        prev.status === 'loading'
          ? { ...prev, status: 'playing' }
          : prev
      );
    };

    audio.onwaiting = () => {
      if (!isStillValid()) return;
      setActiveVoice((prev) =>
        prev && prev.surahNumber === targetSurahNumber && prev.kind === kind
          ? { ...prev, status: 'loading' }
          : prev
      );
    };

    audio.ontimeupdate = () => {
      if (!isStillValid()) return;
      setActiveVoice((prev) =>
        prev && prev.surahNumber === targetSurahNumber && prev.kind === kind
          ? {
              ...prev,
              currentTimeSec: audio.currentTime || 0,
              durationSec: Number.isFinite(audio.duration) ? audio.duration : prev.durationSec,
            }
          : prev
      );
    };

    audio.onpause = () => {
      if (!isStillValid() || audio.ended) return;
      setActiveVoice((prev) =>
        prev && prev.surahNumber === targetSurahNumber && prev.kind === kind
          ? { ...prev, status: 'paused' }
          : prev
      );
    };

    audio.onended = () => {
      if (!isStillValid()) return;
      audioRef.current = null;
      setActiveVoice(null);
    };

    audio.onerror = () => {
      if (!isStillValid()) return;
      stopAllPlayback();
      setAudioError({
        surahNumber: targetSurahNumber,
        kind,
        message:
          kind === 'arabic'
            ? 'আরবি তিলাওয়াত অডিও লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।'
            : 'বাংলা অর্থের ভয়েস অডিও লোড করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
      });
    };

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err: unknown) => {
        if (!isStillValid()) return;
        // AbortError happens when user switches quickly; ignore it cleanly
        if (err instanceof DOMException && err.name === 'AbortError') return;
        stopAllPlayback();
        setAudioError({
          surahNumber: targetSurahNumber,
          kind,
          message:
            kind === 'arabic'
              ? 'আরবি তিলাওয়াত চালু করা যায়নি। আবার চেষ্টা করুন।'
              : 'বাংলা অর্থের ভয়েস চালু করা যায়নি। আবার চেষ্টা করুন।',
        });
      });
    }
  };

  const handleTogglePlayPauseResume = (surah: QuranSurahMeta, kind: VoiceKind) => {
    const isSameActive =
      activeVoice &&
      activeVoice.surahNumber === surah.number &&
      activeVoice.kind === kind &&
      audioRef.current !== null;

    if (!isSameActive) {
      startSurahAudio(surah, kind);
      return;
    }

    const audio = audioRef.current!;
    if (activeVoice.status === 'playing') {
      audio.pause();
      setActiveVoice((prev) => (prev ? { ...prev, status: 'paused' } : null));
    } else if (activeVoice.status === 'paused') {
      const p = audio.play();
      setActiveVoice((prev) => (prev ? { ...prev, status: 'playing' } : null));
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          startSurahAudio(surah, kind);
        });
      }
    }
  };

  const handleRestartFromBeginning = (surah: QuranSurahMeta, kind: VoiceKind) => {
    if (
      activeVoice &&
      activeVoice.surahNumber === surah.number &&
      activeVoice.kind === kind &&
      audioRef.current
    ) {
      try {
        audioRef.current.currentTime = 0;
        const p = audioRef.current.play();
        setActiveVoice((prev) =>
          prev ? { ...prev, status: 'playing', currentTimeSec: 0 } : null
        );
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            startSurahAudio(surah, kind);
          });
        }
        return;
      } catch {
        // fall through to clean restart
      }
    }
    startSurahAudio(surah, kind);
  };

  const renderVoiceControlsBar = (surah: QuranSurahMeta, kind: VoiceKind) => {
    const isThisActive =
      activeVoice !== null &&
      activeVoice.surahNumber === surah.number &&
      activeVoice.kind === kind;

    const mainLabel = kind === 'arabic' ? '🔊 আরবি তিলাওয়াত' : '🔊 বাংলা অর্থ';
    const thisError =
      audioError && audioError.surahNumber === surah.number && audioError.kind === kind
        ? audioError.message
        : null;

    return (
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {!isThisActive ? (
            <button
              type="button"
              onClick={() => startSurahAudio(surah, kind)}
              className="min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors border bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm"
            >
              <Volume2 className="w-4 h-4" />
              <span>{mainLabel}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleTogglePlayPauseResume(surah, kind)}
                disabled={activeVoice.status === 'loading'}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors border disabled:opacity-75 ${
                  activeVoice.status === 'playing'
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700 shadow-sm'
                    : activeVoice.status === 'paused'
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-sm'
                      : 'bg-emerald-600 text-white border-emerald-600'
                }`}
              >
                {activeVoice.status === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : activeVoice.status === 'playing' ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>
                  {activeVoice.status === 'loading'
                    ? 'অডিও লোড হচ্ছে...'
                    : activeVoice.status === 'playing'
                      ? 'Pause'
                      : 'Resume'}
                </span>
              </button>

              <button
                type="button"
                onClick={stopAllPlayback}
                className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition-colors border bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-800 hover:bg-rose-100"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>

              <button
                type="button"
                onClick={() => handleRestartFromBeginning(surah, kind)}
                className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition-colors border bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>আবার শুরু থেকে</span>
              </button>

              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 px-2">
                {formatDurationBn(activeVoice.currentTimeSec)}
                {activeVoice.durationSec > 0
                  ? ` / ${formatDurationBn(activeVoice.durationSec)}`
                  : ''}
              </span>
            </>
          )}
        </div>

        {thisError && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl px-3.5 py-2.5">
            <span>{thisError}</span>
            <button
              type="button"
              onClick={() => startSurahAudio(surah, kind)}
              className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold inline-flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>আবার চেষ্টা করুন</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  // Detailed Surah View — Complete Quran Audio System with 2 dedicated Voice Buttons
  if (selectedSurah) {
    const prevSurah = QURAN_SURAHS.find((s) => s.number === selectedSurah.number - 1) ?? null;
    const nextSurah = QURAN_SURAHS.find((s) => s.number === selectedSurah.number + 1) ?? null;
    const isSurahSaved = savedSurahSet.has(selectedSurah.number);
    const isSurahCopied = copiedId === `surah:${selectedSurah.number}`;

    const isArabicActive =
      activeVoice?.surahNumber === selectedSurah.number && activeVoice.kind === 'arabic';
    const isMeaningActive =
      activeVoice?.surahNumber === selectedSurah.number && activeVoice.kind === 'meaning';

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              stopAllPlayback();
              setSelectedSurah(null);
            }}
            className="min-h-[42px] px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>১১৪ সূরার তালিকায় ফিরুন</span>
          </button>

          <div className="flex items-center gap-2">
            {prevSurah && (
              <button
                type="button"
                onClick={() => void openSurah(prevSurah)}
                className="min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-500 inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>আগের সূরা</span>
              </button>
            )}
            {nextSurah && (
              <button
                type="button"
                onClick={() => void openSurah(nextSurah)}
                className="min-h-[40px] px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1"
              >
                <span>পরের সূরা</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Surah Header Card */}
        <div className="rounded-2xl bg-gradient-to-r from-emerald-700 to-green-800 text-white p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-emerald-100">
                সূরা নং {toBnDigits(selectedSurah.number)} · {selectedSurah.revelationBn} · মোট{' '}
                {toBnDigits(selectedSurah.ayahCount)} আয়াত
              </span>
              <h1 className="text-xl sm:text-2xl font-bold mt-1">
                সূরা {selectedSurah.nameBn} ({selectedSurah.meaningBn})
              </h1>
            </div>

            <p
              dir="rtl"
              lang="ar"
              className="font-quran text-2xl sm:text-3xl font-bold text-emerald-50"
            >
              {selectedSurah.nameAr}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={loading || ayahs.length === 0}
              onClick={() =>
                void handleCopyFullSurah({
                  id: `surah:${selectedSurah.number}`,
                  nameBn: selectedSurah.nameBn,
                  nameAr: selectedSurah.nameAr,
                  arabicText: arabicFull,
                  pronunciationText: pronunciationFull,
                  meaningText: meaningFull,
                })
              }
              className={`min-h-[40px] px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors disabled:opacity-50 ${
                isSurahCopied
                  ? 'bg-white text-emerald-800'
                  : 'bg-white/15 hover:bg-white/25 text-white border border-white/25'
              }`}
            >
              {isSurahCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{isSurahCopied ? 'পুরো সূরা কপি হয়েছে' : 'কপি'}</span>
            </button>

            <button
              type="button"
              disabled={loading || ayahs.length === 0}
              onClick={() => handleToggleSaveSurah(selectedSurah)}
              className={`min-h-[40px] px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors disabled:opacity-50 ${
                isSurahSaved
                  ? 'bg-white text-emerald-800'
                  : 'bg-white/15 hover:bg-white/25 text-white border border-white/25'
              }`}
            >
              {isSurahSaved ? (
                <BookmarkCheck className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
              <span>{isSurahSaved ? 'সেভ করা হয়েছে' : 'সেভ'}</span>
            </button>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center justify-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-700 dark:text-emerald-400" />
            <span>সূরা {selectedSurah.nameBn} লোড হচ্ছে...</span>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-rose-800 dark:text-rose-200 font-medium">
              {error}
            </p>
            <button
              type="button"
              onClick={() => void openSurah(selectedSurah)}
              className="min-h-[40px] px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>আবার চেষ্টা করুন</span>
            </button>
          </div>
        )}

        {!loading && ayahs.length > 0 && (
          <div className="space-y-5">
            {/* ১. সম্পূর্ণ আরবি সূরা + 🔊 আরবি তিলাওয়াত */}
            <section
              className={`rounded-2xl p-5 sm:p-6 shadow-sm transition-all border-2 space-y-4 ${
                isArabicActive
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/25'
                  : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/80'
              }`}
            >
              <div className="space-y-3 pb-3 border-b border-emerald-100 dark:border-emerald-900/60">
                <h2 className="text-sm sm:text-base font-bold text-emerald-900 dark:text-emerald-200">
                  ১. সম্পূর্ণ আরবি সূরা
                </h2>
                {renderVoiceControlsBar(selectedSurah, 'arabic')}
              </div>

              <div className="rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 px-4 py-5 sm:px-6">
                <p
                  dir="rtl"
                  lang="ar"
                  className="font-quran text-2xl sm:text-3xl leading-[2.5] font-normal text-slate-900 dark:text-white text-right whitespace-normal"
                >
                  {arabicFull}
                </p>
              </div>
            </section>

            {/* ২. সম্পূর্ণ বাংলা উচ্চারণ */}
            <section className="rounded-2xl p-5 sm:p-6 shadow-sm border-2 bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/80 space-y-3">
              <h2 className="text-sm sm:text-base font-bold text-emerald-900 dark:text-emerald-200 pb-3 border-b border-emerald-100 dark:border-emerald-900/60">
                ২. সম্পূর্ণ বাংলা উচ্চারণ
              </h2>
              <p className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-100 leading-relaxed whitespace-normal break-words">
                {pronunciationFull}
              </p>
            </section>

            {/* ৩. সম্পূর্ণ বাংলা অর্থ + 🔊 বাংলা অর্থ */}
            <section
              className={`rounded-2xl p-5 sm:p-6 shadow-sm transition-all border-2 space-y-4 ${
                isMeaningActive
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/25'
                  : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/80'
              }`}
            >
              <div className="space-y-3 pb-3 border-b border-emerald-100 dark:border-emerald-900/60">
                <h2 className="text-sm sm:text-base font-bold text-emerald-900 dark:text-emerald-200">
                  ৩. সম্পূর্ণ বাংলা অর্থ
                </h2>
                {renderVoiceControlsBar(selectedSurah, 'meaning')}
              </div>

              <p className="text-base sm:text-lg text-slate-700 dark:text-slate-200 leading-relaxed whitespace-normal break-words">
                {meaningFull}
              </p>
            </section>
          </div>
        )}
      </div>
    );
  }

  // Main 114 Surahs List + Saved Surahs View
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-700 to-green-800 text-white p-5 sm:p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">কুরআন শরীফ</h1>
              <p className="text-xs sm:text-sm text-emerald-100 mt-0.5">
                ১১৪টি সূরা · সম্পূর্ণ আরবি তিলাওয়াত ও বাংলা অর্থের মধুর ভয়েস
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: 114 Surahs vs Saved Surahs */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setViewTab('surahs')}
          className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold border transition-colors ${
            viewTab === 'surahs'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500'
          }`}
        >
          ১১৪টি সূরার তালিকা
        </button>

        <button
          type="button"
          onClick={() => setViewTab('saved')}
          className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold border transition-colors ${
            viewTab === 'saved'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500'
          }`}
        >
          সেভ করা সূরা ({toBnDigits(savedSurahs.length)})
        </button>
      </div>

      {viewTab === 'surahs' && (
        <>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="সূরার নাম বা নম্বর দিয়ে খুঁজুন (যেমন: ফাতিহা, বাকারা, ইয়াসীন, ১১২)..."
              className="w-full min-h-[46px] pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            {filteredSurahs.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                কোনো সূরা খুঁজে পাওয়া যায়নি। অন্য নাম বা নম্বর লিখে চেষ্টা করুন।
              </div>
            ) : (
              filteredSurahs.map((surah) => (
                <button
                  key={surah.number}
                  type="button"
                  onClick={() => void openSurah(surah)}
                  className="w-full text-left p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-sm flex items-center justify-center shrink-0">
                      {toBnDigits(surah.number)}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                        সূরা {surah.nameBn}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        অর্থ: {surah.meaningBn} · {surah.revelationBn} · {toBnDigits(surah.ayahCount)}{' '}
                        আয়াত
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      dir="rtl"
                      lang="ar"
                      className="font-quran text-xl sm:text-2xl font-bold text-emerald-800 dark:text-emerald-300"
                    >
                      {surah.nameAr}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {viewTab === 'saved' && (
        <div className="space-y-3">
          {savedSurahs.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
              <Bookmark className="w-8 h-8 text-emerald-700 dark:text-emerald-400 mx-auto" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                এখনো কোনো সূরা সেভ করা হয়নি
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                যেকোনো সূরা খুলে উপরে থাকা “সেভ” বাটনে ক্লিক করলে এখানে সংরক্ষিত থাকবে।
              </p>
            </div>
          ) : (
            savedSurahs.map((item) => {
              const isCopied = copiedId === `saved:${item.surahNumber}`;
              const matchedMeta = QURAN_SURAHS.find((s) => s.number === item.surahNumber);

              return (
                <div
                  key={item.surahNumber}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        {toBnDigits(item.surahNumber)}. সূরা {item.nameBn} ({item.nameAr})
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.revelationBn} · {toBnDigits(item.ayahCount)} আয়াত
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {matchedMeta && (
                        <button
                          type="button"
                          onClick={() => void openSurah(matchedMeta)}
                          className="min-h-[34px] px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                        >
                          সূরা পড়ুন ও শুনুন
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyFullSurah({
                            id: `saved:${item.surahNumber}`,
                            nameBn: item.nameBn,
                            nameAr: item.nameAr,
                            arabicText: item.arabicFull,
                            pronunciationText: item.pronunciationFull,
                            meaningText: item.meaningFull,
                          })
                        }
                        className={`min-h-[34px] px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 ${
                          isCopied
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{isCopied ? 'কপি হয়েছে' : 'কপি'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveSavedSurah(item.surahNumber)}
                        className="min-h-[34px] px-3 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>মুছুন</span>
                      </button>
                    </div>
                  </div>

                  <p
                    dir="rtl"
                    lang="ar"
                    className="font-quran text-xl leading-[2.2] text-slate-900 dark:text-white text-right line-clamp-2"
                  >
                    {item.arabicFull}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
