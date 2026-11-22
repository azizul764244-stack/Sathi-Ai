import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Briefcase,
  Crown,
  Film,
  GraduationCap,
  HeartPulse,
  History,
  Image as ImageIcon,
  Megaphone,
  MessageSquareText,
  Moon,
  MoonStar,
  Search,
  Sun,
} from 'lucide-react';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import type {
  AiFeatureFlags,
  AppPage,
  HistoryItem,
  QuotaState,
  SubscriptionState,
  UserProfile,
} from '../types';

export interface ToolDirectoryItem {
  id: string;
  page: AppPage;
  titleEn: string;
  titleBn: string;
  subtitleEn: string;
  subtitleBn: string;
  categoryKey: 'edu_career' | 'health' | 'media';
  categoryEn: string;
  categoryBn: string;
  icon: React.FC<{ className?: string }>;
  accentClass: string;
  noteEn: string;
  noteBn: string;
  featureKey?: keyof AiFeatureFlags;
}

export const TOOL_DIRECTORY: ToolDirectoryItem[] = [
  {
    id: 'assistant',
    page: 'assistant',
    featureKey: 'generalChatEnabled',
    titleEn: 'General AI Chat (ChatGPT-Style)',
    titleBn: 'এআই চ্যাট সহকারী',
    subtitleEn: 'Stories, poems, CVs, job exam Q&A, coding, voice chat & image analysis',
    subtitleBn: 'গল্প, কবিতা, CV, চাকরির প্রশ্নোত্তর, ভয়েস ও ছবি দিয়ে যেকোনো কথা বলুন',
    categoryKey: 'edu_career',
    categoryEn: 'Education & Career',
    categoryBn: 'শিক্ষা ও ক্যারিয়ার',
    icon: MessageSquareText,
    accentClass: 'bg-blue-700 text-white dark:bg-blue-600 dark:text-white',
    noteEn: 'ChatGPT Mode · Voice + Vision',
    noteBn: 'ভয়েস + ছবি + মেমোরি',
  },
  {
    id: 'education',
    page: 'education',
    featureKey: 'educationEnabled',
    titleEn: 'School (Class 6 to HSC)',
    titleBn: 'স্কুল',
    subtitleEn: 'Only Class 6 to HSC',
    subtitleBn: 'শুধু ক্লাস ৬ থেকে HSC',
    categoryKey: 'edu_career',
    categoryEn: 'Education & Career',
    categoryBn: 'শিক্ষা ও ক্যারিয়ার',
    icon: GraduationCap,
    accentClass: 'bg-sky-50 text-sky-600 dark:bg-sky-950/70 dark:text-sky-300',
    noteEn: 'Class 6 – HSC',
    noteBn: 'ক্লাস ৬ থেকে HSC',
  },
  {
    id: 'study_tools',
    page: 'study_tools',
    featureKey: 'educationEnabled',
    titleEn: 'Study Tools (6 Tools)',
    titleBn: 'পড়াশোনা টুলস',
    subtitleEn: 'Photo Math, SSC/HSC Suggestions, Model Test, Note Maker + PDF, Voice Q&A, Simple Bangla',
    subtitleBn: 'ছবি তুলে অংক, SSC/HSC সাজেশন, মডেল টেস্ট, নোট মেকার + PDF, ভয়েস প্রশ্ন, সহজ বাংলা',
    categoryKey: 'edu_career',
    categoryEn: 'Education & Career',
    categoryBn: 'শিক্ষা ও ক্যারিয়ার',
    icon: BookOpenCheck,
    accentClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300',
    noteEn: '6 Study Tools',
    noteBn: '৬টি পড়াশোনা টুলস',
  },
  {
    id: 'qawmi',
    page: 'qawmi',
    featureKey: 'educationEnabled',
    titleEn: 'Qawmi Madrasah (Nurani to Dawra)',
    titleBn: 'কওমি মাদ্রাসা (নূরানী – দাওরায়ে হাদিস)',
    subtitleEn: 'All classes from Nurani & Hifz to Dawra-e-Hadith with Kitabs, tests & notes',
    subtitleBn: 'নূরানী থেকে দাওরায়ে হাদিস পর্যন্ত সব ক্লাসের বই, সাজেশন, মডেল টেস্ট ও নোট',
    categoryKey: 'edu_career',
    categoryEn: 'Education & Career',
    categoryBn: 'শিক্ষা ও ক্যারিয়ার',
    icon: BookOpen,
    accentClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
    noteEn: 'All Qawmi Classes',
    noteBn: 'সব ক্লাস সহজ বাংলায়',
  },
  {
    id: 'alia',
    page: 'alia',
    featureKey: 'educationEnabled',
    titleEn: 'Alia Madrasah (Ebtedayi to Kamil)',
    titleBn: 'আলিয়া মাদ্রাসা (ইবতেদায়ী – কামিল)',
    subtitleEn: 'Ebtedayi, Dakhil, Alim, Fazil & Kamil books, suggestions, model tests & notes',
    subtitleBn: 'ইবতেদায়ী থেকে কামিল পর্যন্ত সব ক্লাসের বই, সাজেশন, মডেল টেস্ট ও নোট',
    categoryKey: 'edu_career',
    categoryEn: 'Education & Career',
    categoryBn: 'শিক্ষা ও ক্যারিয়ার',
    icon: BookOpen,
    accentClass: 'bg-teal-50 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300',
    noteEn: 'Ebtedayi to Kamil',
    noteBn: 'বোর্ড সিলেবাস ও নোট',
  },
  {
    id: 'islamic',
    page: 'islamic',
    featureKey: 'educationEnabled',
    titleEn: 'Islam & Hafez Hub',
    titleBn: 'ইসলাম ও হাফেজ',
    subtitleEn: 'Hafez 30-para tracker, Quran Tafsir, Sahih Hadith, Masnoon Dua & Prayer Times',
    subtitleBn: 'হাফেজ ট্র্যাকার, কোরআন তাফসীর, হাদিস, দোয়া ও নামাজের সময়',
    categoryKey: 'edu_career',
    categoryEn: 'Education & Career',
    categoryBn: 'শিক্ষা ও ক্যারিয়ার',
    icon: MoonStar,
    accentClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300',
    noteEn: 'Tafsir · Hadith · Prayer Times',
    noteBn: 'তাফসীর · হাদিস · নামাজ',
  },
  {
    id: 'quran',
    page: 'quran',
    titleEn: 'Quran Sharif (114 Surahs)',
    titleBn: 'কুরআন শরীফ',
    subtitleEn: 'All 114 Surahs with Arabic, Bengali pronunciation, Bengali meaning, copy & save',
    subtitleBn: '১১৪টি সূরা · আরবি আয়াত, বাংলা উচ্চারণ, বাংলা অর্থ · কপি ও সেভ',
    categoryKey: 'edu_career',
    categoryEn: 'Education & Career',
    categoryBn: 'শিক্ষা ও ক্যারিয়ার',
    icon: BookOpen,
    accentClass: 'bg-green-50 text-green-700 dark:bg-green-950/70 dark:text-green-300',
    noteEn: '114 Surahs',
    noteBn: '১১৪টি সূরা',
  },
  {
    id: 'photo',
    page: 'photo',
    featureKey: 'imageGenerationEnabled',
    titleEn: 'AI Image Generator & Photo Studio',
    titleBn: 'এআই ইমেজ ও ফটো এডিটর',
    subtitleEn: 'Generate or edit images from text & photos + background removal & thumbnails',
    subtitleBn: 'লিখে বা ছবি দিয়ে সুন্দর ছবি তৈরি, ব্যাকগ্রাউন্ড রিমুভ ও ইউটিউব থাম্বনেইল',
    categoryKey: 'media',
    categoryEn: 'Media Studio',
    categoryBn: 'মিডিয়া স্টুডিও',
    icon: ImageIcon,
    accentClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
    noteEn: 'Image Gen + Canvas Editor',
    noteBn: 'এআই ছবি তৈরি ও এডিট',
  },
  {
    id: 'video',
    page: 'video',
    featureKey: 'videoGenerationEnabled',
    titleEn: 'Flow AI Video Studio',
    titleBn: 'Flow AI ভিডিও স্টুডিও',
    subtitleEn: 'Create short videos directly from text or images + AI storyboard',
    subtitleBn: 'টেক্সট বা ছবি থেকে Flow AI-এর মতো ছোট ভিডিও ও স্টোরিবোর্ড তৈরি করুন',
    categoryKey: 'media',
    categoryEn: 'Media Studio',
    categoryBn: 'মিডিয়া স্টুডিও',
    icon: Film,
    accentClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    noteEn: 'Flow AI Text & Image Video',
    noteBn: 'টেক্সট ও ইমেজ টু ভিডিও',
  },
  {
    id: 'jobs',
    page: 'jobs',
    titleEn: 'International Jobs Guide',
    titleBn: 'বিদেশে চাকরি',
    subtitleEn: 'Verified career guidance & visa info for Saudi Arabia, UAE, Qatar & Malaysia',
    subtitleBn: 'সৌদি, UAE, কাতার ও মালয়েশিয়া কাজের গাইড ও যাচাইকৃত সূত্র',
    categoryKey: 'edu_career',
    categoryEn: 'Education & Career',
    categoryBn: 'শিক্ষা ও ক্যারিয়ার',
    icon: Briefcase,
    accentClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300',
    noteEn: 'Verified Search Sources',
    noteBn: 'সার্চ গ্রাউন্ডিং সক্রিয়',
  },
  {
    id: 'health',
    page: 'health',
    titleEn: 'Health Information Assistant',
    titleBn: 'স্বাস্থ্য সহকারী',
    subtitleEn: 'General symptoms, medical terms & medicine safety information (ad-free)',
    subtitleBn: 'সাধারণ লক্ষণ, পরিভাষা ও ওষুধের সতর্কতামূলক তথ্য',
    categoryKey: 'health',
    categoryEn: 'Health',
    categoryBn: 'স্বাস্থ্য',
    icon: HeartPulse,
    accentClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
    noteEn: 'Ad-Free Safe Guidance',
    noteBn: 'বিজ্ঞাপনমুক্ত নিরাপদ তথ্য',
  },
  {
    id: 'social',
    page: 'social',
    titleEn: 'Social Media AI',
    titleBn: 'সোশ্যাল মিডিয়া AI',
    subtitleEn: 'Facebook, TikTok & YouTube video ideas, scripts, captions & hashtags',
    subtitleBn: 'Facebook, TikTok ও YouTube স্ক্রিপ্ট, ক্যাপশন ও হ্যাশট্যাগ',
    categoryKey: 'media',
    categoryEn: 'Media Studio',
    categoryBn: 'মিডিয়া স্টুডিও',
    icon: Megaphone,
    accentClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300',
    noteEn: 'Reels & Shorts Scripts',
    noteBn: 'রিলস ও শর্টস স্ক্রিপ্ট',
  },
];

