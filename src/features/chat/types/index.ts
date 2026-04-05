export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  streaming?: boolean;
  imageUrl?: string;
  isImageLoading?: boolean;
}

export interface ChatContext {
  inspectionSummary?: string;
  imageDescription?: string;
}
