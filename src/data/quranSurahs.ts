export interface QuranSurahMeta {
  number: number;
  nameAr: string;
  nameBn: string;
  nameEn: string;
  meaningBn: string;
  ayahCount: number;
  revelationBn: 'মক্কী' | 'মাদানী';
}

export interface QuranAyahItem {
  numberInSurah: number;
  globalNumber?: number;
  audioUrl?: string;
  arabic: string;
  transliterationEn: string;
  pronunciationBn: string;
  meaningBn: string;
}

export interface QuranSurahData {
  surah: QuranSurahMeta;
  ayahs: QuranAyahItem[];
}

export const QURAN_SURAHS: QuranSurahMeta[] = [
  { number: 1, nameAr: 'الفاتحة', nameBn: 'আল-ফাতিহা', nameEn: 'Al-Fatihah', meaningBn: 'সূচনা', ayahCount: 7, revelationBn: 'মক্কী' },
  { number: 2, nameAr: 'البقرة', nameBn: 'আল-বাকারা', nameEn: 'Al-Baqarah', meaningBn: 'বকনা-বাছুর', ayahCount: 286, revelationBn: 'মাদানী' },
  { number: 3, nameAr: 'آل عمران', nameBn: 'আলে-ইমরান', nameEn: 'Ali Imran', meaningBn: 'ইমরানের পরিবার', ayahCount: 200, revelationBn: 'মাদানী' },
  { number: 4, nameAr: 'النساء', nameBn: 'আন-নিসা', nameEn: 'An-Nisa', meaningBn: 'নারী', ayahCount: 176, revelationBn: 'মাদানী' },
  { number: 5, nameAr: 'المائدة', nameBn: 'আল-মায়িদাহ', nameEn: 'Al-Maidah', meaningBn: 'খাদ্য পরিবেশিত টেবিল', ayahCount: 120, revelationBn: 'মাদানী' },
  { number: 6, nameAr: 'الأنعام', nameBn: 'আল-আনআম', nameEn: 'Al-Anam', meaningBn: 'গৃহপালিত পশু', ayahCount: 165, revelationBn: 'মক্কী' },
  { number: 7, nameAr: 'الأعراف', nameBn: 'আল-আরাফ', nameEn: 'Al-Araf', meaningBn: 'উঁচু স্থান', ayahCount: 206, revelationBn: 'মক্কী' },
  { number: 8, nameAr: 'الأنفال', nameBn: 'আল-আনফাল', nameEn: 'Al-Anfal', meaningBn: 'যুদ্ধলব্ধ সম্পদ', ayahCount: 75, revelationBn: 'মাদানী' },
  { number: 9, nameAr: 'التوبة', nameBn: 'আত-তাওবাহ', nameEn: 'At-Tawbah', meaningBn: 'তাওবা বা ক্ষমা প্রার্থনা', ayahCount: 129, revelationBn: 'মাদানী' },
  { number: 10, nameAr: 'يونس', nameBn: 'ইউনুস', nameEn: 'Yunus', meaningBn: 'নবী ইউনুস (আ.)', ayahCount: 109, revelationBn: 'মক্কী' },
  { number: 11, nameAr: 'هود', nameBn: 'হুদ', nameEn: 'Hud', meaningBn: 'নবী হুদ (আ.)', ayahCount: 123, revelationBn: 'মক্কী' },
  { number: 12, nameAr: 'يوسف', nameBn: 'ইউসুফ', nameEn: 'Yusuf', meaningBn: 'নবী ইউসুফ (আ.)', ayahCount: 111, revelationBn: 'মক্কী' },
  { number: 13, nameAr: 'الرعد', nameBn: 'আর-রাদ', nameEn: 'Ar-Rad', meaningBn: 'বজ্রনাদ', ayahCount: 43, revelationBn: 'মাদানী' },
  { number: 14, nameAr: 'ابراهيم', nameBn: 'ইবরাহীম', nameEn: 'Ibrahim', meaningBn: 'নবী ইবরাহীম (আ.)', ayahCount: 52, revelationBn: 'মক্কী' },
  { number: 15, nameAr: 'الحجر', nameBn: 'আল-হিজর', nameEn: 'Al-Hijr', meaningBn: 'পাথুরে উপত্যকা', ayahCount: 99, revelationBn: 'মক্কী' },
  { number: 16, nameAr: 'النحل', nameBn: 'আন-নাহল', nameEn: 'An-Nahl', meaningBn: 'মৌমাছি', ayahCount: 128, revelationBn: 'মক্কী' },
  { number: 17, nameAr: 'الإسراء', nameBn: 'বনী ইসরাঈল / আল-ইসরা', nameEn: 'Al-Isra', meaningBn: 'নৈশ ভ্রমণ', ayahCount: 111, revelationBn: 'মক্কী' },
  { number: 18, nameAr: 'الكهف', nameBn: 'আল-কাহফ', nameEn: 'Al-Kahf', meaningBn: 'গুহা', ayahCount: 110, revelationBn: 'মক্কী' },
  { number: 19, nameAr: 'مريم', nameBn: 'মারইয়াম', nameEn: 'Maryam', meaningBn: 'মারইয়াম (আ.)', ayahCount: 98, revelationBn: 'মক্কী' },
  { number: 20, nameAr: 'طه', nameBn: 'ত্বা-হা', nameEn: 'Taha', meaningBn: 'ত্বা-হা', ayahCount: 135, revelationBn: 'মক্কী' },
  { number: 21, nameAr: 'الأنبياء', nameBn: 'আল-আম্বিয়া', nameEn: 'Al-Anbya', meaningBn: 'নবীগণ', ayahCount: 112, revelationBn: 'মক্কী' },
  { number: 22, nameAr: 'الحج', nameBn: 'আল-হজ্জ', nameEn: 'Al-Hajj', meaningBn: 'হজ্জ', ayahCount: 78, revelationBn: 'মাদানী' },
  { number: 23, nameAr: 'المؤمنون', nameBn: 'আল-মুমিনূন', nameEn: 'Al-Muminun', meaningBn: 'মুমিনগণ', ayahCount: 118, revelationBn: 'মক্কী' },
  { number: 24, nameAr: 'النور', nameBn: 'আন-নূর', nameEn: 'An-Nur', meaningBn: 'আলো', ayahCount: 64, revelationBn: 'মাদানী' },
  { number: 25, nameAr: 'الفرقان', nameBn: 'আল-ফুরকান', nameEn: 'Al-Furqan', meaningBn: 'সত্য-মিথ্যার পার্থক্যকারী', ayahCount: 77, revelationBn: 'মক্কী' },
  { number: 26, nameAr: 'الشعراء', nameBn: 'আশ-শুআরা', nameEn: 'Ash-Shuara', meaningBn: 'কবিগণ', ayahCount: 227, revelationBn: 'মক্কী' },
  { number: 27, nameAr: 'النمل', nameBn: 'আন-নামল', nameEn: 'An-Naml', meaningBn: 'পিপীলিকা', ayahCount: 93, revelationBn: 'মক্কী' },
  { number: 28, nameAr: 'القصص', nameBn: 'আল-কাসাস', nameEn: 'Al-Qasas', meaningBn: 'কাহিনীসমূহ', ayahCount: 88, revelationBn: 'মক্কী' },
  { number: 29, nameAr: 'العنكبوت', nameBn: 'আল-আনকাবূত', nameEn: 'Al-Ankabut', meaningBn: 'মাকড়সা', ayahCount: 69, revelationBn: 'মক্কী' },
  { number: 30, nameAr: 'الروم', nameBn: 'আর-রূম', nameEn: 'Ar-Rum', meaningBn: 'রোমান জাতি', ayahCount: 60, revelationBn: 'মক্কী' },
  { number: 31, nameAr: 'لقمان', nameBn: 'লুকমান', nameEn: 'Luqman', meaningBn: 'হযরত লুকমান (আ.)', ayahCount: 34, revelationBn: 'মক্কী' },
  { number: 32, nameAr: 'السجدة', nameBn: 'আস-সাজদাহ', nameEn: 'As-Sajdah', meaningBn: 'সিজদা', ayahCount: 30, revelationBn: 'মক্কী' },
  { number: 33, nameAr: 'الأحزاب', nameBn: 'আল-আহযাব', nameEn: 'Al-Ahzab', meaningBn: 'সম্মিলিত বাহিনী', ayahCount: 73, revelationBn: 'মাদানী' },
  { number: 34, nameAr: 'سبإ', nameBn: 'সাবা', nameEn: 'Saba', meaningBn: 'সাবা সম্প্রদায়', ayahCount: 54, revelationBn: 'মক্কী' },
  { number: 35, nameAr: 'فاطر', nameBn: 'ফাতির', nameEn: 'Fatir', meaningBn: 'সৃষ্টিকর্তা', ayahCount: 45, revelationBn: 'মক্কী' },
  { number: 36, nameAr: 'يس', nameBn: 'ইয়াসীন', nameEn: 'Ya-Sin', meaningBn: 'ইয়া-সীন', ayahCount: 83, revelationBn: 'মক্কী' },
  { number: 37, nameAr: 'الصافات', nameBn: 'আস-সাফফাত', nameEn: 'As-Saffat', meaningBn: 'সারিবদ্ধভাবে দণ্ডায়মান', ayahCount: 182, revelationBn: 'মক্কী' },
  { number: 38, nameAr: 'ص', nameBn: 'সোয়াদ', nameEn: 'Sad', meaningBn: 'সোয়াদ', ayahCount: 88, revelationBn: 'মক্কী' },
  { number: 39, nameAr: 'الزمر', nameBn: 'আয-যুমার', nameEn: 'Az-Zumar', meaningBn: 'দলবদ্ধ জনতা', ayahCount: 75, revelationBn: 'মক্কী' },
  { number: 40, nameAr: 'غافر', nameBn: 'গাফির / আল-মুমিন', nameEn: 'Ghafir', meaningBn: 'ক্ষমাকারী', ayahCount: 85, revelationBn: 'মক্কী' },
  { number: 41, nameAr: 'فصلت', nameBn: 'হা-মীম সাজদাহ / ফুসসিলাত', nameEn: 'Fussilat', meaningBn: 'সুস্পষ্ট বর্ণনা', ayahCount: 54, revelationBn: 'মক্কী' },
  { number: 42, nameAr: 'الشورى', nameBn: 'আশ-শূরা', nameEn: 'Ash-Shuraa', meaningBn: 'পরামর্শ', ayahCount: 53, revelationBn: 'মক্কী' },
  { number: 43, nameAr: 'الزخرف', nameBn: 'আয-যুখরুফ', nameEn: 'Az-Zukhruf', meaningBn: 'স্বর্ণালংকার', ayahCount: 89, revelationBn: 'মক্কী' },
  { number: 44, nameAr: 'الدخان', nameBn: 'আদ-দুখান', nameEn: 'Ad-Dukhan', meaningBn: 'ধোঁয়া', ayahCount: 59, revelationBn: 'মক্কী' },
  { number: 45, nameAr: 'الجاثية', nameBn: 'আল-জাসিয়াহ', nameEn: 'Al-Jathiyah', meaningBn: 'নতজানু', ayahCount: 37, revelationBn: 'মক্কী' },
  { number: 46, nameAr: 'الأحقاف', nameBn: 'আল-আহকাফ', nameEn: 'Al-Ahqaf', meaningBn: 'বালুর পাহাড়', ayahCount: 35, revelationBn: 'মক্কী' },
  { number: 47, nameAr: 'محمد', nameBn: 'মুহাম্মাদ', nameEn: 'Muhammad', meaningBn: 'নবী মুহাম্মাদ (সা.)', ayahCount: 38, revelationBn: 'মাদানী' },
  { number: 48, nameAr: 'الفتح', nameBn: 'আল-ফাতহ', nameEn: 'Al-Fath', meaningBn: 'বিজয়', ayahCount: 29, revelationBn: 'মাদানী' },
  { number: 49, nameAr: 'الحجرات', nameBn: 'আল-হুজুরাত', nameEn: 'Al-Hujurat', meaningBn: 'বাসগৃহসমূহ', ayahCount: 18, revelationBn: 'মাদানী' },
  { number: 50, nameAr: 'ق', nameBn: 'ক্বাফ', nameEn: 'Qaf', meaningBn: 'ক্বাফ', ayahCount: 45, revelationBn: 'মক্কী' },
  { number: 51, nameAr: 'الذاريات', nameBn: 'আয-যারিয়াত', nameEn: 'Adh-Dhariyat', meaningBn: 'বিক্ষেপকারী বাতাস', ayahCount: 60, revelationBn: 'মক্কী' },
  { number: 52, nameAr: 'الطور', nameBn: 'আত-তূর', nameEn: 'At-Tur', meaningBn: 'তূর পাহাড়', ayahCount: 49, revelationBn: 'মক্কী' },
  { number: 53, nameAr: 'النجم', nameBn: 'আন-নাজম', nameEn: 'An-Najm', meaningBn: 'নক্ষত্র', ayahCount: 62, revelationBn: 'মক্কী' },
  { number: 54, nameAr: 'القمر', nameBn: 'আল-কামার', nameEn: 'Al-Qamar', meaningBn: 'চাঁদ', ayahCount: 55, revelationBn: 'মক্কী' },
  { number: 55, nameAr: 'الرحمن', nameBn: 'আর-রাহমান', nameEn: 'Ar-Rahman', meaningBn: 'পরম করুণাময়', ayahCount: 78, revelationBn: 'মাদানী' },
  { number: 56, nameAr: 'الواقعة', nameBn: 'আল-ওয়াকিয়াহ', nameEn: 'Al-Waqiah', meaningBn: 'অবশ্যম্ভাবী ঘটনা (কিয়ামত)', ayahCount: 96, revelationBn: 'মক্কী' },
  { number: 57, nameAr: 'الحديد', nameBn: 'আল-হাদীদ', nameEn: 'Al-Hadid', meaningBn: 'লোহা', ayahCount: 29, revelationBn: 'মাদানী' },
  { number: 58, nameAr: 'المجادلة', nameBn: 'আল-মুজাদালাহ', nameEn: 'Al-Mujadila', meaningBn: 'অনুযোগকারিণী', ayahCount: 22, revelationBn: 'মাদানী' },
  { number: 59, nameAr: 'الحشر', nameBn: 'আল-হাশর', nameEn: 'Al-Hashr', meaningBn: 'সমাবেশ', ayahCount: 24, revelationBn: 'মাদানী' },
  { number: 60, nameAr: 'الممتحنة', nameBn: 'আল-মুমতাহিনাহ', nameEn: 'Al-Mumtahanah', meaningBn: 'পরীক্ষিত নারী', ayahCount: 13, revelationBn: 'মাদানী' },
  { number: 61, nameAr: 'الصف', nameBn: 'আস-সাফ', nameEn: 'As-Saf', meaningBn: 'সারিবদ্ধ সৈন্যদল', ayahCount: 14, revelationBn: 'মাদানী' },
  { number: 62, nameAr: 'الجمعة', nameBn: 'আল-জুমুআহ', nameEn: 'Al-Jumuah', meaningBn: 'জুমুআর দিন', ayahCount: 11, revelationBn: 'মাদানী' },
  { number: 63, nameAr: 'المنافقون', nameBn: 'আল-মুনাফিকূন', nameEn: 'Al-Munafiqun', meaningBn: 'মুনাফিকগণ', ayahCount: 11, revelationBn: 'মাদানী' },
  { number: 64, nameAr: 'التغابن', nameBn: 'আত-তাগাবুন', nameEn: 'At-Taghabun', meaningBn: 'হার-জিত প্রকাশের দিন', ayahCount: 18, revelationBn: 'মাদানী' },
  { number: 65, nameAr: 'الطلاق', nameBn: 'আত-তালাক', nameEn: 'At-Talaq', meaningBn: 'তালাক', ayahCount: 12, revelationBn: 'মাদানী' },
  { number: 66, nameAr: 'التحريم', nameBn: 'আত-তাহরীম', nameEn: 'At-Tahrim', meaningBn: 'নিষিদ্ধকরণ', ayahCount: 12, revelationBn: 'মাদানী' },
  { number: 67, nameAr: 'الملك', nameBn: 'আল-মুলক', nameEn: 'Al-Mulk', meaningBn: 'সার্বভৌমত্ব / রাজত্ব', ayahCount: 30, revelationBn: 'মক্কী' },
  { number: 68, nameAr: 'القلم', nameBn: 'আল-কালাম', nameEn: 'Al-Qalam', meaningBn: 'কলম', ayahCount: 52, revelationBn: 'মক্কী' },
  { number: 69, nameAr: 'الحاقة', nameBn: 'আল-হাক্কাহ', nameEn: 'Al-Haqqah', meaningBn: 'নিশ্চিত সত্য', ayahCount: 52, revelationBn: 'মক্কী' },
  { number: 70, nameAr: 'المعارج', nameBn: 'আল-মাআরিজ', nameEn: 'Al-Maarij', meaningBn: 'উন্নয়নের সোপান', ayahCount: 44, revelationBn: 'মক্কী' },
  { number: 71, nameAr: 'نوح', nameBn: 'নূহ', nameEn: 'Nuh', meaningBn: 'নবী নূহ (আ.)', ayahCount: 28, revelationBn: 'মক্কী' },
  { number: 72, nameAr: 'الجن', nameBn: 'আল-জ্বিন', nameEn: 'Al-Jinn', meaningBn: 'জ্বিন জাতি', ayahCount: 28, revelationBn: 'মক্কী' },
  { number: 73, nameAr: 'المزمل', nameBn: 'আল-মুযযাম্মিল', nameEn: 'Al-Muzzammil', meaningBn: 'বস্ত্রাবৃত', ayahCount: 20, revelationBn: 'মক্কী' },
  { number: 74, nameAr: 'المدثر', nameBn: 'আল-মুদ্দাসসির', nameEn: 'Al-Muddaththir', meaningBn: 'পোশাক আবৃত', ayahCount: 56, revelationBn: 'মক্কী' },
  { number: 75, nameAr: 'القيامة', nameBn: 'আল-কিয়ামাহ', nameEn: 'Al-Qiyamah', meaningBn: 'পুনরুত্থান দিবস', ayahCount: 40, revelationBn: 'মক্কী' },
  { number: 76, nameAr: 'الانسان', nameBn: 'আদ-দাহর / আল-ইনসান', nameEn: 'Al-Insan', meaningBn: 'মানুষ', ayahCount: 31, revelationBn: 'মাদানী' },
  { number: 77, nameAr: 'المرسلات', nameBn: 'আল-মুরসালাত', nameEn: 'Al-Mursalat', meaningBn: 'প্রেরিত বায়ু', ayahCount: 50, revelationBn: 'মক্কী' },
  { number: 78, nameAr: 'النبإ', nameBn: 'আন-নাবা', nameEn: 'An-Naba', meaningBn: 'মহাসংবাদ', ayahCount: 40, revelationBn: 'মক্কী' },
  { number: 79, nameAr: 'النازعات', nameBn: 'আন-নাযিয়াত', nameEn: 'An-Naziat', meaningBn: 'প্রাণ হরণকারী', ayahCount: 46, revelationBn: 'মক্কী' },
  { number: 80, nameAr: 'عبس', nameBn: 'আবাসা', nameEn: 'Abasa', meaningBn: 'ভ্রূকুঞ্চিত করলেন', ayahCount: 42, revelationBn: 'মক্কী' },
  { number: 81, nameAr: 'التكوير', nameBn: 'আত-তাকভীর', nameEn: 'At-Takwir', meaningBn: 'আলো গুটিয়ে নেওয়া', ayahCount: 29, revelationBn: 'মক্কী' },
  { number: 82, nameAr: 'الإنفطار', nameBn: 'আল-ইনফিতার', nameEn: 'Al-Infitar', meaningBn: 'বিদীর্ণ হওয়া', ayahCount: 19, revelationBn: 'মক্কী' },
  { number: 83, nameAr: 'المطففين', nameBn: 'আল-মুতাফফিফীন', nameEn: 'Al-Mutaffifin', meaningBn: 'মাপে কম দানকারী', ayahCount: 36, revelationBn: 'মক্কী' },
  { number: 84, nameAr: 'الإنشقاق', nameBn: 'আল-ইনশিকাক', nameEn: 'Al-Inshiqaq', meaningBn: 'খণ্ড-বিখণ্ড হওয়া', ayahCount: 25, revelationBn: 'মক্কী' },
  { number: 85, nameAr: 'البروج', nameBn: 'আল-বুরূজ', nameEn: 'Al-Buruj', meaningBn: 'নক্ষত্রপুঞ্জ', ayahCount: 22, revelationBn: 'মক্কী' },
  { number: 86, nameAr: 'الطارق', nameBn: 'আত-তারিক', nameEn: 'At-Tariq', meaningBn: 'রাতের আগন্তুক তারা', ayahCount: 17, revelationBn: 'মক্কী' },
  { number: 87, nameAr: 'الأعلى', nameBn: 'আল-আলা', nameEn: 'Al-Ala', meaningBn: 'সর্বোচ্চ', ayahCount: 19, revelationBn: 'মক্কী' },
  { number: 88, nameAr: 'الغاشية', nameBn: 'আল-গাশিয়াহ', nameEn: 'Al-Ghashiyah', meaningBn: 'আচ্ছন্নকারী ঘটনা', ayahCount: 26, revelationBn: 'মক্কী' },
  { number: 89, nameAr: 'الفجر', nameBn: 'আল-ফজর', nameEn: 'Al-Fajr', meaningBn: 'ভোর / প্রভাত', ayahCount: 30, revelationBn: 'মক্কী' },
  { number: 90, nameAr: 'البلد', nameBn: 'আল-বালাদ', nameEn: 'Al-Balad', meaningBn: 'নগর', ayahCount: 20, revelationBn: 'মক্কী' },
  { number: 91, nameAr: 'الشمس', nameBn: 'আশ-শামস', nameEn: 'Ash-Shams', meaningBn: 'সূর্য', ayahCount: 15, revelationBn: 'মক্কী' },
  { number: 92, nameAr: 'الليل', nameBn: 'আল-লাইল', nameEn: 'Al-Layl', meaningBn: 'রাত্রি', ayahCount: 21, revelationBn: 'মক্কী' },
  { number: 93, nameAr: 'الضحى', nameBn: 'আদ-দুহা', nameEn: 'Ad-Duhaa', meaningBn: 'পূর্বাহ্ণ', ayahCount: 11, revelationBn: 'মক্কী' },
  { number: 94, nameAr: 'الشرح', nameBn: 'আল-ইনশিরাহ / আশ-শারহ', nameEn: 'Ash-Sharh', meaningBn: 'বক্ষ প্রশস্ত করা', ayahCount: 8, revelationBn: 'মক্কী' },
  { number: 95, nameAr: 'التين', nameBn: 'আত-তীন', nameEn: 'At-Tin', meaningBn: 'ডুমুর', ayahCount: 8, revelationBn: 'মক্কী' },
  { number: 96, nameAr: 'العلق', nameBn: 'আল-আলাক', nameEn: 'Al-Alaq', meaningBn: 'জমাট রক্ত', ayahCount: 19, revelationBn: 'মক্কী' },
  { number: 97, nameAr: 'القدر', nameBn: 'আল-কাদর', nameEn: 'Al-Qadr', meaningBn: 'মহিমান্বিত রজনী', ayahCount: 5, revelationBn: 'মক্কী' },
  { number: 98, nameAr: 'البينة', nameBn: 'আল-বায়্যিনাহ', nameEn: 'Al-Bayyinah', meaningBn: 'সুস্পষ্ট প্রমাণ', ayahCount: 8, revelationBn: 'মাদানী' },
  { number: 99, nameAr: 'الزلزلة', nameBn: 'আয-যিলযাল', nameEn: 'Az-Zalzalah', meaningBn: 'ভূমিকম্প', ayahCount: 8, revelationBn: 'মাদানী' },
  { number: 100, nameAr: 'العاديات', nameBn: 'আল-আদিয়াত', nameEn: 'Al-Adiyat', meaningBn: 'অভিযানকারী অশ্বদল', ayahCount: 11, revelationBn: 'মক্কী' },
  { number: 101, nameAr: 'القارعة', nameBn: 'আল-কারিআহ', nameEn: 'Al-Qariah', meaningBn: 'মহাপ্রলয়', ayahCount: 11, revelationBn: 'মক্কী' },
  { number: 102, nameAr: 'التكاثر', nameBn: 'আত-তাকাসুর', nameEn: 'At-Takathur', meaningBn: 'প্রাচুর্যের প্রতিযোগিতা', ayahCount: 8, revelationBn: 'মক্কী' },
  { number: 103, nameAr: 'العصر', nameBn: 'আল-আসর', nameEn: 'Al-Asr', meaningBn: 'সময় / অপরাহ্ণ', ayahCount: 3, revelationBn: 'মক্কী' },
  { number: 104, nameAr: 'الهمزة', nameBn: 'আল-হুমাযাহ', nameEn: 'Al-Humazah', meaningBn: 'পরনিন্দাকারী', ayahCount: 9, revelationBn: 'মক্কী' },
  { number: 105, nameAr: 'الفيل', nameBn: 'আল-ফীল', nameEn: 'Al-Fil', meaningBn: 'হাতি', ayahCount: 5, revelationBn: 'মক্কী' },
  { number: 106, nameAr: 'قريش', nameBn: 'কুরাইশ', nameEn: 'Quraysh', meaningBn: 'কুরাইশ গোত্র', ayahCount: 4, revelationBn: 'মক্কী' },
  { number: 107, nameAr: 'الماعون', nameBn: 'আল-মাউন', nameEn: 'Al-Maun', meaningBn: 'নিত্যপ্রয়োজনীয় সাহায্য', ayahCount: 7, revelationBn: 'মক্কী' },
  { number: 108, nameAr: 'الكوثر', nameBn: 'আল-কাওসার', nameEn: 'Al-Kawthar', meaningBn: 'প্রাচুর্য / হাউজে কাওসার', ayahCount: 3, revelationBn: 'মক্কী' },
  { number: 109, nameAr: 'الكافرون', nameBn: 'আল-কাফিরূন', nameEn: 'Al-Kafirun', meaningBn: 'অবিশ্বাসীগণ', ayahCount: 6, revelationBn: 'মক্কী' },
  { number: 110, nameAr: 'النصر', nameBn: 'আন-নাসর', nameEn: 'An-Nasr', meaningBn: 'সাহায্য', ayahCount: 3, revelationBn: 'মাদানী' },
  { number: 111, nameAr: 'المسد', nameBn: 'আল-লাহাব / আল-মাসাদ', nameEn: 'Al-Masad', meaningBn: 'পাকানো রশি', ayahCount: 5, revelationBn: 'মক্কী' },
  { number: 112, nameAr: 'الإخلاص', nameBn: 'আল-ইখলাস', nameEn: 'Al-Ikhlas', meaningBn: 'একনিষ্ঠতা', ayahCount: 4, revelationBn: 'মক্কী' },
  { number: 113, nameAr: 'الفلق', nameBn: 'আল-ফালাক', nameEn: 'Al-Falaq', meaningBn: 'ঊষা / প্রভাত', ayahCount: 5, revelationBn: 'মক্কী' },
  { number: 114, nameAr: 'الناس', nameBn: 'আন-নাস', nameEn: 'An-Nas', meaningBn: 'মানবজাতি', ayahCount: 6, revelationBn: 'মক্কী' },
];