interface HomeViewProps {
  user: UserProfile;
  subscription: SubscriptionState;
  quota: QuotaState;
  history: HistoryItem[];
  aiFeatures?: AiFeatureFlags;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (page: AppPage) => void;
  onQuickEducationAsk?: (question: string) => void;
}

const PRIMARY_HOME_IDS = new Set([
  'assistant',
  'education',
  'study_tools',
  'qawmi',
  'alia',
  'islamic',
  'quran',
]);

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  subscription,
  quota,
  history,
  aiFeatures,
  theme,
  onToggleTheme,
  onNavigate,
}) => {
  const { uiLang, t, formatDate } = useUiLanguage();
  const remainingToday = Math.max(0, quota.dailyLimit - quota.usedToday);

  const isFeatureEnabled = (key?: keyof AiFeatureFlags) => {
    if (!key || !aiFeatures) return true;
    return aiFeatures[key] !== false;
  };

  const secondaryTools = TOOL_DIRECTORY.filter((tool) => !PRIMARY_HOME_IDS.has(tool.id));

  const primaryCards: {
    id: string;
    page: AppPage;
    title: string;
    subtitle: string;
    gradient: string;
    arrowClass: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    {
      id: 'quran',
      page: 'quran',
      title: '১. কুরআন শরীফ',
      subtitle: '১১৪টি সূরা, আরবি আয়াত, বাংলা উচ্চারণ, বাংলা অর্থ · কপি ও সেভ',
      gradient: 'bg-gradient-to-r from-green-600 to-emerald-700 text-white',
      arrowClass: 'text-green-100',
      icon: BookOpen,
    },
    {
      id: 'assistant',
      page: 'assistant',
      title: '২. এআই চ্যাট সহকারী',
      subtitle: 'গল্প, কবিতা, CV, চাকরির প্রশ্নোত্তর, ভয়েস ও ছবি দিয়ে যেকোনো কথা বলুন',
      gradient: 'bg-gradient-to-r from-blue-700 to-blue-800 text-white',
      arrowClass: 'text-blue-200',
      icon: MessageSquareText,
    },
    {
      id: 'education',
      page: 'education',
      title: '৩. স্কুল',
      subtitle: 'শুধু ক্লাস ৬ থেকে HSC',
      gradient: 'bg-gradient-to-r from-sky-500 to-blue-500 text-white',
      arrowClass: 'text-sky-100',
      icon: GraduationCap,
    },
    {
      id: 'study_tools',
      page: 'study_tools',
      title: '৪. পড়াশোনা টুলস',
      subtitle: 'ছবি তুলে অংক, SSC/HSC সাজেশন, মডেল টেস্ট, নোট মেকার + PDF, ভয়েস প্রশ্ন, সহজ বাংলা',
      gradient: 'bg-gradient-to-r from-purple-600 to-violet-700 text-white',
      arrowClass: 'text-purple-200',
      icon: BookOpenCheck,
    },
    {
      id: 'qawmi',
      page: 'qawmi',
      title: '৫. কওমি মাদ্রাসা',
      subtitle: 'নূরানী থেকে দাওরায়ে হাদিস',
      gradient: 'bg-gradient-to-r from-emerald-600 to-green-700 text-white',
      arrowClass: 'text-emerald-200',
      icon: BookOpen,
    },
    {
      id: 'alia',
      page: 'alia',
      title: '৬. আলিয়া মাদ্রাসা',
      subtitle: 'ইবতেদায়ী থেকে কামিল',
      gradient: 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white',
      arrowClass: 'text-teal-100',
      icon: BookOpen,
    },
    {
      id: 'islamic',
      page: 'islamic',
      title: '৭. ইসলাম ও হাফেজ',
      subtitle: 'হাফেজ ট্র্যাকার, কোরআন, হাদিস, দোয়া, নামাজের সময়',
      gradient: 'bg-gradient-to-r from-indigo-900 to-purple-950 text-white',
      arrowClass: 'text-indigo-200',
      icon: MoonStar,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Workspace Utility Row (Logo untouched) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/sathi-logo.png"
            alt="Sathi AI BD"
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover shadow-md border border-blue-200 dark:border-blue-800 shrink-0"
          />
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span>{t(`Welcome, ${user.name}`, `স্বাগতম, ${user.name}`)}</span>
              <span aria-hidden="true"> · </span>
              <span>{user.location}</span>
            </p>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t('Sathi AI BD Dashboard', 'Sathi AI BD — আপনার দৈনন্দিন বাংলা এআই')}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-blue-700" />
            )}
            <span>
              {theme === 'dark' ? t('Light Theme', 'লাইট থিম') : t('Dark Theme', 'ডার্ক থিম')}
            </span>
          </button>
        </div>
      </div>

      {/* 6 Main Stacked One-Per-Line Color-Coded Buttons */}
      <section aria-label="প্রধান সেবাসমূহ" className="flex flex-col gap-3">
        {primaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onNavigate(card.page)}
              className={`w-full text-left p-4 sm:p-5 rounded-2xl shadow-md hover:shadow-lg hover:scale-[1.005] transition-all flex items-center justify-between gap-4 ${card.gradient}`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold leading-snug">{card.title}</h2>
                  <p className="text-xs sm:text-sm text-white/90 mt-0.5 leading-relaxed">
                    {card.subtitle}
                  </p>
                </div>
              </div>
              <ArrowRight className={`w-5 h-5 shrink-0 ${card.arrowClass}`} />
            </button>
          );
        })}
      </section>

      {/* Compact Quota & Plan Summary */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('Remaining Daily Quota', 'আজকের অবশিষ্ট কোটা')}
            </p>
            <p className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {remainingToday}{' '}
              <span className="text-xs font-normal text-slate-500">/ {quota.dailyLimit}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('Current Plan', 'বর্তমান প্ল্যান')}
            </p>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mt-0.5">
              {subscription.isPaid
                ? subscription.planNameBn
                : t('Free Plan', subscription.planNameBn)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('subscription')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline min-h-[40px]"
        >
          <Crown className="w-4 h-4" />
          <span>{t('Manage Plan', 'প্ল্যান পরিচালনা')}</span>
        </button>
      </section>

      {/* Chrome PWA Install Card */}
      <PWAInstallButton variant="card" />

      {/* Other Unique Services (No Duplicates from Above) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {t('More AI Studios & Guides', 'অন্যান্য এআই সেবা')}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('tools')}
            className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline min-h-[40px] inline-flex items-center gap-1"
          >
            <span>{t('View All Tools', 'সকল টুলস দেখুন')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {secondaryTools.map((tool) => {
            const Icon = tool.icon;
            const enabled = isFeatureEnabled(tool.featureKey);
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onNavigate(tool.page)}
                className="w-full text-left p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tool.accentClass}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {uiLang === 'bn' ? tool.titleBn : tool.titleEn}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {enabled
                        ? uiLang === 'bn'
                          ? tool.subtitleBn
                          : tool.subtitleEn
                        : t('Disabled by Admin', 'অ্যাডমিন বন্ধ রেখেছেন')}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Recent History Section */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('Recent History', 'সাম্প্রতিক ইতিহাস')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline min-h-[40px]"
          >
            {t('View All', 'সব দেখুন')}
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
            {t(
              'No saved activity yet. Start using any AI tool above.',
              'এখনো কোনো কার্যক্রম সংরক্ষিত হয়নি। উপরের যেকোনো টুল ব্যবহার করে শুরু করুন।'
            )}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate('history')}
                className="w-full py-3.5 flex items-center justify-between gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl px-2 transition-colors min-h-[56px]"
              >
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                    <span>{item.toolLabelBn}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="tabular-nums">{formatDate(item.createdAt)}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {item.title}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface AllToolsViewProps {
  onNavigate: (page: AppPage) => void;
  aiFeatures?: AiFeatureFlags;
}

export const AllToolsView: React.FC<AllToolsViewProps> = ({ onNavigate, aiFeatures }) => {
  const { uiLang, t } = useUiLanguage();
  const [search, setSearch] = useState('');
  const [categoryKey, setCategoryKey] = useState<'all' | 'edu_career' | 'health' | 'media'>('all');

  const categories: { key: 'all' | 'edu_career' | 'health' | 'media'; en: string; bn: string }[] = [
    { key: 'all', en: 'All', bn: 'সকল' },
    { key: 'edu_career', en: 'Education & Career', bn: 'শিক্ষা ও ক্যারিয়ার' },
    { key: 'health', en: 'Health', bn: 'স্বাস্থ্য' },
    { key: 'media', en: 'Media Studio', bn: 'মিডিয়া স্টুডিও' },
  ];

  const isFeatureEnabled = (key?: keyof AiFeatureFlags) => {
    if (!key || !aiFeatures) return true;
    return aiFeatures[key] !== false;
  };

  const filtered = TOOL_DIRECTORY.filter((tool) => {
    const matchesCategory = categoryKey === 'all' || tool.categoryKey === categoryKey;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      tool.titleEn.toLowerCase().includes(q) ||
      tool.titleBn.toLowerCase().includes(q) ||
      tool.subtitleEn.toLowerCase().includes(q) ||
      tool.subtitleBn.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('Tools Directory', 'টুলস ডিরেক্টরি')}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('All AI Tools', 'সকল এআই টুলস')}
        </h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              'Search tools (e.g., SSC math, CV, image, video)...',
              'টুল খুঁজুন (যেমন: গণিত, চাকরি, থাম্বনেইল)...'
            )}
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategoryKey(cat.key)}
              className={`px-3 py-2 min-h-[38px] text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                categoryKey === cat.key
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {t(cat.en, cat.bn)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tool) => {
          const Icon = tool.icon;
          const enabled = isFeatureEnabled(tool.featureKey);
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onNavigate(tool.page)}
              className="text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-colors flex flex-col justify-between gap-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tool.accentClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {enabled ? t(tool.categoryEn, tool.categoryBn) : t('Disabled', 'বন্ধ')}
                </span>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  {uiLang === 'bn' ? tool.titleBn : tool.titleEn}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                  {uiLang === 'bn' ? tool.subtitleBn : tool.subtitleEn}
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
                  <span>{t('Open Tool', 'চালু করুন')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
