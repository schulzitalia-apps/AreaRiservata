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
  subject: "Invito Area Riservata",
  heading: "Invito Area Riservata",
  introText: "Sei stato invitato ad accedere all’Area Riservata.",
  ctaIntroText: "Clicca qui per attivare l’account e impostare la password:",
  expiresLabelText: "Il link scade il:",
  ignoreText: "Se non ti aspettavi questa email, puoi ignorarla.",
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
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="margin: 0 0 12px;">${inviteEmailTemplateConfig.heading}</h2>

        <p style="margin: 0 0 12px;">
          ${inviteEmailTemplateConfig.introText}
        </p>

        <p style="margin: 0 0 12px;">
          ${inviteEmailTemplateConfig.ctaIntroText}
          <br />
          <a href="${inviteLink}" target="_blank" rel="noreferrer">${inviteLink}</a>
        </p>

        <p style="margin: 0 0 12px;">
          ${inviteEmailTemplateConfig.expiresLabelText} <strong>${expiresText}</strong>
        </p>

        <p style="margin: 0 0 12px;">
          ${inviteEmailTemplateConfig.ignoreText}
        </p>

        <hr style="margin: 18px 0; opacity: .2;" />

        <p style="margin: 0 0 8px;">
          ${inviteEmailTemplateConfig.directLinkLabelText}
          <br />
          <span style="font-family: monospace; font-size: 12px;">${inviteLink}</span>
        </p>
      </div>
    `;
  },
};
