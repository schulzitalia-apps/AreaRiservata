// src/server-utils/anima/memory.ts

export type MessageRole = 'user' | 'assistant';

export interface StoredMessage {
  role: MessageRole;
  content: string;
  timestamp: number;
}

const conversations = new Map<string, StoredMessage[]>();

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minuti
const MAX_MESSAGES = 10; // max messaggi per utente

/* --------------------------- MEMORIA CONVERSAZIONE -------------------------- */

export function addMessage(userId: string, role: MessageRole, content: string) {
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
  }

  const list = conversations.get(userId)!;
  const now = Date.now();

  list.push({ role, content, timestamp: now });
  prune(userId);
}

function prune(userId: string) {
  const list = conversations.get(userId);
  if (!list) return;

  const cutoff = Date.now() - MAX_AGE_MS;

  const filtered = list.filter((m) => m.timestamp >= cutoff);
  const sliced = filtered.slice(-MAX_MESSAGES);

  conversations.set(userId, sliced);
}

export function getRecentMessages(
  userId: string
): { role: MessageRole; content: string }[] {
  prune(userId);
  const list = conversations.get(userId) || [];
  return list.map(({ role, content }) => ({ role, content }));
}

/* ----------------------------- CONTESTO CLIENTE ----------------------------- */

export interface ClienteContext {
  id: string;
  label: string; // esempio: "Mario Rossi" o "Finestra Srl"

  email?: string | null;
  telefono?: string | null;

  indirizzo?: string | null;
  cap?: string | null;
  localita?: string | null;
}

interface BotContext {
  lastCliente?: ClienteContext;
}

const contexts = new Map<string, BotContext>();

export function setLastClienteContext(userId: string, cliente: ClienteContext) {
  const existing = contexts.get(userId) || {};
  contexts.set(userId, { ...existing, lastCliente: cliente });
}

export function getLastClienteContext(userId: string): ClienteContext | null {
  const ctx = contexts.get(userId);
  return ctx?.lastCliente ?? null;
}

export function resetConversation(userId: string) {
  conversations.delete(userId);
  contexts.delete(userId);
}
