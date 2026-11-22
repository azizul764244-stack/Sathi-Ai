import React, { useState } from 'react';
import { CheckCircle2, Globe, Loader2, ShieldCheck } from 'lucide-react';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { GoogleAuthSetupError, signInWithGoogleOneClick } from '../utils/googleAuth';
import type { AppStateResponse, GoogleAuthUser } from '../types';

interface LoginScreenProps {
  onSuccess: (authUser: GoogleAuthUser, nextState?: AppStateResponse) => void;
}

const GoogleLogoSvg: React.FC = () => (
  <svg
    viewBox="0 0 48 48"
    className="w-6 h-6 shrink-0"
    aria-hidden="true"
  >
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
    <path fill="none" d="M0 0h48v48H0z" />
  </svg>
);

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const { uiLang, setUiLang, t } = useUiLanguage();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await signInWithGoogleOneClick();
      onSuccess(result.authUser, result.state);
    } catch (err) {
      if (err instanceof GoogleAuthSetupError && err.code === 'POPUP_CANCELLED') {
        // User closed popup — allow immediate retry cleanly
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-4 py-6 sm:px-6">
      {/* Top Language Toggle with New 3D Robot Logo */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/sathi-logo.png"
            alt="Sathi AI BD"
            className="w-9 h-9 rounded-xl object-cover shadow-sm"
          />
          <span className="text-lg font-bold tracking-tight text-blue-800 dark:text-blue-400">
            Sathi AI BD
          </span>
        </div>

        <button
          type="button"
          onClick={() => setUiLang(uiLang === 'en' ? 'bn' : 'en')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Globe className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
          <span>{uiLang === 'en' ? 'বাংলা' : 'English'}</span>
        </button>
      </div>

      {/* Main Centered Login Card */}
      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-3">
            <img
              src="/sathi-logo.png"
              alt="Sathi AI BD"
              className="w-28 h-28 mx-auto rounded-3xl object-cover shadow-xl border-2 border-blue-200 dark:border-blue-800"
            />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t('Welcome to Sathi AI BD', 'Sathi AI BD-তে স্বাগতম')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {t(
                'Bangladesh’s complete AI assistant for SSC/HSC study, overseas jobs, chat, images & videos.',
                'SSC/HSC পড়াশোনা, বিদেশে চাকরি, এআই চ্যাট, ছবি ও ভিডিও তৈরির সম্পূর্ণ বাংলা AI সাথী।'
              )}
            </p>
          </div>

          <div className="space-y-3">
            {/* Prominent White Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full min-h-[56px] px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 shadow-sm hover:shadow transition-all flex items-center justify-center gap-3 font-semibold text-sm sm:text-[15px] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-700 shrink-0" />
              ) : (
                <GoogleLogoSvg />
              )}
              <span className="truncate">
                {loading
                  ? t('Signing in with Google...', 'Google দিয়ে লগইন হচ্ছে...')
                  : 'Continue with Google / Gmail দিয়ে লগইন করুন'}
              </span>
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                {t(
                  'One-tap Gmail sign in · No password or OTP needed',
                  'এক ক্লিকে Gmail লগইন · কোনো পাসওয়ার্ড বা OTP লাগবে না'
                )}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
              <span>{t('Instant auto-login next time you open Sathi AI BD', 'পরের বার অ্যাপ খুললেই স্বয়ংক্রিয়ভাবে লগইন থাকবে')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
              <span>{t('Automatic account creation with your Gmail profile', 'নতুন হলে আপনার Gmail দিয়ে স্বয়ংক্রিয় অ্যাকাউন্ট তৈরি হবে')}</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-500 dark:text-slate-400">
        Sathi AI BD
      </footer>
    </div>
  );
};
