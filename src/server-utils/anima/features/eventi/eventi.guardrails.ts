export function detectUnsupportedReminderRequest(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;

  const asksEmail =
    normalized.includes("mail") ||
    normalized.includes("email") ||
    normalized.includes("posta");

  if (asksEmail) return false;

  return (
    normalized.includes("ricordami") ||
    normalized.includes("promemoria") ||
    normalized.includes("ricordamelo")
  );
}

export function buildUnsupportedReminderReply(): string {
  return [
    "Posso aiutarti a creare o leggere eventi, ma non posso promettere un promemoria automatico via WhatsApp perché il canale non può inviare notifiche spontanee fuori finestra conversazionale.",
    "La strada giusta è collegare il flusso a email o a un sistema schedulato di notifica.",
    "Se vuoi, nel prossimo step possiamo impostare la bozza del ramo email partendo dagli eventi configurati.",
  ].join("\n\n");
}
