/**
 * invite_template.config.ts
 * -----------------------------------------------------------------------------
 * Scopo:
 *   Centralizzare TUTTI i testi dell'email di invito (e solo quelli), in modo che
 *   chiunque possa modificare contenuti e micro-copie senza toccare logica/flow.
 *
 * Cosa si può modificare in sicurezza:
 *   ✅ subject, titolo, testi dei paragrafi, etichette, note
 *   ✅ locale e formattazione data (con moderazione)
 *
 * Cosa NON si dovrebbe cambiare (per non rompere la mail):
 *   ❌ la struttura HTML principale (tag/ordine) se non sai cosa stai facendo
 *   ❌ i placeholder dinamici: inviteLink, expiresText
 *   ❌ la logica di renderHtml (a meno che tu non sia consapevole dei side effect)
 *
 * Come si usa:
 *   import { inviteEmailTemplateConfig } from "@/config/access/invite_template.config";
 *   const html = inviteEmailTemplateConfig.renderHtml({ inviteLink, expiresAtISO });
 */

export type InviteEmailTemplateParams = {
  inviteLink: string;
  expiresAtISO: string;
};

export type InviteEmailTemplateConfig = {
  /**
   * Oggetto email (testo visibile nel client).
   * Consigli: corto, chiaro, niente emoji se non sono previste dal tone of voice.
   */
  subject: string;

  /**
   * Testi principali (modificabili liberamente).
   */
  heading: string;
  introText: string;

  /**
   * Riga che introduce la CTA/link.
   * Esempio: "Clicca qui per attivare l’account e impostare la password:"
   */
  ctaIntroText: string;

  /**
   * Etichetta/parte testo prima della data di scadenza.
   * Esempio: "Il link scade il:"
   */
  expiresLabelText: string;

  /**
   * Testo informativo finale.
   * Esempio: "Se non ti aspettavi questa email, puoi ignorarla."
   */
  ignoreText: string;

  /**
   * Sezione “Link diretto” (utile per copia/incolla).
   */
  directLinkLabelText: string;

  /**
   * Formattazione data scadenza.
   * NB: qui si gestisce SOLO come appare la data nell'email.
   * Se vuoi cambiare timezone/locale puoi farlo qui senza toccare il sender.
   */
  dateFormatting: {
    /**
     * Locale per la formattazione data.
     * "it-IT" = italiano (Italia)
     */
    locale: string;

    /**
     * Opzioni Intl.DateTimeFormat.
     * Tieni opzioni semplici per evitare formati strani su alcuni client.
     */
    options?: Intl.DateTimeFormatOptions;
  };

  /**
   * Render HTML finale.
   * Qui conviene NON toccare troppo la struttura: mantiene l'email coerente.
   */
  renderHtml: (params: InviteEmailTemplateParams) => string;
};

