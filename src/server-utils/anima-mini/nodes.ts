/**
 * nodes.ts
 * --------
 * Qui definiamo i “nodi” standard per la chat minimale:
 * 1) assistantNode: genera la risposta utente
 * 2) summarizeNode: aggiorna la memoria sintetica
 */

import type { Ctx, LlmNode } from "./types";

/**
 * Estrae il primo oggetto JSON trovato in una stringa.
 * Serve perché il modello a volte può aggiungere testo extra.
 * (Noi cerchiamo di imporgli "solo JSON", ma mettiamo una rete.)
 */
export function extractFirstJsonObject(text: string): string | null {
  const s = text.trim();
  const start = s.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

/**
 * Interpreta l’output del nodo summarize e prova a ottenere summary string.
 * Se parsing fallisce, ritorna null -> caller decide di non aggiornare memoria.
 */
export function parseSummaryFromModelOutput(raw: string): string | null {
  const jsonStr = extractFirstJsonObject(raw);
  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr);
    const summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
    return summary || null;
  } catch {
    return null;
  }
}

/**
 * Crea i nodi base.
 * Nota: li definiamo come funzioni per poterli parametrizzare in futuro (es. lingua).
 */
export function buildBasicNodes(): { assistantNode: LlmNode; summarizeNode: LlmNode } {
  /**
   * Prompt di sistema del nodo assistant.
   * - Gli diciamo: usa memorySummary come contesto.
   * - Rispondi breve e operativo.
   */
  const assistantSystem = `
Sei un assistente AI. Rispondi in italiano in modo chiaro e pratico.
Se è presente una memoria sintetica (memorySummary), usala come contesto.
Risposte brevi e operative. Se non hai memoria, invita l'utente a presentarsi
`.trim();

  /**
   * Prompt di sistema del nodo summarize.
   * - Aggiorna una stringa “summary” che conserva solo fatti utili.
   * - Output: SOLO JSON in una riga.
   */
  const summarizeSystem = `
Sei un sistema che aggiorna una MEMORIA SINTETICA di una conversazione.

Input: JSON con:
- prevSummary: string
- userMessage: string
- assistantMessage: string

Output: SOLO JSON su una riga:
{"summary":"..."}

Regole:
- max ~800 caratteri
- includi solo fatti utili, preferenze, decisioni, stati aperti
- non includere testo extra oltre al JSON
`.trim();

  const assistantNode: LlmNode = {
    id: "assistant",
    op: "llm",
    modelRef: "fast",

    system: assistantSystem,

    /**
     * buildUser(ctx)
     * -------------
     * Costruisce il contenuto “user” da passare al modello.
     * Invece di concatenare testo, usiamo JSON: più robusto e tracciabile.
     */
    buildUser: (ctx: Ctx) => ({
      memorySummary: ctx.memory.summary,      // contesto "compresso"
      userMessage: ctx.input.userMessage,     // richiesta attuale
      language: ctx.input.language,           // vincolo lingua
    }),

    /**
     * assign
     * ------
     * Dove scrivere il risultato nel ctx.
     * Per semplicità nella v1 scriviamo direttamente in ctx.outputs[assign].
     */
    assign: "reply",
  };

  const summarizeNode: LlmNode = {
    id: "summarize",
    op: "llm",
    modelRef: "fast",
    system: summarizeSystem,

    /**
     * Qui passiamo al modello:
     * - il summary precedente
     * - il messaggio utente
     * - la risposta appena generata
     * Il modello produce un nuovo summary “compresso”.
     */
    buildUser: (ctx: Ctx) => ({
      prevSummary: ctx.memory.summary,
      userMessage: ctx.input.userMessage,
      assistantMessage: String(ctx.outputs.reply ?? ""),
    }),

    /**
     * Salviamo il RAW output perché vogliamo poter fare debug.
     * Poi chatOnce lo parserà per ottenere summary.
     */
    assign: "newSummaryRaw",
  };

  return { assistantNode, summarizeNode };
}
