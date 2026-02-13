import { NextRequest, NextResponse } from "next/server";
import {
  ListBucketsCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetBucketLocationCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";

import {
  r2Client,
  R2_ENDPOINT,
  R2_BUCKET,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  makeR2Client,
} from "@/server-utils/lib/r2";

function mask(val: string | undefined, show = 4) {
  if (!val) return null;
  const s = String(val);
  if (s.length <= show * 2) return "*".repeat(s.length);
  return `${s.slice(0, show)}${"*".repeat(s.length - show * 2)}${s.slice(-show)}`;
}

function normErr(where: string, e: any) {
  const md = e?.$metadata ?? {};
  return {
    where,
    name: e?.name || null,
    message: e?.message || String(e),
    httpStatus: md.httpStatusCode ?? null,
    requestId: md.requestId ?? null,      // utile con il supporto CF
    attempts: md.attempts ?? null,
    totalRetryDelay: md.totalRetryDelay ?? null,
  };
}

async function runReadSuite() {
  const startedAt = Date.now();
  const rawEnv = {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_JURISDICTION: process.env.R2_JURISDICTION,
  };

  const diagnostics: any = {
    now: new Date().toISOString(),
    endpoint: R2_ENDPOINT,
    region: "auto",
    expectedBucket: R2_BUCKET,
    envRaw: {
      R2_BUCKET_json: JSON.stringify(rawEnv.R2_BUCKET ?? null),
      R2_JURISDICTION_json: JSON.stringify(rawEnv.R2_JURISDICTION ?? null),
    },
    envMasked: {
      R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: mask(R2_ACCESS_KEY_ID),
      R2_SECRET_ACCESS_KEY: mask(R2_SECRET_ACCESS_KEY),
      R2_BUCKET,
      R2_JURISDICTION: process.env.R2_JURISDICTION ?? null,
    },
    timings: {} as Record<string, number>,
    buckets: [] as string[],
    bucketCheck: {
      headOk: false,
      existsInList: false,
      sampleCount: 0,
      truncated: false,
      sampleKeys: [] as string[],
      location: null as string | null,
    },
    errors: [] as Array<{ where: string; message: string } | any>,
    hints: [
      "Se 'buckets' NON contiene il bucket atteso, controlla Account ID, chiavi HMAC e soprattutto la giurisdizione/endpoint.",
      "Endpoint EU valido: https://<account_id>.eu.r2.cloudflarestorage.com",
      "Per R2 usa forcePathStyle: true e region 'auto'.",
    ],
  };

  // 1) ListBuckets
  try {
    const t0 = Date.now();
    const out = await r2Client.send(new ListBucketsCommand({}));
    diagnostics.timings.listBucketsMs = Date.now() - t0;
    diagnostics.buckets = (out.Buckets || []).map((b) => b.Name!).filter(Boolean);
  } catch (e: any) {
    diagnostics.errors.push(normErr("ListBuckets", e));
  }

  // 2) HeadBucket
  try {
    const t0 = Date.now();
    await r2Client.send(new HeadBucketCommand({ Bucket: R2_BUCKET }));
    diagnostics.timings.headBucketMs = Date.now() - t0;
    diagnostics.bucketCheck.headOk = true;
  } catch (e: any) {
    diagnostics.bucketCheck.headOk = false;
    diagnostics.errors.push(normErr("HeadBucket", e));
  }

  diagnostics.bucketCheck.existsInList = diagnostics.buckets.includes(R2_BUCKET);

  // 3) GetBucketLocation (per vedere hint/locazione S3-style)
  try {
    const t0 = Date.now();
    const loc = await r2Client.send(new GetBucketLocationCommand({ Bucket: R2_BUCKET }));
    diagnostics.timings.getBucketLocationMs = Date.now() - t0;
    diagnostics.bucketCheck.location = (loc as any)?.LocationConstraint ?? null;
  } catch (e: any) {
    diagnostics.errors.push(normErr("GetBucketLocation", e));
  }

  // 4) ListObjects sample
  try {
    const t0 = Date.now();
    const res = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        MaxKeys: 10,
      })
    );
    diagnostics.timings.listObjectsMs = Date.now() - t0;
    diagnostics.bucketCheck.sampleCount = (res.Contents || []).length;
    diagnostics.bucketCheck.truncated = !!res.IsTruncated;
    diagnostics.bucketCheck.sampleKeys = (res.Contents || []).map((o) => o.Key!).filter(Boolean);
  } catch (e: any) {
    diagnostics.errors.push(normErr("ListObjectsV2", e));
  }

  diagnostics.timings.totalMs = Date.now() - startedAt;
  return diagnostics;
}

