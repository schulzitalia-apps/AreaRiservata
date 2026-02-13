import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { AnimaMemoryModel } from "@/server-utils/anima-mini/animaMemory";

import { getUserProfile } from "@/server-utils/anima/botConfig";
import { chatOnce } from "@/server-utils/anima-mini/chatOnce"; // <-- adatta il path al tuo progetto

export const runtime = "nodejs";

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  GROQ_API_KEY,
} = process.env;

const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;

function buildWelcomeMessage(userName?: string) {
  const nome = userName ? ` *${userName}*` : "";
  return (
    `Ciao${nome}!\n` +
    `Dimmi pure cosa ti serve e ti rispondo subito.\n\n`
  );
}

async function sendWhatsappMessage(to: string, body: string) {
  if (!twilioClient) throw new Error("TWILIO_CLIENT_NOT_CONFIGURED");
  if (!TWILIO_WHATSAPP_NUMBER) throw new Error("TWILIO_WHATSAPP_NUMBER_MISSING");

  await twilioClient.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to,
    body,
  });
}

async function parseTwilioRequest(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  let from: string | null = null;
  let body: string | null = null;

  if (contentType.includes("application/json")) {
    const data = await req.json();
    from = data.From || data.from || null;
    body = data.Body || data.body || null;
  } else {
    const formData = await req.formData();
    from = (formData.get("From") as string) || null;
    body = (formData.get("Body") as string) || null;
  }

  if (from) from = String(from).trim();
  if (body) body = String(body).trim();

  return { from, body };
}

export async function POST(req: NextRequest) {
  try {
    const { from, body } = await parseTwilioRequest(req);

    // Twilio a volte manda webhook “vuoti” o con campi mancanti: rispondi 200.
    if (!from || !body) return new NextResponse(null, { status: 200 });

    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY_MISSING");

    const userId = from; // per WhatsApp: "whatsapp:+39..."
    const userProfile = getUserProfile(userId);

    // 1) capiamo se è la prima volta: controlliamo se esiste un doc memoria
    await connectToDatabase();
    const exists = await AnimaMemoryModel.exists({ _id: userId });

    // 2) primo contatto: welcome senza LLM
    if (!exists) {
      const welcome = buildWelcomeMessage(userProfile.name);

      // IMPORTANTISSIMO: creiamo una summary iniziale, così non rimandiamo welcome al prossimo msg
      await AnimaMemoryModel.updateOne(
        { _id: userId },
        {
          $set: {
            summary: `Conversazione WhatsApp avviata. Nome in rubrica: ${userProfile.name || "cliente"}.`,
          },
        },
        { upsert: true }
      );

      await sendWhatsappMessage(from, welcome);
      return new NextResponse(null, { status: 200 });
    }

    // 3) altrimenti: passa ad anima-mini
    const { reply } = await chatOnce({
      userId,
      userMessage: body,
      groqApiKey: GROQ_API_KEY,
      language: "it",
    });

    await sendWhatsappMessage(from, reply || "Ok! 👍");
    return new NextResponse(null, { status: 200 });
  } catch (err: any) {
    console.error("Errore webhook Twilio:", err?.message || err);
    // Twilio spesso preferisce 200 per non ritentare in loop,
    // ma se vuoi monitorare errori puoi usare 500.
    return new NextResponse(null, { status: 200 });
  }
}
