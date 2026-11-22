/**
 * Converts standard Quranic Latin transliteration (e.g. from en.transliteration)
 * into readable, natural Bengali pronunciation script.
 */

const EXACT_WORD_MAP: Record<string, string> = {
  bismillaahir: 'বিসমিল্লাহির',
  bismillahir: 'বিসমিল্লাহির',
  bismillaahi: 'বিসমিল্লাহি',
  rahmaanir: 'রাহমানির',
  rahmanir: 'রাহমানির',
  raheem: 'রাহীম',
  rahim: 'রাহীম',
  raheemi: 'রাহীমি',
  alhamdu: 'আলহামদু',
  lillaahi: 'লিল্লাহি',
  lillahi: 'লিল্লাহি',
  allaahu: 'আল্লাহু',
  allahu: 'আল্লাহু',
  allaaha: 'আল্লাহা',
  allaha: 'আল্লাহা',
  allaahi: 'আল্লাহি',
  allahi: 'আল্লাহি',
  allaah: 'আল্লাহ',
  allah: 'আল্লাহ',
  rabbil: 'রাব্বিল',
  rabbi: 'রাব্বি',
  rabbuka: 'রাব্বুকা',
  rabbukum: 'রাব্বুকুম',
  rabbuhum: 'রাব্বুহুম',
  aalameen: 'আলামীন',
  alameen: 'আলামীন',
  maaliki: 'মালিকি',
  maliki: 'মালিকি',
  yawmid: 'ইয়াওমিদ',
  yawmi: 'ইয়াওমি',
  deen: 'দীন',
  iyyaaka: 'ইয়্যাকা',
  iyyaka: 'ইয়্যাকা',
  lyyaaka: 'ইয়্যাকা',
  nabudu: 'নাবুদু',
  "na'budu": 'নাবুদু',
  nastaeen: 'নাসতাঈন',
  'nasta-een': 'নাসতাঈন',
  ihdinas: 'ইহদিনাস',
  siraatal: 'সিরাতাল',
  siratal: 'সিরাতাল',
  mustaqeem: 'মুস্তাকীম',
  anamta: 'আনআমতা',
  anamtu: 'আনআমতু',
  ghairil: 'গাইরিল',
  ghayril: 'গাইরিল',
  maghdoobi: 'মাগদূবি',
  magdoobi: 'মাগদূবি',
  lad: 'লাদ',
  daaalleen: 'দাল্লীন',
  daalleen: 'দাল্লীন',
  lazeena: 'লাযীনা',
  lazina: 'লাযীনা',
  qul: 'কুল',
  huwal: 'হুওয়াল',
  huwa: 'হুওয়া',
  ahad: 'আহাদ',
  ahadun: 'আহাদুন',
  samad: 'সামাদ',
  lam: 'লাম',
  yalid: 'ইয়ালিদ',
  yoolad: 'ইউলাদ',
  yakul: 'ইয়াকুল',
  yakun: 'ইয়াকুন',
  lahu: 'লাহু',
  lahoo: 'লাহু',
  kufuwan: 'কুফুওয়ান',
  inna: 'ইন্না',
  innaa: 'ইন্না',
  wa: 'ওয়া',
  fee: 'ফী',
  fi: 'ফী',
  min: 'মিন',
  ilaa: 'ইলা',
  ila: 'ইলা',
  alaa: 'আলা',
  ala: 'আলা',
  alaihims: 'আলাইহিম',
  alaihim: 'আলাইহিম',
  allazeena: 'আল্লাযীনা',
  allazina: 'আল্লাযীনা',
  allazee: 'আল্লাযী',
  naas: 'নাস',
  naasi: 'নাসি',
  muhammad: 'মুহাম্মাদ',
  quran: 'কুরআন',
  quraan: 'কুরআন',
  subhaana: 'সুবহানা',
  subhanallaahi: 'সুবহানাল্লাহি',
  alhamdulillah: 'আলহামদুলিল্লাহ',
};

const CONSONANTS: [string, string][] = [
  ['sh', 'শ'],
  ['kh', 'খ'],
  ['gh', 'গ'],
  ['th', 'ছ'],
  ['dh', 'য'],
  ['zh', 'য'],
  ['ch', 'চ'],
  ['ph', 'ফ'],
  ['q', 'ক'],
  ['k', 'ক'],
  ['g', 'গ'],
  ['j', 'জ'],
  ['t', 'ত'],
  ['d', 'দ'],
  ['n', 'ন'],
  ['p', 'প'],
  ['f', 'ফ'],
  ['b', 'ব'],
  ['m', 'ম'],
  ['y', 'ইয়'],
  ['r', 'র'],
  ['l', 'ল'],
  ['w', 'ওয়'],
  ['v', 'ভ'],
  ['s', 'স'],
  ['z', 'য'],
  ['h', 'হ'],
];

const VOWEL_KAR: Record<string, string> = {
  aa: 'া',
  a: '',
  ee: 'ী',
  ii: 'ী',
  i: 'ি',
  oo: 'ূ',
  uu: 'ূ',
  u: 'ু',
  ai: 'াই',
  au: 'াউ',
  aw: 'াও',
  ay: 'ায়',
  ei: 'েই',
  e: 'ে',
  o: 'ো',
};

