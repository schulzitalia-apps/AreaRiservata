import { getEventiList } from "@/config/eventi.registry";
import type { AnimaEventoTypeInfo } from "./eventi.types";

export function listAnimaEventoTypes(): AnimaEventoTypeInfo[] {
  return getEventiList().map((evento) => ({
    slug: evento.slug,
    label: evento.label,
    allowedTimeKinds: evento.allowedTimeKinds,
    previewTitleFields: evento.preview.title,
  }));
}

export function supportsEventDiscovery(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;

  const eventTerms = [
    "evento",
    "eventi",
    "appuntamento",
    "appuntamenti",
    "calendario",
  ];

  const helpTerms = [
    "che puoi fare",
    "cosa puoi fare",
    "che tipo",
    "quali tipi",
    "tipi di eventi",
    "tipi evento",
    "ricordare",
  ];

  return (
    eventTerms.some((term) => normalized.includes(term)) &&
    helpTerms.some((term) => normalized.includes(term))
  );
}