export const inviteEmailTemplateConfig: InviteEmailTemplateConfig = {
  // -------------------------
  // ✅ TESTI MODIFICABILI
  // -------------------------
  subject: "Nuova Area Riservata Schulz",
  heading: "Area Riservata Schulz",
  introText:
    "Da oggi è disponibile la nuova Area Riservata Schulz, il portale dedicato a rivenditori e agenti pensato per semplificare davvero il lavoro quotidiano.",
  ctaIntroText: "Accedi ora all’Area Riservata:",
  expiresLabelText: "Il link di attivazione scade il:",
  ignoreText:
    "Per qualsiasi necessità potrai comunque contattarci.",
  directLinkLabelText: "Link diretto:",

  // -------------------------
  // ✅ FORMATO DATA (MODIFICABILE)
  // -------------------------
  dateFormatting: {
    locale: "it-IT",
    options: {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
  },

  // -------------------------
  // ⚠️ STRUTTURA HTML
  // (idealmente lascia invariata)
  // -------------------------
  renderHtml: ({ inviteLink, expiresAtISO }) => {
    // Formattazione data: l'input ISO arriva dal backend (es: "2026-01-14T10:30:00.000Z")
    const expiresDate = new Date(expiresAtISO);
    const inviteUrl = new URL(inviteLink);
    const logoUrl = `${inviteUrl.origin}/images/logo/logo_bianco.png`;

    // Se la data non è valida, evitiamo "Invalid Date" in email
    const expiresText = Number.isNaN(expiresDate.getTime())
      ? expiresAtISO
      : expiresDate.toLocaleString(
        inviteEmailTemplateConfig.dateFormatting.locale,
        inviteEmailTemplateConfig.dateFormatting.options
      );

    // NOTE IMPORTANTI:
    // - inviteLink viene inserito in href + testo (così l’utente vede dove clicca)
    // - manteniamo inline styles per compatibilità email client
    return `
      <div style="margin: 0; padding: 32px 16px; background-color: #f4f4f5; font-family: Arial, sans-serif; color: #1f2937;">
        <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);">
          <div style="background: linear-gradient(135deg, #1f2937 0%, #111827 100%); padding: 28px 32px; text-align: center;">
            <img src="${logoUrl}" alt="Schulz Italia" style="max-width: 220px; width: 100%; height: auto; display: inline-block;" />
          </div>

          <div style="padding: 36px 32px 32px;">
            <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.7;">
              Gentile Partner,
            </p>

            <h1 style="margin: 0 0 18px; font-size: 28px; line-height: 1.2; color: #111827;">
              ${inviteEmailTemplateConfig.heading}
            </h1>

            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.8; color: #374151;">
              ${inviteEmailTemplateConfig.introText}
            </p>

            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.8; color: #374151;">
              All’interno troverai un unico spazio dove poter gestire in autonomia tutte le attività legate agli ordini Schulz, senza dover richiedere informazioni via mail o telefono.
            </p>

            <div style="margin: 24px 0; padding: 22px 24px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px;">
              <p style="margin: 0 0 14px; font-size: 15px; font-weight: 700; color: #111827;">
                Cosa puoi fare subito:
              </p>
              <ul style="margin: 0; padding-left: 20px; color: #374151;">
                <li style="margin: 0 0 10px; line-height: 1.7;">controllare lo stato reale delle tue commesse</li>
                <li style="margin: 0 0 10px; line-height: 1.7;">verificare le date di consegna aggiornate</li>
                <li style="margin: 0 0 10px; line-height: 1.7;">scaricare listini, cataloghi e schede tecniche sempre aggiornati</li>
                <li style="margin: 0 0 10px; line-height: 1.7;">consultare l’archivio delle tue commesse e scaricare conferme d’ordine e certificazioni</li>
                <li style="margin: 0 0 10px; line-height: 1.7;">accedere ai materiali marketing ufficiali</li>
              </ul>
            </div>

            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.8; color: #374151;">
              Il calendario consegne è collegato alla produzione: questo significa che le informazioni visualizzate sono affidabili e aggiornate.
            </p>

            <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.8; color: #374151;">
              Abbiamo preparato anche una breve guida illustrata che ti accompagnerà passo-passo nell’utilizzo della piattaforma.
            </p>

            <div style="margin: 28px 0; padding: 24px; background-color: #111827; border-radius: 18px; text-align: center;">
              <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.6; color: #ffffff; font-weight: 700;">
                ${inviteEmailTemplateConfig.ctaIntroText}
              </p>
              <a href="${inviteLink}" target="_blank" rel="noreferrer" style="display: inline-block; padding: 14px 28px; border-radius: 999px; background-color: #ffffff; color: #111827; text-decoration: none; font-size: 14px; font-weight: 700;">
                Attiva le credenziali
              </a>
              <p style="margin: 18px 0 0; font-size: 13px; line-height: 1.7; color: #d1d5db;">
                Qua sotto trovi un link per attivare le tue credenziali. Mi raccomando, il link ha una durata di 48 ore.
              </p>
            </div>

            <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.7; color: #374151;">
              ${inviteEmailTemplateConfig.expiresLabelText} <strong style="color: #111827;">${expiresText}</strong>
            </p>

            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.8; color: #374151;">
              ${inviteEmailTemplateConfig.ignoreText}
            </p>

            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.8; color: #374151;">
              Siamo certi che questo strumento renderà più semplice e veloce la gestione del tuo lavoro con Schulz.
            </p>

            <p style="margin: 0; font-size: 15px; line-height: 1.8; color: #374151;">
              Un cordiale saluto<br />
              <strong style="color: #111827;">Schulz Italia S.r.l.</strong>
            </p>

            <hr style="margin: 28px 0 18px; border: 0; border-top: 1px solid #e5e7eb;" />

            <p style="margin: 0 0 8px; font-size: 12px; line-height: 1.7; color: #6b7280;">
              ${inviteEmailTemplateConfig.directLinkLabelText}
            </p>
            <p style="margin: 0; word-break: break-all; font-family: monospace; font-size: 12px; line-height: 1.7; color: #4b5563;">
              ${inviteLink}
            </p>
          </div>
        </div>
      </div>
    `;
  },
};
