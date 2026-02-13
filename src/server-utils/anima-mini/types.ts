/**
 * types.ts
 * --------
 * Qui mettiamo SOLO tipi e contratti. Niente logica.
 * Questo ti aiuta a “pensare” il sistema come componenti.
 */

/**
 * Il Context (ctx) è lo “zaino” che passa tra i nodi.
 * È lo stato del run: input, memoria, outputs intermedi e finali.
 */
export type Ctx = {
  /**
   * input: ciò che arriva dall'esterno per questa singola chiamata.
   * Esempio: userId, userMessage, lingua...
   */
  input: {
    userId: string;
    userMessage: string;
    language: "it" | "en";
  };

  /**
   * memory: contesto “persistito” tra i turni.
   * Nella v1 è solo una stringa sintetica (summary).
   */
  memory: {
    summary: string; // stringa sintetica della conversazione
  };

  /**
   * outputs: risultati prodotti dai nodi durante l'esecuzione.
   * Esempio: outputs.reply, outputs.newSummaryRaw, ecc.
   */
  outputs: Record<string, any>;
};

/**
 * Un evento è una riga di log strutturato.
 * Nella v1 li teniamo in memoria e li ritorniamo per debugging/UI.
 * In futuro li salvi in Mongo (runs + events).
 */
export type RunEvent =
  | { type: "run.started"; ts: number; userId: string }
  | { type: "node.started"; ts: number; nodeId: string }
  | { type: "llm.request"; ts: number; nodeId: string; modelRef: string }
  | { type: "llm.response"; ts: number; nodeId: string; modelRef: string; latencyMs: number }
  | { type: "node.completed"; ts: number; nodeId: string }
  | { type: "node.failed"; ts: number; nodeId: string; error: string }
  | { type: "run.completed"; ts: number; status: "success" | "failed" };

/**
 * Modelli: per ora 1 provider (Groq) + alias modelRef ("fast", "quality"...).
 * L'idea del "modelRef" è: UI/admin cambia mapping senza cambiare codice.
 */
export type ModelRegistry = Record<
  string, // modelRef (es. "fast")
  {
    provider: "groq";
    model: string; // nome modello reale (es. "llama-3.1-8b-instant")
    temperature?: number;
  }
>;

/**
 * Un nodo LLM: chiamata diretta al modello.
 * - id: nome del nodo dentro il workflow
 * - modelRef: alias verso un modello reale
 * - system: prompt di sistema (stringa)
 * - buildUser: funzione che costruisce il payload user partendo dal ctx
 * - assign: dove salvare l'output nel ctx.outputs
 */
export type LlmNode = {
  id: string;
  op: "llm";
  modelRef: string;
  system: string;
  buildUser: (ctx: Ctx) => any; // oggetto o stringa
  assign: string; // es: "reply" -> ctx.outputs["reply"]
};

/**
 * NodeDef: nella v1 supportiamo SOLO nodi LLM, quindi NodeDef === LlmNode.
 * (In futuro aggiungi op:"tool", ecc.)
 */
export type NodeDef = LlmNode;

/**
 * Interfaccia del provider LLM (qui: Groq).
 * Noi vogliamo astrarre: il runner chiama “llm.chat(...)” e basta.
 */
export type LlmProvider = {
  chat: (args: {
    model: string;
    temperature: number;
    messages: { role: "system" | "user" | "assistant"; content: string }[];
  }) => Promise<string>;
};

/**
 * Interfaccia per la memoria persistente.
 * In v1: in-memory Map.
 * In v2: Mongo. Importante: cambiano SOLO queste funzioni.
 */
export type MemoryStore = {
  loadSummary: (userId: string) => Promise<string>;
  saveSummary: (userId: string, summary: string) => Promise<void>;
};