async function runWriteSuite() {
  const startedAt = Date.now();
  const result: any = {
    now: new Date().toISOString(),
    endpoint: R2_ENDPOINT,
    expectedBucket: R2_BUCKET,
    timings: {} as Record<string, number>,
    put: { ok: false, key: null as string | null, contentType: "text/plain" },
    del: { ok: false },
    errors: [] as any[],
  };

  const key = `debug/${crypto.randomUUID()}.txt`;
  const body = Buffer.from(`debug upload ${new Date().toISOString()}\n`);

  try {
    const t0 = Date.now();
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: result.put.contentType,
      })
    );
    result.timings.putMs = Date.now() - t0;
    result.put.ok = true;
    result.put.key = key;
  } catch (e: any) {
    result.errors.push(normErr("PutObject", e));
  }

  if (result.put.ok && result.put.key) {
    try {
      const t0 = Date.now();
      await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: result.put.key }));
      result.timings.deleteMs = Date.now() - t0;
      result.del.ok = true;
    } catch (e: any) {
      result.errors.push(normErr("DeleteObject", e));
    }
  }

  result.timings.totalMs = Date.now() - startedAt;
  return result;
}

/** PROBE: prova ListBuckets/HeadBucket su entrambi gli endpoint (globale ed EU) */
async function runProbeBothEndpoints(bucketName: string) {
  const out: any = { endpoints: [] as any[] };
  for (const j of [undefined, "eu" as const]) {
    const client = makeR2Client(j);
    const endpoint = `https://${R2_ACCOUNT_ID}${j ? `.${j}` : ""}.r2.cloudflarestorage.com`;
    const entry: any = { jurisdiction: j ?? "default", endpoint, list: null, head: null, errors: [] as any[] };
    try {
      const r = await client.send(new ListBucketsCommand({}));
      entry.list = (r.Buckets || []).map((b) => b.Name).filter(Boolean);
    } catch (e: any) {
      entry.errors.push(normErr("ListBuckets", e));
    }
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucketName }));
      entry.head = { ok: true };
    } catch (e: any) {
      entry.head = { ok: false };
      entry.errors.push(normErr("HeadBucket", e));
    }
    out.endpoints.push(entry);
  }
  return out;
}

/** CREATE: prova a creare (e opzionalmente cancellare) un bucket di test nella giurisdizione richiesta */
async function runCreateBucketSuite(name: string, jurisdiction?: "eu" | undefined, deleteAfter = true) {
  const client = makeR2Client(jurisdiction);
  const endpoint = `https://${R2_ACCOUNT_ID}${jurisdiction ? `.${jurisdiction}` : ""}.r2.cloudflarestorage.com`;
  const res: any = { endpoint, name, jurisdiction: jurisdiction ?? "default", created: false, deleted: false, errors: [] as any[] };

  try {
    await client.send(
      new CreateBucketCommand({
        Bucket: name,
        // opzionale: LocationConstraint = hint (WEUR, ENAM, ecc.) — non è la giurisdizione
        // CreateBucketConfiguration: { LocationConstraint: "WEUR" },
      })
    );
    res.created = true;
  } catch (e: any) {
    res.errors.push(normErr("CreateBucket", e));
  }

  if (deleteAfter && res.created) {
    try {
      await client.send(new DeleteBucketCommand({ Bucket: name }));
      res.deleted = true;
    } catch (e: any) {
      res.errors.push(normErr("DeleteBucket", e));
    }
  }

  return res;
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") || "read";
  if (mode === "probe") {
    const bucket = req.nextUrl.searchParams.get("bucket") || R2_BUCKET;
    const data = await runProbeBothEndpoints(bucket);
    return NextResponse.json(data, { status: 200 });
  }
  if (mode === "location") {
    // re-usa runReadSuite (già fa GetBucketLocation)
    const data = await runReadSuite();
    return NextResponse.json(data, { status: 200 });
  }
  const data = await runReadSuite();
  return NextResponse.json(data, { status: 200 });
}

export async function POST(req: NextRequest) {
  // azioni via body JSON: { action: "...", ... }
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const action = body?.action || "write";

  if (action === "createBucket") {
    const name = String(body?.name || "").trim();
    const jurisdiction = (body?.jurisdiction as "eu" | "default" | undefined) === "eu" ? "eu" : undefined;
    const deleteAfter = body?.deleteAfter !== false;
    if (!name) return NextResponse.json({ error: "Missing 'name' for createBucket" }, { status: 400 });
    const data = await runCreateBucketSuite(name, jurisdiction, deleteAfter);
    return NextResponse.json(data, { status: 200 });
  }

  if (action === "probe") {
    const bucket = String(body?.bucket || R2_BUCKET);
    const data = await runProbeBothEndpoints(bucket);
    return NextResponse.json(data, { status: 200 });
  }

  // default: write suite
  const data = await runWriteSuite();
  return NextResponse.json(data, { status: 200 });
}
