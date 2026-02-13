import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { name, email, message, to } = await req.json();

    if (!name || !email || !message || !to) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const data = await resend.emails.send({
      from: process.env.EMAIL_FROM!,   // mittente fisso dalle ENV
      to,                              // destinatario dinamico
      replyTo: email,                  // <--- CAMPO CORRETTO
      subject: `Nuovo messaggio da ${name}`,
      html: `
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Messaggio:</strong><br/>${message}</p>
      `,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("Email error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
