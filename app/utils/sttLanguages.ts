// STT Language constants for Real-Time Speech-to-Text

export interface Language {
  code: string;
  name: string;
}

// Source languages (for transcription)
export const SOURCE_LANGUAGES: Language[] = [
  { code: 'ar-EG', name: 'Arabic (Egypt)' },
  { code: 'ar-JO', name: 'Arabic (Jordan)' },
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)' },
  { code: 'ar-AE', name: 'Arabic (UAE)' },
  { code: 'bn-IN', name: 'Bengali (India)' },
  { code: 'zh-CN', name: 'Chinese-Mandarin (Simplified)' },
  { code: 'zh-HK', name: 'Chinese (Hong Kong)' },
  { code: 'zh-TW', name: 'Chinese (Taiwan)' },
  { code: 'nl-NL', name: 'Dutch (Netherlands)' },
  { code: 'en-IN', name: 'English (India)' },
  { code: 'en-US', name: 'English (United States)' },
  { code: 'fil-PH', name: 'Filipino (Philippines)' },
  { code: 'fr-FR', name: 'French (France)' },
  { code: 'de-DE', name: 'German (Germany)' },
  { code: 'gu-IN', name: 'Gujarati (India)' },
  { code: 'he-IL', name: 'Hebrew (Israel)' },
  { code: 'hi-IN', name: 'Hindi (India)' },
  { code: 'id-ID', name: 'Indonesian (Indonesia)' },
  { code: 'it-IT', name: 'Italian (Italy)' },
  { code: 'ja-JP', name: 'Japanese (Japan)' },
  { code: 'kn-IN', name: 'Kannada (India)' },
  { code: 'ko-KR', name: 'Korean (South Korea)' },
  { code: 'ms-MY', name: 'Malay (Malaysia)' },
  { code: 'fa-IR', name: 'Persian (Iran)' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)' },
  { code: 'ru-RU', name: 'Russian (Russia)' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'ta-IN', name: 'Tamil (India)' },
  { code: 'te-IN', name: 'Telugu (India)' },
  { code: 'th-TH', name: 'Thai (Thailand)' },
  { code: 'tr-TR', name: 'Turkish (Turkey)' },
  { code: 'vi-VN', name: 'Vietnamese (Vietnam)' }
];

// Target languages (for translation)
export const TARGET_LANGUAGES: Language[] = [
  { code: 'ar-EG', name: 'Arabic (Egypt)' },
  { code: 'ar-JO', name: 'Arabic (Jordan)' },
  { code: 'ar-SA', name: 'Arabic (Saudi)' },
  { code: 'ar-AE', name: 'Arabic (UAE)' },
  { code: 'my-MM', name: 'Burmese (Myanmar)' },
  { code: 'zh-HK', name: 'Cantonese (Traditional)' },
  { code: 'zh-CN', name: 'Chinese-Mandarin (Simplified)' },
  { code: 'zh-TW', name: 'Chinese-Taiwan (Traditional)' },
  { code: 'cs-CZ', name: 'Czech (Czech Republic)' },
  { code: 'da-DK', name: 'Danish (Denmark)' },
  { code: 'nl-NL', name: 'Dutch (Netherlands)' },
  { code: 'en-AU', name: 'English (Australia)' },
  { code: 'en-CA', name: 'English (Canada)' },
  { code: 'en-GB', name: 'English (United Kingdom)' },
  { code: 'en-US', name: 'English (United States)' },
  { code: 'fi-FI', name: 'Finnish (Finland)' },
  { code: 'fr-CA', name: 'French (Canada)' },
  { code: 'fr-FR', name: 'French (France)' },
  { code: 'de-DE', name: 'German (Germany)' },
  { code: 'el-GR', name: 'Greek (Greece)' },
  { code: 'he-IL', name: 'Hebrew (Israel)' },
  { code: 'hi-IN', name: 'Hindi (India)' },
  { code: 'hu-HU', name: 'Hungarian (Hungary)' },
  { code: 'id-ID', name: 'Indonesian (Indonesia)' },
  { code: 'it-IT', name: 'Italian (Italy)' },
  { code: 'ja-JP', name: 'Japanese (Japan)' },
  { code: 'km-KH', name: 'Khmer (Cambodia)' },
  { code: 'ko-KR', name: 'Korean (Korea)' },
  { code: 'lo-LA', name: 'Lao (Laos)' },
  { code: 'ms-MY', name: 'Malay (Malaysia)' },
  { code: 'no-NO', name: 'Norwegian (Norway)' },
  { code: 'fa-IR', name: 'Persian (Iran)' },
  { code: 'pl-PL', name: 'Polish (Poland)' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)' },
  { code: 'ro-RO', name: 'Romanian (Romania)' },
  { code: 'ru-RU', name: 'Russian (Russia)' },
  { code: 'sk-SK', name: 'Slovak (Slovakia)' },
  { code: 'es-MX', name: 'Spanish (Mexico)' },
  { code: 'es-ES', name: 'Spanish (Spain)' },
  { code: 'sv-SE', name: 'Swedish (Sweden)' },
  { code: 'tl-PH', name: 'Tagalog (Philippines)' },
  { code: 'th-TH', name: 'Thai (Thailand)' },
  { code: 'tr-TR', name: 'Turkish (Turkey)' },
  { code: 'uk-UA', name: 'Ukrainian (Ukraine)' },
  { code: 'vi-VN', name: 'Vietnamese (Vietnam)' }
];

// Helper functions
export function getLanguageName(code: string, isSource: boolean = true): string {
  const languages = isSource ? SOURCE_LANGUAGES : TARGET_LANGUAGES;
  const lang = languages.find(l => l.code === code);
  return lang ? lang.name : code;
}

export function getLanguageByCode(code: string, isSource: boolean = true): Language | undefined {
  const languages = isSource ? SOURCE_LANGUAGES : TARGET_LANGUAGES;
  return languages.find(l => l.code === code);
}

