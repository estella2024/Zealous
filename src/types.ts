export interface Card {
  id: string;
  number: number;
  image?: string; // base64 or URL
  text: string;
  quote?: string;
}

export type MusicState = 'playing' | 'paused' | 'muted';
