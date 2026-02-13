/**
 * runner.ts
 * ---------
 * Qui c'è il “motore” minimo:
 * - prende una lista di nodi (LLM)
 * - li esegue in sequenza
 * - salva output nel ctx
 * - produce events[] per debug/monitoraggio
 */

import type { Ctx, NodeDef, RunEvent, ModelRegistry, LlmProvider } from "./types";

/**
 * Converte un payload in stringa per il campo message.content.
 * - Se è già stringa: la usiamo
 * - Se è oggetto: JSON.stringify
 */
function toMessageContent(payload: any): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

/**
 * runNodes(...)
 * ------------
 * Esegue i nodi in ordine.
 *
 * INPUT:
 * - ctx: contesto iniziale (input + memory)
 * - nodes: sequenza di nodi
 * - models: registry (modelRef -> modello reale)
 * - llm: provider (Groq)
 *
 * OUTPUT:
 * - ctx aggiornato
 * - events: timeline della run
 */
export async function runNodes(args: {
  ctx: Ctx;
  nodes: NodeDef[];
  models: ModelRegistry;
  llm: LlmProvider;
}): Promise<{ ctx: Ctx; events: RunEvent[] }> {
  const { ctx, nodes, models, llm } = args;

  const events: RunEvent[] = [];
  const now = () => Date.now();

  // Evento start run
  events.push({ type: "run.started", ts: now(), userId: ctx.input.userId });

  // Ciclo sequenziale
  for (const node of nodes) {
    events.push({ type: "node.started", ts: now(), nodeId: node.id });

    try {
      // 1) risolvi il modello reale dal modelRef
      const modelInfo = models[node.modelRef];
      if (!modelInfo) {
        throw new Error(`MODEL_REF_NOT_FOUND:${node.modelRef}`);
      }

      // 2) costruisci i messaggi per l'LLM
      const userPayload = node.buildUser(ctx);
      const userContent = toMessageContent(userPayload);

      const messages = [
        { role: "system" as const, content: node.system },
        { role: "user" as const, content: userContent },
      ];

      // 3) emetti evento request
      const t0 = now();
      events.push({ type: "llm.request", ts: t0, nodeId: node.id, modelRef: node.modelRef });

      // 4) chiama LLM
      const content = await llm.chat({
        model: modelInfo.model,
        temperature: modelInfo.temperature ?? 0.2,
        messages,
      });

      // 5) emetti evento response (con latenza)
      const t1 = now();
      events.push({
        type: "llm.response",
        ts: t1,
        nodeId: node.id,
        modelRef: node.modelRef,
        latencyMs: t1 - t0,
      });

      // 6) scrivi output nel ctx
      ctx.outputs[node.assign] = content;

      // 7) node completed
      events.push({ type: "node.completed", ts: now(), nodeId: node.id });
    } catch (e: any) {
      // node failed + run failed
      events.push({
        type: "node.failed",
        ts: now(),
        nodeId: node.id,
        error: String(e?.message ?? e),
      });
      events.push({ type: "run.completed", ts: now(), status: "failed" });
      throw Object.assign(e, { events }); // utile: allego eventi all'errore
    }
  }

  // run completed success
  events.push({ type: "run.completed", ts: now(), status: "success" });
  return { ctx, events };
}
