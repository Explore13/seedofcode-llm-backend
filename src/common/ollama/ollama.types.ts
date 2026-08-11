export interface ChatParams {
  model: string;
  messages: { role: string; content: string }[];
  options?: { temperature?: number; top_p?: number; num_ctx?: number };
  think?: boolean | 'low' | 'medium' | 'high' | 'max'; // optional — only meaningful for
  // models with the "thinking" capability
}

export interface NormalizedChatResult {
  content: string;
  thinking?: string;       // the reasoning trace, kept separate — only present when `think` was set
  // and the model actually supports it
  promptTokens: number;
  completionTokens: number; // NOTE: includes thinking-trace tokens, not just visible content —
  // worth surfacing this distinction wherever you display cost to users
  durationMs: number;
  modelUsed?: string;
}

export interface GenerateParams {
  model: string;
  prompt: string;
  options?: { temperature?: number; top_p?: number; num_ctx?: number };
  think?: boolean | 'low' | 'medium' | 'high' | 'max';
}

export interface NormalizedGenerateResult {
  content: string;
  thinking?: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  modelUsed?: string;
}