import React from 'react';
import { SUPPORTED_LANGUAGES } from '../constants';
import { Language } from '../types';

interface LanguageSelectorProps {
  label: string;
  selectedCode: string;
  onSelect: (code: string) => void;
  disabled?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  label, 
  selectedCode, 
  onSelect,
  disabled 
}) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select
          value={selectedCode}
          onChange={(e) => onSelect(e.target.value)}
          disabled={disabled}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {SUPPORTED_LANGUAGES.map((lang: Language) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;
