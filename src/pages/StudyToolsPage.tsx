import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpenCheck,
  Calculator,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  ImagePlus,
  Lightbulb,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  XCircle,
} from 'lucide-react';
import { AiErrorBanner } from '../components/AiErrorBanner';
import { RichAnswer } from '../components/RichAnswer';
import { VoiceInputButton, VoiceOutputButton } from '../components/VoiceControls';
import { AiClientError, streamAiSse } from '../utils/api';
import { downloadStudyNotePdf } from '../utils/pdfDownload';
import type {
  AiErrorCode,
  GeminiModelId,
  GeminiModelOption,
  HistoryItem,
  QuotaState,
  ResponseLanguageCode,
} from '../types';

interface StudyToolsPageProps {
  isOnline: boolean;
  responseLanguage: ResponseLanguageCode;
  activeModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  onBusyChange: (busy: boolean) => void;
  onResultSuccess: (item: HistoryItem, quota: QuotaState) => void;
}

type StudyToolTab =
  | 'photo_math'
  | 'suggestions'
  | 'model_test'
  | 'note_maker'
  | 'voice_question'
  | 'simple_bangla';

interface McqItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface McqTestSet {
  id: 'ssc' | 'hsc' | 'ict_general';
  titleBn: string;
  subtitleBn: string;
  durationSec: number;
  questions: McqItem[];
}

