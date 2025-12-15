import { Language } from './types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
];

export const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';

// Instructions to set the persona
export const getSystemInstruction = (sourceLang: string, targetLang: string) => `
You are a professional, real-time simultaneous interpreter. 
Your task is to translate spoken audio between ${sourceLang} and ${targetLang}.
1. If you hear ${sourceLang}, translate it to ${targetLang}.
2. If you hear ${targetLang}, translate it to ${sourceLang}.
3. Keep the translation concise and natural.
4. Do not add pleasantries or conversational filler unless they were in the original audio.
5. If the input is unclear, ask for clarification briefly in the target language.
`;
