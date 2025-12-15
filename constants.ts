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
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
];

export const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';

// Instructions to set the persona
export const getSystemInstruction = (sourceLang: string, targetLang: string) => `
You are a professional, real-time simultaneous interpreter. 
Your task is to translate spoken audio between ${sourceLang} and ${targetLang}.

**Core Responsibilities:**
1.  **Listen Active & Robustly:** The input audio may contain background noise, echoes, or strong accents. Use context to infer words that might be unclear. Prioritize the overall meaning.
2.  **Bidirectional Translation:** 
    -   If you hear ${sourceLang}, translate immediately to ${targetLang}.
    -   If you hear ${targetLang}, translate immediately to ${sourceLang}.
3.  **Output Style:**
    -   Provide the translation in natural, spoken audio.
    -   Do not add pleasantries, filler words, or conversational text (e.g., "Here is the translation", "Sure"). 
    -   Just speak the translated result directly.
    -   Maintain the original speaker's tone where possible.
4.  **Error Handling:** If the input is completely unintelligible due to noise, briefly ask for clarification in the target language.
`;
