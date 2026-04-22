export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatProviderKind = "groq" | "glm";

export type ChatOptions = {
  model: string;
  temperature?: number;
  messages: ChatMessage[];
};

export type ChatUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

export type ChatResult = {
  content: string;
  usage?: ChatUsage | null;
};

export type ChatProvider = {
  kind: ChatProviderKind;
  chat: (args: ChatOptions) => Promise<ChatResult>;
};
