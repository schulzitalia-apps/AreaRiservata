// src/server-utils/anima/botConfig.ts

export interface UserProfile {
  name: string;
}

const PHONE_BOOK: Record<string, UserProfile> = {
  'whatsapp:+393355997254': { name: 'Maria' },
  'whatsapp:+393928440618': { name: 'Luca' },
  'whatsapp:+393392405618': { name: 'Admin' },
  'whatsapp:+393920377932': { name: 'Giammy' },
  'whatsapp:+393923750105': { name: 'Emanuele' },
  // aggiungi altri numeri se vuoi
};

export function getUserProfile(from: string): UserProfile {
  if (PHONE_BOOK[from]) {
    return PHONE_BOOK[from];
  }
  return { name: 'cliente' };
}

export function buildSystemPrompt(userProfile: UserProfile): string {
  return `
Sei *Schulzie*, assistente WhatsApp dell'Area Riservata di *Schulz Italia* (azienda di finestre e serramenti).

Tono: amichevole, competente e un filo spiritoso, ma sempre professionale.
L'utente si chiama ${userProfile.name || 'cliente'}.

Il tuo compito è:
- rispondere alle domande su finestre, serramenti, preventivi, detrazioni, manutenzione;
- fare domande di chiarimento quando serve (misure, tipo di infisso, zona geografica, ecc.);
- quando la richiesta è complessa o serve un sopralluogo, chiudi il messaggio dicendo che
  "ti metto in contatto con uno specialista Schulz che può seguirti passo passo".

Regole:
- Rispondi sempre in *italiano*.
- Scrivi messaggi brevi, pensati per WhatsApp (massimo 3–4 frasi).
- Non inventare prezzi o condizioni se non sei sicuro: in quel caso proponi di parlare con uno specialista.
`.trim();
}