const MODEL_TEST_SETS: McqTestSet[] = [
  {
    id: 'ssc',
    titleBn: 'SSC পূর্ণাঙ্গ মডেল টেস্ট (১০টি MCQ)',
    subtitleBn: 'গণিত, পদার্থ, রসায়ন, জীববিজ্ঞান, বাংলা ও ইংরেজি — সময়: ১০ মিনিট',
    durationSec: 600,
    questions: [
      {
        question: 'একটি সমকোণী ত্রিভুজের অতিভুজ ১৩ সেমি এবং ভূমি ৫ সেমি হলে লম্ব কত?',
        options: ['৮ সেমি', '১০ সেমি', '১২ সেমি', '১৫ সেমি'],
        correctIndex: 2,
        explanation: 'লম্ব = √(১৩² - ৫²) = √(১৬৯ - ২৫) = √১৪৪ = ১২ সেমি।',
      },
      {
        question: 'a + b = 5 এবং ab = 6 হলে, a² + b²-এর মান কত?',
        options: ['১১', '১৩', '১৭', '২৫'],
        correctIndex: 1,
        explanation: 'a² + b² = (a + b)² - 2ab = 5² - 2×6 = 25 - 12 = 13।',
      },
      {
        question: 'বলের এসআই (SI) একক কোনটি?',
        options: ['জুল', 'ওয়াট', 'নিউটন', 'প্যাসকেল'],
        correctIndex: 2,
        explanation: 'বলের আন্তর্জাতিক একক হলো নিউটন (N)।',
      },
      {
        question: 'পানির স্ফুটনাঙ্ক সেলসিয়াস স্কেলে কত?',
        options: ['০° C', '৫০° C', '১০০° C', '২১২° C'],
        correctIndex: 2,
        explanation: 'স্বাভাবিক চাপে পানির স্ফুটনাঙ্ক ১০০° সেলসিয়াস।',
      },
      {
        question: 'খাবার লবণের রাসায়নিক সংকেত কোনটি?',
        options: ['KCl', 'NaCl', 'CaCO₃', 'NaOH'],
        correctIndex: 1,
        explanation: 'খাবার লবণ হলো সোডিয়াম ক্লোরাইড (NaCl)।',
      },
      {
        question: 'উদ্ভিদের খাদ্য তৈরির প্রক্রিয়ার নাম কী?',
        options: ['শ্বসন', 'সালোকসংশ্লেষণ', 'প্রস্বেদন', 'অভিস্রবণ'],
        correctIndex: 1,
        explanation: 'সূর্যালোক ও ক্লোরোফিলের উপস্থিতিতে সালোকসংশ্লেষণ প্রক্রিয়ায় খাদ্য তৈরি হয়।',
      },
      {
        question: '"সিংহাসন" শব্দটি কোন সমাস?',
        options: ['দ্বন্দ্ব', 'মধ্যপদলোপী কর্মধারয়', 'বহুব্রীহি', 'অব্যয়ীভাব'],
        correctIndex: 1,
        explanation: 'সিংহ চিহ্নিত আসন = সিংহাসন (মধ্যপদলোপী কর্মধারয় সমাস)।',
      },
      {
        question: 'বাংলা বর্ণমালায় মোট স্বরবর্ণ কয়টি?',
        options: ['৯টি', '১০টি', '১১টি', '১২টি'],
        correctIndex: 2,
        explanation: 'বাংলা বর্ণমালায় মোট ১১টি স্বরবর্ণ এবং ৩৯টি ব্যঞ্জনবর্ণ আছে।',
      },
      {
        question: 'Choose the correct sentence:',
        options: [
          'He go to school daily.',
          'He goes to school daily.',
          'He going to school daily.',
          'He gone to school daily.',
        ],
        correctIndex: 1,
        explanation: 'Present Indefinite Tense-এ Subject (He) 3rd person singular হলে verb-এর সাথে s/es যুক্ত হয়।',
      },
      {
        question: 'বাংলাদেশের প্রথম অস্থায়ী সরকার (মুজিবনগর সরকার) কবে গঠিত হয়?',
        options: ['২৬ মার্চ ১৯৭১', '১০ এপ্রিল ১৯৭১', '১৭ এপ্রিল ১৯৭১', '১৬ ডিসেম্বর ১৯৭১'],
        correctIndex: 1,
        explanation: '১৯৭১ সালের ১০ এপ্রিল মুজিবনগর সরকার গঠিত হয় এবং ১৭ এপ্রিল শপথ গ্রহণ করে।',
      },
    ],
  },
  {
    id: 'hsc',
    titleBn: 'HSC পূর্ণাঙ্গ মডেল টেস্ট (১০টি MCQ)',
    subtitleBn: 'উচ্চতর গণিত, পদার্থ, রসায়ন, জীববিজ্ঞান ও ICT — সময়: ১০ মিনিট',
    durationSec: 600,
    questions: [
      {
        question: 'd/dx (sin x) = নিচের কোনটি?',
        options: ['-sin x', 'cos x', '-cos x', 'tan x'],
        correctIndex: 1,
        explanation: 'sin x-এর অন্তরজ (derivative) হলো cos x।',
      },
      {
        question: 'বাইনারি (1101)₂-এর দশমিক মান কত?',
        options: ['১১', '১২', '১৩', '১৫'],
        correctIndex: 2,
        explanation: '1×8 + 1×4 + 0×2 + 1×1 = 8 + 4 + 0 + 1 = 13।',
      },
      {
        question: 'সবচেয়ে ছোট একক কোষীয় অঙ্গাণু যেটি প্রোটিন সংশ্লেষ করে—',
        options: ['মাইটোকন্ড্রিয়া', 'রাইবোজোম', 'লাইসোজোম', 'গলগি বডি'],
        correctIndex: 1,
        explanation: 'রাইবোজোম কোষের প্রোটিন ফ্যাক্টরি হিসেবে কাজ করে।',
      },
      {
        question: 'ভেক্টর A ও B পরস্পর লম্ব হলে তাদের ডট গুণফল (A·B) কত হবে?',
        options: ['AB', '১', '০', '-AB'],
        correctIndex: 2,
        explanation: 'A·B = AB cos 90° = 0।',
      },
      {
        question: 'পর্যায় সারণির ১৮ নং গ্রুপের মৌলগুলোকে কী বলা হয়?',
        options: ['ক্ষার ধাতু', 'হ্যালোজেন', 'নিষ্ক্রিয় গ্যাস', 'অবস্থান্তর ধাতু'],
        correctIndex: 2,
        explanation: 'গ্রুপ ১৮-তে থাকা He, Ne, Ar ইত্যাদি হলো নিষ্ক্রিয় গ্যাস।',
      },
      {
        question: 'HTML-এ সবচেয়ে বড় হেডিং ট্যাগ কোনটি?',
        options: ['<h6>', '<head>', '<h1>', '<header>'],
        correctIndex: 2,
        explanation: '<h1> থেকে <h6>-এর মধ্যে <h1> হলো সবচেয়ে বড় হেডিং ট্যাগ।',
      },
      {
        question: 'একটি ২×২ একক ম্যাট্রিক্স (Identity Matrix)-এর নির্ণায়কের মান কত?',
        options: ['০', '১', '২', '-১'],
        correctIndex: 1,
        explanation: 'যেকোনো একক ম্যাট্রিক্সের নির্ণায়কের মান সবসময় ১।',
      },
      {
        question: 'কার্বনিল মূলক (>C=O) কোন জৈব যৌগে উপস্থিত থাকে?',
        options: ['অ্যালকেন', 'অ্যালকোহল', 'অ্যালডিহাইড ও কিটোন', 'ইথার'],
        correctIndex: 2,
        explanation: 'অ্যালডিহাইড (-CHO) ও কিটোন (>C=O) উভয়েই কার্বনিল মূলক থাকে।',
      },
      {
        question: 'রক্তের কোন কণিকা রোগ প্রতিরোধে প্রধান ভূমিকা রাখে?',
        options: ['লোহিত রক্তকণিকা', 'শ্বেত রক্তকণিকা', 'অণুচক্রিকা', 'প্লাজমা'],
        correctIndex: 1,
        explanation: 'শ্বেত রক্তকণিকা (WBC) জীবাণু ধ্বংস করে শরীরকে সুরক্ষা দেয়।',
      },
      {
        question: 'বুলিয়ান অ্যালজেব্রায় A + 1 = কত?',
        options: ['0', 'A', '1', 'Ā'],
        correctIndex: 2,
        explanation: 'বুলিয়ান অ্যালজেব্রায় OR অপারেশনে কোনো চলকের সাথে ১ যোগ করলে ফলাফল সবসময় ১ হয়।',
      },
    ],
  },
  {
    id: 'ict_general',
    titleBn: 'ICT ও সাধারণ জ্ঞান মডেল টেস্ট (১০টি MCQ)',
    subtitleBn: 'ভর্তি ও বোর্ড প্রস্তুতি: ICT, বাংলা ও সাধারণ জ্ঞান — সময়: ১০ মিনিট',
    durationSec: 600,
    questions: [
      {
        question: '১ বাইট (Byte) সমান কত বিট (Bit)?',
        options: ['৪ বিট', '৮ বিট', '১৬ বিট', '৩২ বিট'],
        correctIndex: 1,
        explanation: '৮টি বিট নিয়ে ১ বাইট গঠিত হয়।',
      },
      {
        question: 'হেক্সাডেসিমেল সংখ্যা পদ্ধতিতে মোট কয়টি প্রতীক আছে?',
        options: ['৮টি', '১০টি', '১৬টি', '৩২টি'],
        correctIndex: 2,
        explanation: '০ থেকে ৯ এবং A থেকে F পর্যন্ত মোট ১৬টি প্রতীক ব্যবহৃত হয়।',
      },
      {
        question: 'HTTP-এর পূর্ণরূপ কী?',
        options: [
          'Hyper Text Transfer Protocol',
          'High Text Transfer Process',
          'Hyperlink Text Tool Protocol',
          'Home Tool Transfer Protocol',
        ],
        correctIndex: 0,
        explanation: 'HTTP অর্থ Hyper Text Transfer Protocol।',
      },
      {
        question: 'কোন ডিভাইস নেটওয়ার্কের ডাটা প্যাকেটকে সঠিক গন্তব্যে পৌঁছে দেয়?',
        options: ['হাব', 'রাউটার', 'মডেম', 'রিপিটার'],
        correctIndex: 1,
        explanation: 'রাউটার (Router) আইপি ঠিকানা দেখে সবচেয়ে ভালো পথে ডাটা প্যাকেট পাঠায়।',
      },
      {
        question: 'বাংলাদেশের জাতীয় স্মৃতিসৌধের স্থপতি কে?',
        options: ['হামিদুর রহমান', 'মাইনুল হোসেন', 'নিতুন কুণ্ডু', 'কামরুল হাসান'],
        correctIndex: 1,
        explanation: 'সাভারের জাতীয় স্মৃতিসৌধের স্থপতি সৈয়দ মাইনুল হোসেন।',
      },
      {
        question: 'কম্পিউটারের অস্থায়ী মেমোরি (Volatile Memory) কোনটি?',
        options: ['ROM', 'RAM', 'Hard Disk', 'SSD'],
        correctIndex: 1,
        explanation: 'বিদ্যুৎ চলে গেলে RAM-এর ডেটা মুছে যায়, তাই এটি অস্থায়ী মেমোরি।',
      },
      {
        question: '"একুশে ফেব্রুয়ারি" আন্তর্জাতিক মাতৃভাষা দিবস হিসেবে স্বীকৃতি পায় কত সালে?',
        options: ['১৯৭১ সালে', '১৯৯৯ সালে', '২০০১ সালে', '১৯৫২ সালে'],
        correctIndex: 1,
        explanation: '১৯৯৯ সালের ১৭ নভেম্বর ইউনেস্কো ২১ ফেব্রুয়ারিকে আন্তর্জাতিক মাতৃভাষা দিবস ঘোষণা করে।',
      },
      {
        question: 'কোন লজিক গেটের সব ইনপুট ১ হলে কেবল আউটপুট ১ হয়?',
        options: ['OR গেট', 'AND গেট', 'NOT গেট', 'NOR গেট'],
        correctIndex: 1,
        explanation: 'AND গেটের গুণন নিয়ম অনুযায়ী সব ইনপুট ১ হলেই কেবল আউটপুট ১ পাওয়া যায়।',
      },
      {
        question: 'বিশ্বের দীর্ঘতম প্রাকৃতিক সমুদ্রসৈকত কোথায় অবস্থিত?',
        options: ['কুয়াকাটা', 'কক্সবাজার', 'সেন্টমার্টিন', 'পতেঙ্গা'],
        correctIndex: 1,
        explanation: 'বাংলাদেশের কক্সবাজার বিশ্বের দীর্ঘতম প্রাকৃতিক সমুদ্রসৈকত।',
      },
      {
        question: 'C প্রোগ্রামিং ভাষার জনক কে?',
        options: ['টিম বার্নার্স লি', 'ডেনিস রিচি', 'চার্লস ব্যাবেজ', 'অ্যাডা লাভলেস'],
        correctIndex: 1,
        explanation: 'ডেনিস রিচি ১৯৭২ সালে বেল ল্যাবরেটরিতে C প্রোগ্রামিং ভাষা উদ্ভাবন করেন।',
      },
    ],
  },
];

