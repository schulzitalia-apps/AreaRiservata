// app/api/meta-whatsapp-webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';

import { getUserProfile, buildSystemPrompt } from '@/server-utils/anima/botConfig';
import {
  addMessage,
  getRecentMessages,
  setLastClienteContext,
  getLastClienteContext,
  type ClienteContext,
} from '@/server-utils/anima/memory';
import { searchClientiByNomeLike } from '@/server-utils/anima/clientiSearch';

export const runtime = 'nodejs';

/* ----------------------------- ENV WHATSAPP META ---------------------------- */

const {
  META_WHATSAPP_TOKEN,
  META_WHATSAPP_PHONE_NUMBER_ID,
  META_WHATSAPP_VERIFY_TOKEN,
  GROQ_API_KEY,
  GROQ_MODEL = 'groq/compound',
} = process.env;

if (!META_WHATSAPP_TOKEN || !META_WHATSAPP_PHONE_NUMBER_ID) {
  console.warn('⚠️ Mancano META_WHATSAPP_TOKEN o META_WHATSAPP_PHONE_NUMBER_ID');
}

if (!GROQ_API_KEY) {
  console.warn('⚠️ Manca GROQ_API_KEY');
}

/* -------------------------- ROUTER (chat vs search) ------------------------- */

type BotAction =
  | { action: 'chat' }
  | { action: 'search_cliente'; nome: string };

async function decideActionFromMessage(text: string): Promise<BotAction> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: `
Sei un router per un CRM clienti.
Devi rispondere SOLO con un JSON.

Formati possibili:

{"action":"chat"}

oppure

{"action":"search_cliente","nome":"NOME O PARZIALE"}

Usa "search_cliente" SOLO se l'utente chiede chiaramente di cercare,
trovare, mostrare o recuperare uno o più clienti in base al nome,
cognome o ragione sociale (anche parziali).
In tutti gli altri casi usa "chat".
`.trim(),
        },
        { role: 'user', content: text },
      ],
      temperature: 0,
    }),
  });

  try {
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(content);

    if (
      parsed &&
      parsed.action === 'search_cliente' &&
      typeof parsed.nome === 'string' &&
      parsed.nome.trim().length > 0
    ) {
      return { action: 'search_cliente', nome: parsed.nome.trim() };
    }

    return { action: 'chat' };
  } catch (e) {
    console.warn('Router Groq non parsabile, fallback a chat:', e);
    return { action: 'chat' };
  }
}

/* ------------- risposte dirette usando SOLO il contesto cliente ------------- */

function tryAnswerFromClienteContext(
  question: string,
  cliente: ClienteContext
): string | null {
  const q = question.toLowerCase();

  const hasIndirizzo = cliente.indirizzo || cliente.localita || cliente.cap;
  const hasTelefono = cliente.telefono;
  const hasEmail = cliente.email;

  if (
    hasIndirizzo &&
    (q.includes('indirizzo') ||
      q.includes('dove abita') ||
      q.includes('dove si trova') ||
      q.includes('dove sta') ||
      q.includes('dove vive') ||
      q.includes('dove si trova il cliente'))
  ) {
    const parts = [cliente.indirizzo, cliente.cap, cliente.localita]
      .filter(Boolean)
      .join(' - ');
    if (!parts) {
      return `Per ${cliente.label} non ho un indirizzo completo registrato nei dati.`;
    }
    return `L'indirizzo registrato per ${cliente.label} è: ${parts}.`;
  }

  if (cliente.cap && (q.includes('cap') || q.includes('codice di avviamento'))) {
    return `Il CAP registrato per ${cliente.label} è ${cliente.cap}.`;
  }

  if (
    cliente.localita &&
    (q.includes('località') || q.includes('città') || q.includes('comune'))
  ) {
    return `La località registrata per ${cliente.label} è ${cliente.localita}.`;
  }

  if (
    hasTelefono &&
    (q.includes('telefono') ||
      q.includes('cellulare') ||
      q.includes('numero') ||
      q.includes('contatt'))
  ) {
    return `Il numero di telefono registrato per ${cliente.label} è ${cliente.telefono}.`;
  }

  if (
    hasEmail &&
    (q.includes('email') ||
      q.includes('e-Mail') ||
      q.includes('posta elettronica') ||
      q.includes('indirizzo Mail'))
  ) {
    return `L'email registrata per ${cliente.label} è ${cliente.email}.`;
  }

  return null;
}

/* --------------------------- formattazione risultati ------------------------ */

function formatClientiReply(
  term: string,
  results: Awaited<ReturnType<typeof searchClientiByNomeLike>>
): string {
  if (!results.length) {
    return `Non ho trovato clienti che corrispondono a "${term}".`;
  }

  if (results.length === 1) {
    const c = results[0];
    const name =
      c.ragioneSociale ||
      [c.nome, c.cognome].filter(Boolean).join(' ') ||
      '(senza nome)';

    const contatti = [c.email, c.telefono].filter(Boolean).join(' · ');
    const indirizzo = [c.indirizzo, c.cap, c.localita].filter(Boolean).join(' - ');

    let text = `Ho trovato questo cliente:\n\n${name}`;
    if (contatti) text += `\n${contatti}`;
    if (indirizzo) text += `\n${indirizzo}`;

    return text;
  }

  const items = results
    .map((c) => {
      const name =
        c.ragioneSociale ||
        [c.nome, c.cognome].filter(Boolean).join(' ') ||
        '(senza nome)';
      const contatti = [c.email, c.telefono].filter(Boolean).join(' · ');
      const indirizzo = [c.indirizzo, c.cap, c.localita].filter(Boolean).join(' - ');
      const tail = [contatti, indirizzo].filter(Boolean).join(' — ');
      return tail ? `• ${name} — ${tail}` : `• ${name}`;
    })
    .join('\n');

  return `Ho trovato alcuni clienti per "${term}":\n\n${items}\n\n(se vuoi posso filtrare meglio, ad esempio specificando il cognome o la ragione sociale completa)`;
}

