
export enum AppView {
  IMAGE_EDITOR = 'IMAGE_EDITOR',
  TEXT_TO_SPEECH = 'TEXT_TO_SPEECH',
  CHAT = 'CHAT'
}

export interface GeneratedImage {
  url: string;
  prompt: string;
}

export interface VoiceConfig {
  name: string;
  id: string;
  gender: 'Male' | 'Female';
}

export enum ImageSize {
  S_1K = "1K",
  S_2K = "2K",
  S_4K = "4K"
}

export enum AspectRatio {
  SQUARE = "1:1",
  PORTRAIT = "9:16",
  LANDSCAPE = "16:9",
  WIDE = "21:9",
  STANDARD = "4:3",
  STANDARD_PORTRAIT = "3:4",
  PHOTO = "3:2",
  PHOTO_PORTRAIT = "2:3"
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  images?: string[]; // base64
  videos?: string[]; // base64 or url
  isThinking?: boolean;
}
