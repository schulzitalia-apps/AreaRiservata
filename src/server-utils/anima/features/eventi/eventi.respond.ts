import type { AnimaEventoTypeInfo } from "./eventi.types";

function formatEventoType(item: AnimaEventoTypeInfo): string {
  const kinds = item.allowedTimeKinds.length
    ? item.allowedTimeKinds.join(", ")
    : "nessuno";

  return `- ${item.label} (\`${item.slug}\`) -> timeKind: ${kinds}`;
}

export function buildEventDiscoveryReply(
  types: AnimaEventoTypeInfo[],
): string {
  if (!types.length) {
    return "Al momento non risultano tipi evento configurati.";
  }

  const preview = types.slice(0, 8).map(formatEventoType).join("\n");
  const more =
    types.length > 8
      ? `\n... e altri ${types.length - 8} tipi configurati.`
      : "";

  return [
    "Posso lavorare sul dominio eventi leggendo i tipi configurati in piattaforma.",
    "I primi tipi evento disponibili sono:",
    preview + more,
    "Nel prossimo step useremo questo catalogo per eseguire `eventi.list` e `eventi.create` in modo guidato.",
  ].join("\n\n");
}
