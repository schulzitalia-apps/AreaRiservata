import mongoose, { type Connection } from "mongoose";
import type { DbKey } from "./db.types";
import { resolveMongoUri } from "./db.env";

/**
 * Cache globale connessioni (fondamentale in Next dev/hot reload e in ambienti serverless).
 */
declare global {
  // eslint-disable-next-line no-var
  var __MONGO_CONNECTIONS_BY_KEY__: Map<string, Connection> | undefined;
  // eslint-disable-next-line no-var
  var __MONGO_CONNECTIONS_PENDING__: Map<string, Promise<Connection>> | undefined;
}

const connections = (global.__MONGO_CONNECTIONS_BY_KEY__ ||= new Map());
const pending = (global.__MONGO_CONNECTIONS_PENDING__ ||= new Map());

function isConnected(conn: Connection): boolean {
  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  return conn.readyState === 1;
}

/**
 * Ottiene (o crea) una connessione dedicata per dbKey.
 * - se esiste già ed è connessa => ritorna subito
 * - se è in corso una connessione => riusa la Promise
 * - altrimenti creaConnection e connette
 */
export async function getDbConnection(dbKey: DbKey): Promise<Connection> {
  const existing = connections.get(dbKey);
  if (existing && isConnected(existing)) return existing;

  const inflight = pending.get(dbKey);
  if (inflight) return inflight;

  const uri = resolveMongoUri(dbKey);

  const p = (async () => {
    // createConnection => connessione isolata (non usa mongoose.connection globale)
    const conn = mongoose.createConnection(uri, {
      // opzioni sane di default (puoi estenderle)
      // autoIndex: false, // a tua scelta: se gestisci indici manualmente
    });

    // connect è implicito su createConnection(uri), ma aspettiamo open/error
    await new Promise<void>((resolve, reject) => {
      conn.once("open", () => resolve());
      conn.once("error", (err) => reject(err));
    });

    connections.set(dbKey, conn);
    return conn;
  })();

  pending.set(dbKey, p);

  try {
    const conn = await p;
    return conn;
  } finally {
    pending.delete(dbKey);
  }
}

/**
 * Helper opzionale: chiude tutte le connessioni (utile in test)
 */
export async function closeAllDbConnections(): Promise<void> {
  const all = Array.from(connections.values());
  connections.clear();
  pending.clear();
  await Promise.allSettled(all.map((c) => c.close()));
}