/* ------------------------------- WEBHOOK GET --------------------------------
   Usato da Meta per verificare il webhook (hub.verify_token / hub.challenge)
----------------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === META_WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook WhatsApp verificato da Meta');
    return new NextResponse(challenge ?? '', { status: 200 });
  }

  console.warn('❌ Verifica webhook fallita', { mode, token });
  return new NextResponse('Forbidden', { status: 403 });
}

/* ---------------------------------- WEBHOOK POST --------------------------- */

export async function POST(req: NextRequest) {
  try {
    console.log('>>> POST /api/meta-whatsapp-webhook');

    const payload: any = await req.json();
    console.log('BODY IN ARRIVO DA WHATSAPP CLOUD:', JSON.stringify(payload, null, 2));

    // struttura tipica:
    // entry[0].changes[0].value.messages[0]
    const change = payload?.entry?.[0]?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    // Nessun messaggio (es. solo status / ack) → OK e basta
    if (!message) {
      console.log('Nessun message nel payload (forse status), ritorno 200');
      return new NextResponse('OK', { status: 200 });
    }

    if (message.type !== 'text' || !message.text?.body) {
      console.log('Messaggio non testuale, ignorato');
      return new NextResponse('OK', { status: 200 });
    }

    const from = message.from as string;        // es "393783030069"
    const body = message.text.body as string;   // testo utente

    console.log(`Messaggio da ${from}: ${body}`);

    const userId = from;
    const userProfile = getUserProfile(userId);

    // salvo messaggio utente nella memoria "chat"
    addMessage(userId, 'user', body);

    // 1) router: decidiamo se è ricerca clienti o semplice chat
    const botAction = await decideActionFromMessage(body);

    let reply: string;

    if (botAction.action === 'search_cliente') {
      /* ------------------------- RICERCA CLIENTI SU DB ---------------------- */
      const results = await searchClientiByNomeLike(botAction.nome);

      if (results.length === 1) {
        const c = results[0];
        const label =
          c.ragioneSociale ||
          [c.nome, c.cognome].filter(Boolean).join(' ') ||
          '(senza nome)';

        setLastClienteContext(userId, {
          id: c.id,
          label,
          email: c.email,
          telefono: c.telefono,
          indirizzo: c.indirizzo,
          cap: c.cap,
          localita: c.localita,
        });
      }

      reply = formatClientiReply(botAction.nome, results);
    } else {
      /* ---------------------------- CHAT NORMALE ---------------------------- */
      const history = getRecentMessages(userId);
      const systemPrompt = buildSystemPrompt(userProfile);
      const lastCliente = getLastClienteContext(userId);

      if (lastCliente) {
        const directAnswer = tryAnswerFromClienteContext(body, lastCliente);
        if (directAnswer) {
          reply = directAnswer;
        } else {
          const clienteJson = JSON.stringify(lastCliente);

          const systemMessages = [
            { role: 'system' as const, content: systemPrompt },
            {
              role: 'system' as const,
              content: `
Contesto CRM del cliente corrente (NON inventare campi aggiuntivi).
Dati cliente (JSON):

${clienteJson}

Quando l'utente fa domande su questo cliente (indirizzo, CAP, località,
telefono, email, ecc.), rispondi SOLO usando questi dati.
Se un'informazione non è presente nel JSON, scrivi chiaramente che non è
disponibile nei dati e proponi di farla verificare ad uno specialista Schulz.
Non inventare valori o dettagli mancanti.
`.trim(),
            },
          ];

          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${GROQ_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: GROQ_MODEL,
              messages: [...systemMessages, ...history],
            }),
          });

          if (!groqRes.ok) {
            const errText = await groqRes.text();
            console.error('Errore Groq:', errText);
            reply = 'Al momento non riesco a rispondere, riprova più tardi.';
          } else {
            const groqData: any = await groqRes.json();
            reply =
              groqData?.choices?.[0]?.message?.content?.trim() ||
              'Al momento non riesco a rispondere, riprova più tardi.';
          }
        }
      } else {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [{ role: 'system', content: systemPrompt }, ...history],
          }),
        });

        if (!groqRes.ok) {
          const errText = await groqRes.text();
          console.error('Errore Groq:', errText);
          reply = 'Al momento non riesco a rispondere, riprova più tardi.';
        } else {
          const groqData: any = await groqRes.json();
          reply =
            groqData?.choices?.[0]?.message?.content?.trim() ||
            'Al momento non riesco a rispondere, riprova più tardi.';
        }
      }
    }

    console.log('Risposta bot:', reply);

    // salvo risposta nella memoria conversazione
    addMessage(userId, 'assistant', reply);

    // invio risposta su WhatsApp Cloud API
    await sendWhatsappMessage(from, reply);

    console.log('Messaggio inviato con successo tramite WhatsApp Cloud API.');
    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error('Errore nel webhook WhatsApp Cloud:', err?.message || err);
    return new NextResponse('Error', { status: 500 });
  }
}

/* ---------------------------- INVIO MESSAGGI META -------------------------- */

async function sendWhatsappMessage(to: string, body: string) {
  if (!META_WHATSAPP_TOKEN || !META_WHATSAPP_PHONE_NUMBER_ID) {
    console.error('META_WHATSAPP_TOKEN o META_WHATSAPP_PHONE_NUMBER_ID non configurati');
    return;
  }

  const url = `https://graph.facebook.com/v21.0/${META_WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${META_WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Errore invio messaggio WA Cloud API:', errText);
  }
}


