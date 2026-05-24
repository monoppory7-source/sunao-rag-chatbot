export type RetrievedChunk = {
  chunk_id: string;
  video_id: string;
  youtube_id: string;
  title: string;
  thumbnail_url: string | null;
  content: string;
  start_sec: number;
  published_at?: string;
  similarity: number;
  final_score?: number;
};

export type Source = {
  videoId: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  timestamp: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatResponse = {
  answer: string;
  sources: Source[];
  cached: boolean;
};