export function getGlobalAyahNumber(surahNumber: number, numberInSurah: number): number {
  let offset = 0;
  for (const s of QURAN_SURAHS) {
    if (s.number >= surahNumber) break;
    offset += s.ayahCount;
  }
  return offset + numberInSurah;
}

export function getAyahAudioUrl(surahNumber: number, numberInSurah: number, explicitUrl?: string): string {
  if (explicitUrl) return explicitUrl;
  const globalNum = getGlobalAyahNumber(surahNumber, numberInSurah);
  return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalNum}.mp3`;
}

export const OFFLINE_FALLBACK_SURAHS: Record<number, QuranAyahItem[]> = {
  1: [
    {
      numberInSurah: 1,
      arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      transliterationEn: 'Bismillaahir Rahmaanir Raheem',
      pronunciationBn: 'বিসমিল্লাহির রাহমানির রাহীম',
      meaningBn: 'শুরু করছি আল্লাহর নামে যিনি পরম করুণাময়, অতি দয়ালু।',
    },
    {
      numberInSurah: 2,
      arabic: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
      transliterationEn: 'Alhamdu lillaahi Rabbil aalameen',
      pronunciationBn: 'আলহামদুলিল্লাহি রাব্বিল আলামীন',
      meaningBn: 'যাবতীয় প্রশংসা আল্লাহ তাআলার জন্য, যিনি সকল সৃষ্টি জগতের পালনকর্তা।',
    },
    {
      numberInSurah: 3,
      arabic: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      transliterationEn: 'Ar-Rahmaanir-Raheem',
      pronunciationBn: 'আর-রাহমানির রাহীম',
      meaningBn: 'যিনি পরম করুণাময়, অতি দয়ালু।',
    },
    {
      numberInSurah: 4,
      arabic: 'مَٰلِكِ يَوْمِ ٱلدِّينِ',
      transliterationEn: 'Maaliki Yawmid-Deen',
      pronunciationBn: 'মালিকি ইয়াওমিদ্দীন',
      meaningBn: 'যিনি বিচার দিনের মালিক।',
    },
    {
      numberInSurah: 5,
      arabic: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
      transliterationEn: 'Iyyaaka nabudu wa iyyaaka nasta-een',
      pronunciationBn: 'ইয়্যাকা নাবুদু ওয়া ইয়্যাকা নাসতাঈন',
      meaningBn: 'আমরা একমাত্র তোমারই ইবাদত করি এবং শুধু তোমারই সাহায্য প্রার্থনা করি।',
    },
    {
      numberInSurah: 6,
      arabic: 'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
      transliterationEn: 'Ihdinas-Siraatal Mustaqeem',
      pronunciationBn: 'ইহদিনাস সিরাতাল মুস্তাকীম',
      meaningBn: 'আমাদেরকে সরল-সঠিক পথ দেখাও।',
    },
    {
      numberInSurah: 7,
      arabic: 'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
      transliterationEn: 'Siraatal lazeena anamta alaihim ghairil maghdoobi alaihim wa lad-daaalleen',
      pronunciationBn: 'সিরাতাল্লাযীনা আনআমতা আলাইহিম গাইরিল মাগদূবি আলাইহিম ওয়ালাদ্দাল্লীন',
      meaningBn: 'সে সমস্ত লোকের পথ, যাদেরকে তুমি নেয়ামত দান করেছ। তাদের পথ নয়, যাদের প্রতি তোমার গযব নাযিল হয়েছে এবং যারা পথভ্রষ্ট হয়েছে।',
    },
  ],
  112: [
    {
      numberInSurah: 1,
      arabic: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
      transliterationEn: 'Qul huwal laahu ahad',
      pronunciationBn: 'কুল হুওয়াল্লাহু আহাদ',
      meaningBn: 'বলুন, তিনি আল্লাহ, এক ও অদ্বিতীয়।',
    },
    {
      numberInSurah: 2,
      arabic: 'ٱللَّهُ ٱلصَّمَدُ',
      transliterationEn: 'Allaa hus-samad',
      pronunciationBn: 'আল্লাহুস সামাদ',
      meaningBn: 'আল্লাহ অমুখাপেক্ষী (সকলে তাঁর মুখাপেক্ষী)।',
    },
    {
      numberInSurah: 3,
      arabic: 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
      transliterationEn: 'Lam yalid wa lam yoolad',
      pronunciationBn: 'লাম ইয়ালিদ ওয়া লাম ইউলাদ',
      meaningBn: 'তিনি কাউকে জন্ম দেননি এবং তাঁকেও জন্ম দেওয়া হয়নি।',
    },
    {
      numberInSurah: 4,
      arabic: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ',
      transliterationEn: 'Wa lam yakul-lahoo kufuwan ahad',
      pronunciationBn: 'ওয়া লাম ইয়াকুল্লাহু কুফুওয়ান আহাদ',
      meaningBn: 'এবং তাঁর সমতুল্য কেউ নেই।',
    },
  ],
  113: [
    {
      numberInSurah: 1,
      arabic: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
      transliterationEn: 'Qul aoozu bi rabbil-falaq',
      pronunciationBn: 'কুল আউযু বিরাব্বিল ফালাক',
      meaningBn: 'বলুন, আমি আশ্রয় গ্রহণ করছি প্রভাতের পালনকর্তার।',
    },
    {
      numberInSurah: 2,
      arabic: 'مِن شَرِّ مَا خَلَقَ',
      transliterationEn: 'Min sharri maa khalaq',
      pronunciationBn: 'মিন শাররি মা খালাক',
      meaningBn: 'তিনি যা সৃষ্টি করেছেন, তার অনিষ্ট থেকে।',
    },
    {
      numberInSurah: 3,
      arabic: 'وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ',
      transliterationEn: 'Wa min sharri ghaasiqin izaa waqab',
      pronunciationBn: 'ওয়া মিন শাররি গাসিকিন ইযা ওয়াকাব',
      meaningBn: 'অন্ধকার রাত্রির অনিষ্ট থেকে, যখন তা গভীর হয়।',
    },
    {
      numberInSurah: 4,
      arabic: 'وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ',
      transliterationEn: 'Wa min sharrin-naffaasaati fil uqad',
      pronunciationBn: 'ওয়া মিন শাররিন নাফফাসাতি ফিল উকাদ',
      meaningBn: 'গ্রন্থিতে ফুঁৎকার দিয়ে জাদুকারিণীদের অনিষ্ট থেকে।',
    },
    {
      numberInSurah: 5,
      arabic: 'وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
      transliterationEn: 'Wa min sharri haasidin izaa hasad',
      pronunciationBn: 'ওয়া মিন শাররি হাসিদিন ইযা হাসাদ',
      meaningBn: 'এবং হিংসুকের অনিষ্ট থেকে, যখন সে হিংসা করে।',
    },
  ],
  114: [
    {
      numberInSurah: 1,
      arabic: 'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ',
      transliterationEn: 'Qul aoozu bi rabbin-naas',
      pronunciationBn: 'কুল আউযু বিরাব্বিন নাস',
      meaningBn: 'বলুন, আমি আশ্রয় গ্রহণ করছি মানুষের পালনকর্তার।',
    },
    {
      numberInSurah: 2,
      arabic: 'مَلِكِ ٱلنَّاسِ',
      transliterationEn: 'Malikin-naas',
      pronunciationBn: 'মালিকিন নাস',
      meaningBn: 'মানুষের অধিপতির।',
    },
    {
      numberInSurah: 3,
      arabic: 'إِلَٰهِ ٱلنَّاسِ',
      transliterationEn: 'Ilaahin-naas',
      pronunciationBn: 'ইলাহিন নাস',
      meaningBn: 'মানুষের উপাস্যের।',
    },
    {
      numberInSurah: 4,
      arabic: 'مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ',
      transliterationEn: 'Min sharril waswaasil khannaas',
      pronunciationBn: 'মিন শাররিল ওয়াসওয়াসিল খান্নাস',
      meaningBn: 'আত্মগোপনকারী কুমন্ত্রণাদাতার অনিষ্ট থেকে।',
    },
    {
      numberInSurah: 5,
      arabic: 'ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ',
      transliterationEn: 'Allazee yuwaswisu fee sudoorin-naas',
      pronunciationBn: 'আল্লাযী ইউওয়াসউইসু ফী সুদূরিন নাস',
      meaningBn: 'যে কুমন্ত্রণা দেয় মানুষের অন্তরে।',
    },
    {
      numberInSurah: 6,
      arabic: 'مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ',
      transliterationEn: 'Minal jinnati wan-naas',
      pronunciationBn: 'মিনাল জিন্নাতি ওয়ান-নাস',
      meaningBn: 'জ্বিনের মধ্য থেকে এবং মানুষের মধ্য থেকে।',
    },
  ],
};
