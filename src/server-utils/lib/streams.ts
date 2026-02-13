// src/server-utils/lib/streams.ts
import type { Readable } from "stream";
import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";


/**
 * Converte uno stream Node.js (es. Body di S3/R2) in un Web ReadableStream,
 * compatibile con NextResponse.
 *
 * ⚠️ Usabile solo in runtime = "nodejs"
 */
export function nodeReadableToWebReadable(
  stream: Readable
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk) => {
        controller.enqueue(
          chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
        );
      });
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });
}

//funzione specifica per S3/R2
export function s3BodyToWebReadable(
  obj: GetObjectCommandOutput
): ReadableStream<Uint8Array> {
  const nodeStream = obj.Body as any as Readable;
  return nodeReadableToWebReadable(nodeStream);
}