const VOWEL_INDEP: Record<string, string> = {
  aa: 'আ',
  a: 'আ',
  ee: 'ঈ',
  ii: 'ঈ',
  i: 'ই',
  oo: 'ঊ',
  uu: 'ঊ',
  u: 'উ',
  ai: 'আই',
  au: 'আউ',
  aw: 'আও',
  ay: 'আয়',
  ei: 'এই',
  e: 'এ',
  o: 'ও',
};

function convertWordToBengali(rawWord: string): string {
  const cleaned = rawWord
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/ā/g, 'aa')
    .replace(/ī/g, 'ee')
    .replace(/ū/g, 'oo')
    .replace(/[ṣ]/g, 's')
    .replace(/[ḍ]/g, 'd')
    .replace(/[ṭ]/g, 't')
    .replace(/[ẓ]/g, 'z')
    .replace(/[ḥ]/g, 'h')
    .replace(/[^a-z-]/g, '');

  if (!cleaned) return '';

  if (EXACT_WORD_MAP[cleaned]) {
    return EXACT_WORD_MAP[cleaned];
  }

  // Handle hyphenated subwords recursively
  if (cleaned.includes('-')) {
    return cleaned
      .split('-')
      .map((part) => convertWordToBengali(part))
      .filter(Boolean)
      .join('-');
  }

  let out = '';
  let i = 0;
  let lastWasConsonant = false;

  while (i < cleaned.length) {
    // Try consonant match first
    let matchedCons: [string, string] | null = null;
    for (const pair of CONSONANTS) {
      if (cleaned.startsWith(pair[0], i)) {
        matchedCons = pair;
        break;
      }
    }

    if (matchedCons) {
      // Doubled consonant (shaddah), e.g., "ll", "mm", "rr", "ss", "nn"
      const [key, bnCons] = matchedCons;
      // Avoid ugly য্‌য; keep clear simple doubled consonants
      if (
        key.length === 1 &&
        i + 1 < cleaned.length &&
        cleaned[i + 1] === key &&
        key !== 'w' &&
        key !== 'y' &&
        key !== 'h'
      ) {
        out += `${bnCons}্${bnCons}`;
        i += 2;
        lastWasConsonant = true;
        continue;
      }

      // Special smoothing for "y" at word-start or after vowel: "ya" -> "ইয়া", "yu" -> "ইউ", "yi" -> "ইয়ি"
      if (key === 'y') {
        const nextTwo = cleaned.slice(i + 1, i + 3);
        const nextOne = cleaned.slice(i + 1, i + 2);
        if (nextTwo === 'oo' || nextTwo === 'uu') {
          out += lastWasConsonant ? '্যু' : 'ইউ';
          i += 3;
          lastWasConsonant = false;
          continue;
        }
        if (nextOne === 'u') {
          out += lastWasConsonant ? '্যু' : 'ইউ';
          i += 2;
          lastWasConsonant = false;
          continue;
        }
        if (nextTwo === 'aa') {
          out += lastWasConsonant ? '্যা' : 'ইয়া';
          i += 3;
          lastWasConsonant = false;
          continue;
        }
        if (nextOne === 'a') {
          out += lastWasConsonant ? '্যা' : 'ইয়া';
          i += 2;
          lastWasConsonant = false;
          continue;
        }
      }

      if (key === 'w') {
        const nextTwo = cleaned.slice(i + 1, i + 3);
        const nextOne = cleaned.slice(i + 1, i + 2);
        if (nextTwo === 'aa') {
          out += 'ওয়া';
          i += 3;
          lastWasConsonant = false;
          continue;
        }
        if (nextOne === 'a') {
          out += 'ওয়া';
          i += 2;
          lastWasConsonant = false;
          continue;
        }
        if (nextTwo === 'ee' || nextOne === 'i') {
          out += nextTwo === 'ee' ? 'উই' : 'উই';
          i += nextTwo === 'ee' ? 3 : 2;
          lastWasConsonant = false;
          continue;
        }
        if (nextTwo === 'oo' || nextOne === 'u') {
          out += 'উ';
          i += nextTwo === 'oo' ? 3 : 2;
          lastWasConsonant = false;
          continue;
        }
        out += 'ও';
        i += 1;
        lastWasConsonant = false;
        continue;
      }

      out += bnCons;
      i += key.length;
      lastWasConsonant = true;
      continue;
    }

    // Try 2-letter vowel first, then 1-letter vowel
    const two = cleaned.slice(i, i + 2);
    const one = cleaned.slice(i, i + 1);
    const vowelKey = VOWEL_KAR[two] !== undefined ? two : VOWEL_KAR[one] !== undefined ? one : '';

    if (vowelKey) {
      if (lastWasConsonant) {
        out += VOWEL_KAR[vowelKey];
      } else {
        out += VOWEL_INDEP[vowelKey];
      }
      i += vowelKey.length;
      lastWasConsonant = false;
      continue;
    }

    i += 1;
    lastWasConsonant = false;
  }

  return out;
}

export function transliterateQuranToBengali(transliterationText: string): string {
  if (!transliterationText || !transliterationText.trim()) return '';
  return transliterationText
    .split(/\s+/)
    .map((token) => convertWordToBengali(token))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
