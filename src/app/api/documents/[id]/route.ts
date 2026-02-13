// src/app/api/documents/aa/route.ts  (DELETE)
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import DocumentItemModel from "@/server-utils/models/Document";
import { r2Client } from "@/server-utils/lib/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1) Autenticazione
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // 2) Carico documento
  await connectToDatabase();
  const doc = await DocumentItemModel.findById(id);
  if (!doc) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  // 3) ACL: può cancellare solo chi l'ha creato o il "proprietario"
  if (
    String(doc.createdBy) !== String(token.id) &&
    String(doc.ownerId || "") !== String(token.id)
  ) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const r2Key = doc.r2Key;

  // 4) Prima provo a cancellare il file su R2
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: r2Key,
      })
    );
  } catch (e: any) {
    // Se l'oggetto non esiste già (404) possiamo considerarlo comunque cancellato
    const status = e?.$metadata?.httpStatusCode;
    if (status !== 404) {
      console.error("[docs/delete] R2 delete failed:", e);
      return NextResponse.json(
        { message: "Storage delete failed" },
        { status: 500 }
      );
    }
  }

  // 5) Se lo storage è ok (o l'oggetto non esisteva), cancello la riga dal DB
  await doc.deleteOne();

  // TODO: qui potresti aggiungere un audit log del tipo:
  // await DocumentAccessLogModel.create({
  //   userId: token.id,
  //   docId: doc._id,
  //   action: "delete",
  //   at: new Date(),
  // });

  return NextResponse.json({ ok: true });
}
