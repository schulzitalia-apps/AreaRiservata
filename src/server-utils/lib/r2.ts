// src/lib/r2.ts
import { S3Client } from "@aws-sdk/client-s3";

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    // Fallisci chiaro a startup server-side
    throw new Error(`[R2] Missing required env: ${name}`);
  }
  return v;
}

/**
 * ENV richieste:
 *  - R2_ACCOUNT_ID            es: "aa5c16...5842"
 *  - R2_ACCESS_KEY_ID
 *  - R2_SECRET_ACCESS_KEY
 *  - R2_BUCKET                es: "schulz-private"
 *  - R2_JURISDICTION (opzionale) es: "eu" per buckets WEUR
 */
export const R2_ACCOUNT_ID = reqEnv("R2_ACCOUNT_ID");
export const R2_ACCESS_KEY_ID = reqEnv("R2_ACCESS_KEY_ID");
export const R2_SECRET_ACCESS_KEY = reqEnv("R2_SECRET_ACCESS_KEY");
export const R2_BUCKET = reqEnv("R2_BUCKET");

// opzionale: "eu" se il bucket è creato in Europa occidentale (WEUR)
const R2_JURISDICTION = process.env.R2_JURISDICTION?.trim(); // "eu" | undefined

// Endpoint corretto per S3 API di R2
// - globale: https://<account_id>.r2.cloudflarestorage.com
// - giurisdizione EU: https://<account_id>.eu.r2.cloudflarestorage.com
export const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}${
  R2_JURISDICTION ? `.${R2_JURISDICTION}` : ""
}.r2.cloudflarestorage.com`;

export const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  // IMPORTANTISSIMO per R2 con AWS SDK v3
  forcePathStyle: true,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ...resto invariato sopra

export function makeR2Client(jurisdiction?: "eu" | undefined) {
  const endpoint = `https://${R2_ACCOUNT_ID}${jurisdiction ? `.${jurisdiction}` : ""}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}