function formatTimerBn(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const StudyToolsPage: React.FC<StudyToolsPageProps> = ({
  isOnline,
  activeModel,
  availableModels,
  onSwitchModel,
  onBusyChange,
  onResultSuccess,
}) => {
  const [activeTool, setActiveTool] = useState<StudyToolTab>('photo_math');

  // Common AI execution state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [retryAfterSec, setRetryAfterSec] = useState<number | undefined>(undefined);
  const [answer, setAnswer] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  // Tool 1: Photo Math Solver
  const [mathPrompt, setMathPrompt] = useState('');
  const [mathPreview, setMathPreview] = useState<string | null>(null);
  const [mathBase64, setMathBase64] = useState<string | undefined>(undefined);
  const [mathMime, setMathMime] = useState<string | undefined>(undefined);

  // Tool 2: SSC / HSC Suggestion
  const [sugLevel, setSugLevel] = useState<'SSC' | 'HSC'>('SSC');
  const [sugSubject, setSugSubject] = useState('গণিত (সাধারণ ও উচ্চতর)');
  const [sugChapter, setSugChapter] = useState('');

  // Tool 3: Model Test (10 MCQ + Timer + Marks)
  const [testSetId, setTestSetId] = useState<'ssc' | 'hsc' | 'ict_general'>('ssc');
  const [testStarted, setTestStarted] = useState(false);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [timeLeftSec, setTimeLeftSec] = useState(600);
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({});

  // Tool 4: Note Maker + PDF Download
  const [noteTitle, setNoteTitle] = useState('নিউটনের গতির সূত্র ও সহজ ব্যাখ্যা');
  const [noteTopic, setNoteTopic] = useState('');
  const [noteContent, setNoteContent] = useState(
    '১ম সূত্র (জড়তার সূত্র): বাইরে থেকে বল প্রয়োগ না করলে স্থির বস্তু চিরকাল স্থির থাকবে এবং গতিশীল বস্তু সমবেগে চলতে থাকবে।\n\n২য় সূত্র (F = ma): বস্তুর ভরবেগের পরিবর্তনের হার প্রযুক্ত বলের সমানুপাতিক।\n\n৩য় সূত্র: প্রত্যেক ক্রিয়ারই একটি সমান ও বিপরীত প্রতিক্রিয়া আছে।'
  );
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  // Tool 5: Voice Question
  const [voiceText, setVoiceText] = useState('');

  // Tool 6: Simple Bengali Explainer
  const [hardText, setHardText] = useState('');

  const activeTestSet =
    MODEL_TEST_SETS.find((s) => s.id === testSetId) ?? MODEL_TEST_SETS[0];

  // Countdown timer for Model Test
  useEffect(() => {
    if (!testStarted || testSubmitted) return;
    const id = window.setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          setTestSubmitted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [testStarted, testSubmitted]);

  const handleSelectTool = (next: StudyToolTab) => {
    setActiveTool(next);
    setError(null);
    setErrorCode(undefined);
  };

  const runEducationAi = async (params: {
    subject: string;
    level: string;
    question: string;
    imageBase64?: string;
    imageMimeType?: string;
    onFinalAnswer?: (text: string) => void;
  }) => {
    if (inFlightRef.current) return;
    if (!isOnline) {
      setError('এই মুহূর্তে ইন্টারনেট সংযোগ নেই। অনুগ্রহ করে ইন্টারনেট চালু করে আবার চেষ্টা করুন।');
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
          subject: params.subject,
          level: params.level,
          question: params.question,
          imageBase64: params.imageBase64,
          imageMimeType: params.imageMimeType,
          responseLanguage: 'bn',
          modelId: activeModel,
        },
        {
          onDelta: (chunk) => setAnswer((prev) => (prev ?? '') + chunk),
          onDone: (data) => {
            setAnswer(data.answer);
            params.onFinalAnswer?.(data.answer);
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

  const handleMathFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setMathPreview(dataUrl);
      const [meta, base64] = dataUrl.split(',');
      const mimeMatch = meta.match(/data:(.*);base64/);
      setMathMime(mimeMatch ? mimeMatch[1] : file.type);
      setMathBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleStartTest = () => {
    setMcqAnswers({});
    setTimeLeftSec(activeTestSet.durationSec);
    setTestSubmitted(false);
    setTestStarted(true);
  };

  const handleSwitchTestSet = (nextId: 'ssc' | 'hsc' | 'ict_general') => {
    setTestSetId(nextId);
    setTestStarted(false);
    setTestSubmitted(false);
    setMcqAnswers({});
    setTimeLeftSec(600);
  };

  const score = activeTestSet.questions.reduce(
    (sum, q, idx) => sum + (mcqAnswers[idx] === q.correctIndex ? 1 : 0),
    0
  );
  const answeredCount = Object.keys(mcqAnswers).length;

  const handleDownloadPdf = async () => {
    if (!noteContent.trim()) {
      setError('PDF ডাউনলোড করার আগে নোট লিখুন বা AI দিয়ে তৈরি করুন।');
      return;
    }
    setPdfDownloading(true);
    setPdfNotice(null);
    try {
      await downloadStudyNotePdf({
        title: noteTitle.trim() || 'Sathi AI BD নোট',
        bodyText: noteContent,
        fileName: noteTitle.trim() || 'sathi-study-note',
      });
      setPdfNotice('আপনার নোটটি PDF আকারে ডাউনলোড হয়েছে!');
      window.setTimeout(() => setPdfNotice(null), 3500);
    } catch {
      setError('PDF ডাউনলোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setPdfDownloading(false);
    }
  };

  const toolItems: {
    id: StudyToolTab;
    num: string;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'photo_math', num: '১', label: 'ছবি তুলে অংক সমাধান', icon: Calculator },
    { id: 'suggestions', num: '২', label: 'SSC / HSC সাজেশন', icon: Lightbulb },
    { id: 'model_test', num: '৩', label: 'মডেল টেস্ট (১০ MCQ)', icon: ClipboardCheck },
    { id: 'note_maker', num: '৪', label: 'নোট মেকার + PDF', icon: FileText },
    { id: 'voice_question', num: '৫', label: 'ভয়েস প্রশ্ন (মাইক)', icon: Mic },
    { id: 'simple_bangla', num: '৬', label: 'সহজ বাংলায় বোঝানো', icon: BookOpenCheck },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-violet-800 via-blue-900 to-slate-900 text-white p-5 sm:p-6 space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-violet-200">
          <Sparkles className="w-4 h-4" />
          <span>সম্পূর্ণ আলাদা স্টাডি টুলস</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold">পড়াশোনা টুলস (৬টি স্মার্ট টুলস)</h1>
        <p className="text-xs sm:text-sm text-blue-100 leading-relaxed max-w-2xl">
          ছবি তুলে অংক সমাধান, SSC/HSC সাজেশন, টাইমারসহ ১০টি MCQ মডেল টেস্ট, নোট মেকার + PDF ডাউনলোড, ভয়েস প্রশ্ন ও সহজ বাংলায় বোঝানো।
        </p>
      </div>

      {/* 6 Tool Selector Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {toolItems.map((item) => {
          const Icon = item.icon;
          const active = activeTool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTool(item.id)}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 min-h-[88px] ${
                active
                  ? 'bg-blue-700 text-white border-blue-700 shadow-md'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-blue-700 dark:text-blue-400'}`} />
                <span
                  className={`text-[11px] font-bold ${
                    active ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {item.num}
                </span>
              </div>
              <span className="text-xs font-bold leading-snug">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* TOOL 1: Photo Math Solver */}
      {activeTool === 'photo_math' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              ১. ছবি তুলে অংক সমাধান
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              খাতা বা বইয়ের অংকের ছবি তুলে দিন অথবা অংকটি লিখে দিন — ধাপে ধাপে সহজ বাংলায় সমাধান পাবেন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 min-h-[46px] rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold transition-colors">
              <Camera className="w-4 h-4" />
              <span>ক্যামেরা দিয়ে ছবি তুলুন</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleMathFile}
                className="hidden"
              />
            </label>

            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 min-h-[46px] rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ImagePlus className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>গ্যালারি থেকে অংকের ছবি</span>
              <input type="file" accept="image/*" onChange={handleMathFile} className="hidden" />
            </label>

            {mathPreview && (
              <div className="flex items-center gap-2">
                <img
                  src={mathPreview}
                  alt="অংকের ছবি"
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    setMathPreview(null);
                    setMathBase64(undefined);
                    setMathMime(undefined);
                  }}
                  aria-label="ছবি সরান"
                  className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <textarea
            rows={3}
            value={mathPrompt}
            onChange={(e) => setMathPrompt(e.target.value)}
            placeholder="প্রয়োজনে অংকটি বা কোন লাইন বুঝতে পারছেন না লিখুন (ঐচ্ছিক যদি ছবি দিয়ে থাকেন)..."
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
          />

          <div className="flex justify-end">
            <button
              type="button"
              disabled={loading || (!mathBase64 && !mathPrompt.trim())}
              onClick={() =>
                void runEducationAi({
                  subject: 'ছবি তুলে অংক সমাধান',
                  level: 'SSC / HSC গণিত',
                  question:
                    mathPrompt.trim() ||
                    'ছবিতে থাকা অংকটি খুব সহজ বাংলায় একদম প্রথম লাইন থেকে ধাপে ধাপে সমাধান করে উত্তর বের করে দাও।',
                  imageBase64: mathBase64,
                  imageMimeType: mathMime,
                })
              }
              className="min-h-[44px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              <span>{loading ? 'সমাধান হচ্ছে...' : 'অংক সমাধান করুন'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TOOL 2: SSC / HSC Suggestions */}
      {activeTool === 'suggestions' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              ২. SSC / HSC সাজেশন
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              পরীক্ষার শ্রেণি ও বিষয় নির্বাচন করে কমন উপযোগী বোর্ড সাজেশন পান।
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">পরীক্ষা নির্বাচন</label>
              <select
                value={sugLevel}
                onChange={(e) => setSugLevel(e.target.value as 'SSC' | 'HSC')}
                className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              >
                <option value="SSC">SSC (নবম–দশম)</option>
                <option value="HSC">HSC (একাদশ–দ্বাদশ)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">বিষয়</label>
              <select
                value={sugSubject}
                onChange={(e) => setSugSubject(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              >
                <option value="গণিত (সাধারণ ও উচ্চতর)">গণিত (সাধারণ ও উচ্চতর)</option>
                <option value="পদার্থবিজ্ঞান">পদার্থবিজ্ঞান</option>
                <option value="রসায়ন">রসায়ন</option>
                <option value="জীববিজ্ঞান">জীববিজ্ঞান</option>
                <option value="ইংরেজি ১ম ও ২য় পত্র">ইংরেজি ১ম ও ২য় পত্র</option>
                <option value="বাংলা ১ম ও ২য় পত্র">বাংলা ১ম ও ২য় পত্র</option>
                <option value="তথ্য ও যোগাযোগ প্রযুক্তি (ICT)">তথ্য ও যোগাযোগ প্রযুক্তি (ICT)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">নির্দিষ্ট অধ্যায় (ঐচ্ছিক)</label>
              <input
                type="text"
                value={sugChapter}
                onChange={(e) => setSugChapter(e.target.value)}
                placeholder="যেমন: ত্রিকোণমিতি / জৈব রসায়ন"
                className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void runEducationAi({
                subject: `${sugLevel} সাজেশন — ${sugSubject}`,
                level: sugLevel,
                question: `${sugLevel} বোর্ড পরীক্ষার "${sugSubject}"${
                  sugChapter.trim() ? ` (${sugChapter.trim()} অধ্যায়)` : ''
                } বিষয়ের জন্য ১০০% গুরুত্বপূর্ণ অধ্যায়, সৃজনশীল টপিক এবং বাছাই করা সংক্ষিপ্ত সাজেশন সহজ বাংলায় তৈরি করে দাও।`,
              })
            }
            className="min-h-[44px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
            <span>{loading ? 'সাজেশন তৈরি হচ্ছে...' : `${sugLevel} সাজেশন দেখুন`}</span>
          </button>
        </div>
      )}

      {/* TOOL 3: Model Test (10 MCQ + Timer + Marks) */}
      {activeTool === 'model_test' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                ৩. মডেল টেস্ট — ১০টি MCQ + টাইমার + মার্কস
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ১০ মিনিটের লাইভ টাইমার দিয়ে পরীক্ষা দিন এবং সাথে সাথে মোট নম্বর (Marks) ও ব্যাখ্যা দেখুন।
              </p>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
              <Clock className={`w-4 h-4 ${timeLeftSec <= 60 && testStarted && !testSubmitted ? 'text-rose-600 animate-pulse' : 'text-blue-700 dark:text-blue-400'}`} />
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                {formatTimerBn(timeLeftSec)}
              </span>
            </div>
          </div>

          {/* Test Selector Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {MODEL_TEST_SETS.map((set) => {
              const active = set.id === testSetId;
              return (
                <button
                  key={set.id}
                  type="button"
                  onClick={() => handleSwitchTestSet(set.id)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    active
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-500'
                  }`}
                >
                  <p className="text-xs font-bold">{set.titleBn}</p>
                  <p className={`text-[11px] mt-0.5 ${active ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                    {set.subtitleBn}
                  </p>
                </button>
              );
            })}
          </div>

          {!testStarted ? (
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-3">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {activeTestSet.titleBn}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                মোট প্রশ্ন: ১০টি MCQ · মোট নম্বর: ১০ · সময়: ১০:০০ মিনিট
              </p>
              <button
                type="button"
                onClick={handleStartTest}
                className="min-h-[46px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm"
              >
                <Play className="w-4 h-4" />
                <span>মডেল টেস্ট শুরু করুন</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {testSubmitted && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex flex-wrap items-center justify-between gap-4 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                      <Trophy className="w-6 h-6 text-amber-300" />
                    </div>
                    <div>
                      <p className="text-xs text-emerald-100 font-semibold">মডেল টেস্টের ফলাফল (Marks)</p>
                      <h3 className="text-xl font-bold">
                        আপনার নম্বর: {score} / {activeTestSet.questions.length} ({Math.round((score / activeTestSet.questions.length) * 100)}%)
                      </h3>
                      <p className="text-xs text-emerald-100">
                        বাকি সময় ছিল: {formatTimerBn(timeLeftSec)} · সঠিক: {score}টি, ভুল/বাদ: {activeTestSet.questions.length - score}টি
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartTest}
                    className="min-h-[42px] px-4 rounded-xl bg-white text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>আবার পরীক্ষা দিন</span>
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {activeTestSet.questions.map((q, qIdx) => {
                  const chosen = mcqAnswers[qIdx];
                  return (
                    <div
                      key={qIdx}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
                    >
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        প্রশ্ন {qIdx + 1}: {q.question}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => {
                          const selected = chosen === oIdx;
                          const isCorrect = q.correctIndex === oIdx;
                          let cls =
                            'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';
                          if (testSubmitted) {
                            if (isCorrect) {
                              cls =
                                'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold';
                            } else if (selected) {
                              cls =
                                'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-900 dark:text-rose-200';
                            }
                          } else if (selected) {
                            cls =
                              'bg-blue-700 border-blue-700 text-white font-semibold';
                          }

                          return (
                            <button
                              key={oIdx}
                              type="button"
                              disabled={testSubmitted}
                              onClick={() =>
                                setMcqAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))
                              }
                              className={`min-h-[42px] px-3 py-2 rounded-xl border text-left text-xs transition-colors flex items-center justify-between gap-2 ${cls}`}
                            >
                              <span>{opt}</span>
                              {testSubmitted && isCorrect && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                              {testSubmitted && selected && !isCorrect && (
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {testSubmitted && (
                        <p className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="font-bold text-blue-700 dark:text-blue-400">ব্যাখ্যা: </span>
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {!testSubmitted && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    উত্তর দিয়েছেন: {answeredCount} / {activeTestSet.questions.length} টি
                  </span>
                  <button
                    type="button"
                    onClick={() => setTestSubmitted(true)}
                    className="min-h-[46px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold inline-flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>পরীক্ষা জমা দিন ও মার্কস দেখুন</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TOOL 4: Note Maker + PDF Download */}
      {activeTool === 'note_maker' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              ৪. নোট মেকার + PDF ডাউনলোড
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              যেকোনো অধ্যায়ের নোট AI দিয়ে তৈরি করুন বা নিজে এডিট করে এক ক্লিকে সুন্দর বাংলা PDF ডাউনলোড করুন।
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={noteTopic}
              onChange={(e) => setNoteTopic(e.target.value)}
              placeholder="কোন বিষয়ে নোট বানাতে চান? (যেমন: সালোকসংশ্লেষণ / Tense-এর সহজ নিয়ম)"
              className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            />
            <button
              type="button"
              disabled={loading || !noteTopic.trim()}
              onClick={() => {
                const topic = noteTopic.trim();
                setNoteTitle(topic);
                void runEducationAi({
                  subject: 'নোট মেকার',
                  level: 'সহজ বাংলা নোট',
                  question: `"${topic}" বিষয়ের ওপর পরীক্ষার জন্য চমৎকার, পয়েন্ট আকারে গুছানো সহজ বাংলা নোট (সংজ্ঞা, মূল পয়েন্ট ও উদাহরণসহ) তৈরি করে দাও।`,
                  onFinalAnswer: (generated) => setNoteContent(generated),
                });
              }}
              className="min-h-[44px] px-5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{loading ? 'নোট তৈরি হচ্ছে...' : 'AI দিয়ে নোট বানান'}</span>
            </button>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold mb-1">নোটের শিরোনাম (PDF Title)</label>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">নোটের মূল লেখা (ইচ্ছামতো এডিট করতে পারবেন)</label>
              <textarea
                rows={7}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm leading-relaxed"
              />
            </div>

            {pdfNotice && (
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {pdfNotice}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={pdfDownloading || !noteContent.trim()}
                onClick={handleDownloadPdf}
                className="min-h-[46px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm"
              >
                {pdfDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{pdfDownloading ? 'PDF তৈরি হচ্ছে...' : 'PDF ডাউনলোড করুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOOL 5: Voice Question (Mic Button) */}
      {activeTool === 'voice_question' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              ৫. ভয়েস প্রশ্ন — মাইক বাটন
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              মাইক বাটনে চাপ দিয়ে বাংলায় বা ইংরেজিতে মুখে প্রশ্ন বলুন, কথা টেক্সট হয়ে গেলে উত্তর নিন (চাইলে উত্তর শুনতেও পারবেন)।
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center gap-3">
            <VoiceInputButton
              language="bn"
              onTranscript={(spoken) =>
                setVoiceText((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken))
              }
              onError={(err) => setError(typeof err === 'string' ? err : err.message)}
              disabled={loading || !isOnline}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              মাইক বাটনে চাপ দিয়ে আপনার প্রশ্নটি পরিষ্কারভাবে বলুন
            </p>
          </div>

          <textarea
            rows={3}
            value={voiceText}
            onChange={(e) => setVoiceText(e.target.value)}
            placeholder="আপনার বলা প্রশ্ন এখানে দেখাবে (প্রয়োজনে এডিটও করতে পারবেন)..."
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
          />

          <div className="flex justify-end">
            <button
              type="button"
              disabled={loading || !voiceText.trim()}
              onClick={() =>
                void runEducationAi({
                  subject: 'ভয়েস প্রশ্ন',
                  level: 'পড়াশোনা টুলস',
                  question: voiceText.trim(),
                })
              }
              className="min-h-[44px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{loading ? 'উত্তর তৈরি হচ্ছে...' : 'প্রশ্নের উত্তর নিন'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TOOL 6: Easy Bengali Explainer */}
      {activeTool === 'simple_bangla' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              ৬. সহজ বাংলায় বোঝানো
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              বইয়ের যেকোনো কঠিন প্যারাগ্রাফ, ইংরেজি অনুচ্ছেদ বা বিজ্ঞানের সূত্র এখানে লিখুন বা পেস্ট করুন — বন্ধুর মতো সহজ বাংলায় উদাহরণসহ বুঝিয়ে দেবো।
            </p>
          </div>

          <textarea
            rows={4}
            value={hardText}
            onChange={(e) => setHardText(e.target.value)}
            placeholder="যেকোনো কঠিন পড়া বা ইংরেজি লাইন এখানে লিখুন (যেমন: ওহমের সূত্র কী এবং এটি কীভাবে কাজ করে?)"
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {[
                'সালোকসংশ্লেষণ প্রক্রিয়া সহজ বাংলায় বুঝিয়ে দাও',
                'ব্যাংকিং ও চক্রবৃদ্ধি সুদের নিয়ম উদাহরণসহ বুঝিয়ে দাও',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setHardText(sample)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                >
                  {sample}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={loading || !hardText.trim()}
              onClick={() =>
                void runEducationAi({
                  subject: 'সহজ বাংলায় বোঝানো',
                  level: 'সহজ ব্যাখ্যা',
                  question: `নিচের বিষয়টি একদম সহজ-সরল বাংলায় (কঠিন শব্দ এড়িয়ে বাস্তব জীবনের উদাহরণ দিয়ে ধাপে ধাপে) বুঝিয়ে দাও:\n\n${hardText.trim()}`,
                })
              }
              className="min-h-[44px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpenCheck className="w-4 h-4" />}
              <span>{loading ? 'বোঝানো হচ্ছে...' : 'সহজ বাংলায় বুঝুন'}</span>
            </button>
          </div>
        </div>
      )}

      <AiErrorBanner
        error={error}
        errorCode={errorCode}
        retryAfterSec={retryAfterSec}
        retrying={loading}
        activeModel={activeModel}
        availableModels={availableModels}
        onSwitchModel={onSwitchModel}
      />

      {loading && !answer && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-blue-700 dark:text-blue-400 shrink-0" />
          <span>সহজ বাংলায় উত্তর তৈরি হচ্ছে...</span>
        </div>
      )}

      {Boolean(answer) && answer && activeTool !== 'model_test' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              সহজ বাংলায় উত্তর
            </h3>
            <VoiceOutputButton text={answer} language="bn" compact />
          </div>
          <RichAnswer content={answer} isStreaming={loading} language="bn" />
        </div>
      )}
    </div>
  );
};
