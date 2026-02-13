import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;
const MONGODB_DB = (process.env.MONGODB_DB as string) || "test";  //scegli il nome del db negli env, altrimenti: test!!

if (!MONGODB_URI) throw new Error("❌ MONGODB_URI non definita nell'.env");

let cached = (global as any)._mongooseCached;
if (!cached) {
  cached = (global as any)._mongooseCached = {
    conn: null as typeof mongoose | null,
    promise: null as Promise<typeof mongoose> | null,
  };
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: MONGODB_DB,          // 👈 QUI scegli test/prod
        bufferCommands: false as any,
        autoIndex: true,
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn!;
}
