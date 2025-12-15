export interface Language {
  code: string;
  name: string;
  flag: string; // Emoji flag
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface AudioConfig {
  inputSampleRate: number;
  outputSampleRate: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
