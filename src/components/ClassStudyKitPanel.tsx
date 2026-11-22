import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Lightbulb,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { ClassCurriculumData } from '../data/educationCatalog';

interface ClassStudyKitPanelProps {
  curriculum: ClassCurriculumData;
  onTriggerAiPrompt: (promptText: string, modeLabel: string) => void;
  disabled?: boolean;
}

type KitTab = 'books' | 'suggestions' | 'model_test' | 'notes';

export const ClassStudyKitPanel: React.FC<ClassStudyKitPanelProps> = ({
  curriculum,
  onTriggerAiPrompt,
  disabled = false,
}) => {
  const [activeTab, setActiveTab] = useState<KitTab>('books');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [noteTopic, setNoteTopic] = useState('');

  const handleSelectOption = (qIndex: number, optIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
            {curriculum.badgeBn}
          </span>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {curriculum.nameBn} — বই, সাজেশন, মডেল টেস্ট ও নোট
          </h2>
        </div>
      </div>

      {/* 4 Study Kit Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(
          [
            { id: 'books', label: 'বই ও অধ্যায়', icon: BookOpen },
            { id: 'suggestions', label: 'সাজেশন', icon: Lightbulb },
            { id: 'model_test', label: 'মডেল টেস্ট', icon: ClipboardCheck },
            { id: 'notes', label: 'সহজ বাংলা নোট', icon: FileText },
          ] as { id: KitTab; label: string; icon: React.FC<{ className?: string }> }[]
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 border transition-colors ${
                active
                  ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/40'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Books */}
      {activeTab === 'books' && (
        <div className="space-y-3">
          {curriculum.books.map((book) => (
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
                  disabled={disabled}
                  onClick={() =>
                    onTriggerAiPrompt(
                      `${curriculum.nameBn} শ্রেণির "${book.title}" বইটির মূল বিষয় ও গুরুত্বপূর্ণ অধ্যায়গুলো একদম সহজ বাংলায় বুঝিয়ে দাও।`,
                      'বই ও অধ্যায়'
                    )
                  }
                  className="px-3 py-1.5 min-h-[36px] rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>সহজ বাংলায় বুঝুন</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {book.chapters.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onTriggerAiPrompt(
                        `${curriculum.nameBn} — "${book.title}" বইয়ের "${ch}" অধ্যায়টি উদাহরণসহ সহজ বাংলায় বুঝিয়ে দাও।`,
                        'বইয়ের অধ্যায়'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-blue-500 transition-colors"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Suggestions */}
      {activeTab === 'suggestions' && (
        <div className="space-y-3">
          <div className="space-y-2">
            {curriculum.suggestions.map((sug, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed"
              >
                <span className="font-bold text-amber-800 dark:text-amber-300 mr-1.5">
                  সাজেশন {i + 1}:
                </span>
                {sug}
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onTriggerAiPrompt(
                `${curriculum.nameBn} পরীক্ষার জন্য বিষয়ভিত্তিক ১০০% গুরুত্বপূর্ণ অধ্যায়, প্রশ্ন ও উত্তরসহ পূর্ণাঙ্গ সাজেশন সহজ বাংলায় তৈরি করে দাও।`,
                'পরীক্ষার সাজেশন'
              )
            }
            className="w-full min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI দিয়ে {curriculum.nameBn}-এর পূর্ণাঙ্গ সাজেশন তৈরি করুন</span>
          </button>
        </div>
      )}

      {/* Tab 3: Interactive Model Test */}
      {activeTab === 'model_test' && (
        <div className="space-y-3">
          {curriculum.modelTests.map((mcq, qIdx) => {
            const chosen = selectedAnswers[qIdx];
            const answered = chosen !== undefined;
            return (
              <div
                key={qIdx}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  প্রশ্ন {qIdx + 1}: {mcq.question}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {mcq.options.map((opt, oIdx) => {
                    const isPicked = chosen === oIdx;
                    const isRight = mcq.correctIndex === oIdx;
                    let cls =
                      'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-500';
                    if (answered) {
                      if (isRight) {
                        cls =
                          'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-semibold';
                      } else if (isPicked) {
                        cls =
                          'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-900 dark:text-rose-200';
                      }
                    }
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => handleSelectOption(qIdx, oIdx)}
                        className={`min-h-[40px] px-3 py-2 rounded-xl border text-left text-xs transition-colors flex items-center justify-between gap-2 ${cls}`}
                      >
                        <span>{opt}</span>
                        {answered && isRight && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        {answered && isPicked && !isRight && (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {answered && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-blue-700 dark:text-blue-400">ব্যাখ্যা: </span>
                    {mcq.explanation}
                  </p>
                )}
              </div>
            );
          })}

          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onTriggerAiPrompt(
                `${curriculum.nameBn} শ্রেণির জন্য ১০টি গুরুত্বপূর্ণ প্রশ্ন ও উত্তরসহ একটি পূর্ণাঙ্গ মডেল টেস্ট (MCQ + সংক্ষিপ্ত প্রশ্ন) সহজ বাংলায় তৈরি করো।`,
                'মডেল টেস্ট'
              )
            }
            className="w-full min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI দিয়ে {curriculum.nameBn}-এর নতুন মডেল টেস্ট দিন</span>
          </button>
        </div>
      )}

      {/* Tab 4: Simple Bengali Notes & Note Maker */}
      {activeTab === 'notes' && (
        <div className="space-y-3">
          {curriculum.quickNotes.map((note) => (
            <div
              key={note.title}
              className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 space-y-1.5"
            >
              <h3 className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200">
                {note.title}
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {note.content}
              </p>
            </div>
          ))}

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="text"
              value={noteTopic}
              onChange={(e) => setNoteTopic(e.target.value)}
              placeholder={`নোট তৈরির বিষয় লিখুন (যেমন: ${curriculum.books[0]?.chapters[0] || 'গুরুত্বপূর্ণ অধ্যায়'})...`}
              className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                const target = noteTopic.trim() || curriculum.books[0]?.title || curriculum.nameBn;
                onTriggerAiPrompt(
                  `${curriculum.nameBn} শ্রেণির "${target}" বিষয়ে পরীক্ষার উপযোগী পয়েন্ট আকারে সহজ বাংলা নোট (সংজ্ঞা, মূল কথা ও উদাহরণসহ) তৈরি করে দাও।`,
                  'নোট মেকার'
                );
              }}
              className="min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              <span>সহজ বাংলা নোট বানান</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
