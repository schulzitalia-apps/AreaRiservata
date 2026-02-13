import mongoose, { type FilterQuery, type PipelineStage } from "mongoose";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { getAnagraficaModel } from "@/server-utils/models/Anagrafiche/anagrafiche.factory";
import { buildMongoAccessFilter } from "@/server-utils/access/access-engine";
import type { AuthContext } from "@/server-utils/lib/auth-context";
import type { IAnagraficaDoc } from "@/server-utils/models/Anagrafiche/anagrafica.schema";

/* --------------------------------- TYPES --------------------------------- */

export type StatoFatturazione =
  | "ipotizzato"
  | "programmato"
  | "fatturato"
  | "pagato"
  | "stornato"
  | string;

export type MoneySums = {
  lordo: number;
  netto: number;
  iva: number;
};

export type MonthRow = {
  month: string; // "YYYY-MM"
  byVariantId: Record<string, MoneySums>;
  totals: MoneySums;
};

export type TopRevenueItem = {
  id: string;
  variantId: string;

  titolo: string;
  cliente: string | null;
  statoFatturazione: StatoFatturazione;

  dataFatturazione: string | null; // ISO
  dataPagamento: string | null; // ISO

  effectiveDate: string | null; // ISO (pagamento > fatturazione)

  lordo: number; // totaleLordo
  netto: number; // totaleNetto
  iva: number; // importoIva

  numeroFattura?: string | null;
  categoriaRicavo?: string | null;
  provenienzaCliente?: string | null;
};

export type RicaviAnalyticsResponse = {
  range: {
    startMonth: string; // "YYYY-MM"
    endMonth: string; // "YYYY-MM"
    monthsBack: number;
  };
  variantIds: string[];
  months: MonthRow[];

  top: {
    paidOrInvoicedRecent: Record<string, TopRevenueItem[]>;
    programmatoRecent: Record<string, TopRevenueItem[]>;
    programmatoTop: Record<string, TopRevenueItem[]>;
    ipotizzatoUpcoming: Record<string, TopRevenueItem[]>;
  };
};

/* -------------------------------- HELPERS -------------------------------- */

function safeStr(x: any): string {
  if (x === null || x === undefined) return "";
  return String(x).trim();
}

function safeNum(x: any): number {
  const n = typeof x === "number" ? x : Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addMonthsUTC(d: Date, delta: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return new Date(Date.UTC(y, m + delta, 1, 0, 0, 0, 0));
}

function buildMonthRange(monthsBack: number) {
  const now = new Date();
  const end = startOfMonthUTC(now);
  const start = addMonthsUTC(end, -(Math.max(1, monthsBack) - 1));
  const endNext = addMonthsUTC(end, 1);

  return {
    start,
    endNext,
    startMonth: monthKey(start),
    endMonth: monthKey(end),
  };
}

function buildVisibleFilter(auth: AuthContext): FilterQuery<IAnagraficaDoc> {
  const access = buildMongoAccessFilter<IAnagraficaDoc>(auth, "ricavi") as any;
  return access && Object.keys(access).length ? (access as any) : ({} as any);
}

const TO_DOUBLE_SAFE = (expr: any) =>
  ({
    $convert: {
      input: {
        $let: {
          vars: { v: expr },
          in: {
            $cond: [
              { $or: [{ $eq: ["$$v", ""] }, { $eq: ["$$v", null] }] },
              null,
              {
                $replaceAll: {
                  input: { $toString: "$$v" },
                  find: ",",
                  replacement: ".",
                },
              },
            ],
          },
        },
      },
      to: "double",
      onError: 0,
      onNull: 0,
    },
  }) as const;

/**
 * SOLDI (non mescolare):
 * - lordo = totaleLordo
 * - netto = totaleNetto
 * - iva   = importoIva
 */
const MONEY_EXPR = {
  lordo: { $round: [TO_DOUBLE_SAFE({ $ifNull: ["$data.totaleLordo", 0] }), 0] },
  netto: { $round: [TO_DOUBLE_SAFE({ $ifNull: ["$data.totaleNetto", 0] }), 0] },
  iva: { $round: [TO_DOUBLE_SAFE({ $ifNull: ["$data.importoIva", 0] }), 0] },
} as const;

/**
 * stato:
 * - data.statoFatturazione se presente
 * - fallback su data.statoConsegna se ti arrivano stati “strani”
 * - se vuoto => ipotizzato
 */
const STATO_EXPR = {
  $let: {
    vars: {
      s: {
        $toString: {
          $ifNull: ["$data.statoFatturazione", { $ifNull: ["$data.statoConsegna", ""] }],
        },
      },
    },
    in: {
      $cond: [{ $eq: ["$$s", ""] }, "ipotizzato", "$$s"],
    },
  },
} as const;

/* -------------------------------- SERVICE -------------------------------- */

export async function getRicaviAnalytics(params: {
  auth: AuthContext;
  monthsBack?: number;
}): Promise<RicaviAnalyticsResponse> {
  const { auth, monthsBack = 24 } = params;

  await connectToDatabase();

  const Model =
    getAnagraficaModel("ricavi") as unknown as mongoose.Model<IAnagraficaDoc>;

  const { start, endNext, startMonth, endMonth } = buildMonthRange(monthsBack);
  const visibleFilter = buildVisibleFilter(auth);

  const now = new Date();
  const futureStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const futureEnd = addMonthsUTC(startOfMonthUTC(now), 12);

  const addFieldsStage: PipelineStage.AddFields = {
    $addFields: {
      __variantIdRaw: { $toString: { $ifNull: ["$data.variantId", ""] } },
      __stato: STATO_EXPR,

      __dataFatturazione: {
        $convert: { input: "$data.dataFatturazione", to: "date", onError: null, onNull: null },
      },
      __dataPagamento: {
        $convert: { input: "$data.dataPagamento", to: "date", onError: null, onNull: null },
      },

      __lordo: MONEY_EXPR.lordo,
      __netto: MONEY_EXPR.netto,
      __iva: MONEY_EXPR.iva,

      __titolo: {
        $toString: {
          $ifNull: [
            "$data.descrizione",
            {
              $ifNull: [
                "$data.numeroFattura",
                { $ifNull: ["$data.ragioneSocialeRicavo", { $ifNull: ["$data.clienteVendita", ""] }] },
              ],
            },
          ],
        },
      },

      __cliente: {
        $toString: {
          $ifNull: ["$data.clienteVendita", { $ifNull: ["$data.ragioneSocialeRicavo", ""] }],
        },
      },

      __numeroFattura: { $toString: { $ifNull: ["$data.numeroFattura", ""] } },
      __categoriaRicavo: { $toString: { $ifNull: ["$data.categoriaRicavo", ""] } },
      __provenienzaCliente: { $toString: { $ifNull: ["$data.provenienzaCliente", ""] } },
    },
  };

  const addVariantAndEffectiveStage: PipelineStage.AddFields = {
    $addFields: {
      __variantId: {
        $cond: [
          { $or: [{ $eq: ["$__variantIdRaw", ""] }, { $eq: ["$__variantIdRaw", null] }] },
          "unclassified",
          "$__variantIdRaw",
        ],
      },

      /**
       * effectiveDate (ricavi):
       * - se dataPagamento nel range => usa pagamento
       * - altrimenti se dataFatturazione nel range => usa fatturazione
       * - altrimenti null (fuori range)
       */
      __effectiveDate: {
        $cond: [
          {
            $and: [
              { $ne: ["$__dataPagamento", null] },
              { $gte: ["$__dataPagamento", start] },
              { $lt: ["$__dataPagamento", endNext] },
            ],
          },
          "$__dataPagamento",
          {
            $cond: [
              {
                $and: [
                  { $ne: ["$__dataFatturazione", null] },
                  { $gte: ["$__dataFatturazione", start] },
                  { $lt: ["$__dataFatturazione", endNext] },
                ],
              },
              "$__dataFatturazione",
              null,
            ],
          },
        ],
      },
    },
  };

  const baseMatchStage: PipelineStage.Match = {
    $match: {
      $and: [visibleFilter as any, { __stato: { $ne: "stornato" } }],
    } as any,
  };

  const pipeline: PipelineStage[] = [
    addFieldsStage,
    addVariantAndEffectiveStage,
    baseMatchStage,
    {
      $facet: {
        // ✅ DONUT + MONTHLY: tutti gli stati (dentro range)
        monthsAgg: [
          { $match: { __effectiveDate: { $ne: null } } as any },
          { $addFields: { __month: { $dateToString: { format: "%Y-%m", date: "$__effectiveDate" } } } },
          {
            $group: {
              _id: { month: "$__month", variantId: "$__variantId" },
              lordo: { $sum: "$__lordo" },
              netto: { $sum: "$__netto" },
              iva: { $sum: "$__iva" },
            },
          },
          { $sort: { "_id.month": 1, "_id.variantId": 1 } },
          {
            $project: {
              _id: 0,
              month: "$_id.month",
              variantId: "$_id.variantId",
              sums: {
                lordo: { $round: ["$lordo", 0] },
                netto: { $round: ["$netto", 0] },
                iva: { $round: ["$iva", 0] },
              },
            },
          },
        ],

        variants: [
          { $match: { __effectiveDate: { $ne: null } } as any },
          { $group: { _id: "$__variantId" } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, variantId: "$_id" } },
        ],

        // Top actuals recent (pagato/fatturato) dentro range
        topPaidOrInvoicedRecent: [
          { $match: { __effectiveDate: { $ne: null }, __stato: { $in: ["pagato", "fatturato"] } } as any },
          { $sort: { __effectiveDate: -1, updatedAt: -1 } },
          {
            $group: {
              _id: "$__variantId",
              items: {
                $push: {
                  id: { $toString: "$_id" },
                  titolo: "$__titolo",
                  cliente: { $cond: [{ $eq: ["$__cliente", ""] }, null, "$__cliente"] },
                  statoFatturazione: "$__stato",
                  dataFatturazione: "$__dataFatturazione",
                  dataPagamento: "$__dataPagamento",
                  effectiveDate: "$__effectiveDate",
                  lordo: "$__lordo",
                  netto: "$__netto",
                  iva: "$__iva",
                  numeroFattura: "$__numeroFattura",
                  categoriaRicavo: "$__categoriaRicavo",
                  provenienzaCliente: "$__provenienzaCliente",
                },
              },
            },
          },
          { $project: { _id: 0, variantId: "$_id", items: { $slice: ["$items", 5] } } },
          { $sort: { variantId: 1 } },
        ],

        topProgrammatoRecent: [
          { $match: { __stato: "programmato" } as any },
          { $sort: { __dataPagamento: -1, __dataFatturazione: -1, updatedAt: -1 } },
          {
            $group: {
              _id: "$__variantId",
              items: {
                $push: {
                  id: { $toString: "$_id" },
                  titolo: "$__titolo",
                  cliente: { $cond: [{ $eq: ["$__cliente", ""] }, null, "$__cliente"] },
                  statoFatturazione: "$__stato",
                  dataFatturazione: "$__dataFatturazione",
                  dataPagamento: "$__dataPagamento",
                  effectiveDate: "$__effectiveDate",
                  lordo: "$__lordo",
                  netto: "$__netto",
                  iva: "$__iva",
                  numeroFattura: "$__numeroFattura",
                  categoriaRicavo: "$__categoriaRicavo",
                  provenienzaCliente: "$__provenienzaCliente",
                },
              },
            },
          },
          { $project: { _id: 0, variantId: "$_id", items: { $slice: ["$items", 5] } } },
          { $sort: { variantId: 1 } },
        ],

        topProgrammatoTop: [
          { $match: { __stato: "programmato" } as any },
          { $sort: { __lordo: -1, updatedAt: -1 } },
          {
            $group: {
              _id: "$__variantId",
              items: {
                $push: {
                  id: { $toString: "$_id" },
                  titolo: "$__titolo",
                  cliente: { $cond: [{ $eq: ["$__cliente", ""] }, null, "$__cliente"] },
                  statoFatturazione: "$__stato",
                  dataFatturazione: "$__dataFatturazione",
                  dataPagamento: "$__dataPagamento",
                  effectiveDate: "$__effectiveDate",
                  lordo: "$__lordo",
                  netto: "$__netto",
                  iva: "$__iva",
                  numeroFattura: "$__numeroFattura",
                  categoriaRicavo: "$__categoriaRicavo",
                  provenienzaCliente: "$__provenienzaCliente",
                },
              },
            },
          },
          { $project: { _id: 0, variantId: "$_id", items: { $slice: ["$items", 5] } } },
          { $sort: { variantId: 1 } },
        ],

        // Upcoming ipotizzato (prossimi 12 mesi), data=pagamento || fatturazione
        topIpotizzatoUpcoming: [
          { $addFields: { __futureDate: { $ifNull: ["$__dataPagamento", "$__dataFatturazione"] } } },
          { $match: { __stato: "ipotizzato", __futureDate: { $gte: futureStart, $lt: futureEnd } } as any },
          { $sort: { __futureDate: 1, updatedAt: -1 } },
          {
            $group: {
              _id: "$__variantId",
              items: {
                $push: {
                  id: { $toString: "$_id" },
                  titolo: "$__titolo",
                  cliente: { $cond: [{ $eq: ["$__cliente", ""] }, null, "$__cliente"] },
                  statoFatturazione: "$__stato",
                  dataFatturazione: "$__dataFatturazione",
                  dataPagamento: "$__dataPagamento",
                  effectiveDate: "$__futureDate",
                  lordo: "$__lordo",
                  netto: "$__netto",
                  iva: "$__iva",
                  numeroFattura: "$__numeroFattura",
                  categoriaRicavo: "$__categoriaRicavo",
                  provenienzaCliente: "$__provenienzaCliente",
                },
              },
            },
          },
          { $project: { _id: 0, variantId: "$_id", items: { $slice: ["$items", 5] } } },
          { $sort: { variantId: 1 } },
        ],
      },
    },
  ];

  type VariantsRow = { variantId: string };
  type MonthAggRow = { month: string; variantId: string; sums: MoneySums };
  type TopAggRow = { variantId: string; items: any[] };

  const agg = await Model.aggregate<{
    variants: VariantsRow[];
    monthsAgg: MonthAggRow[];
    topPaidOrInvoicedRecent: TopAggRow[];
    topProgrammatoRecent: TopAggRow[];
    topProgrammatoTop: TopAggRow[];
    topIpotizzatoUpcoming: TopAggRow[];
  }>(pipeline);

  const first = agg?.[0] ?? {
    variants: [],
    monthsAgg: [],
    topPaidOrInvoicedRecent: [],
    topProgrammatoRecent: [],
    topProgrammatoTop: [],
    topIpotizzatoUpcoming: [],
  };

  const variantIds = (first.variants ?? [])
    .map((x) => safeStr((x as any).variantId))
    .filter(Boolean);

  const monthMap = new Map<string, MonthRow>();
  for (const row of first.monthsAgg ?? []) {
    const m = safeStr((row as any).month);
    const vid = safeStr((row as any).variantId);
    if (!m || !vid) continue;

    const sums: MoneySums = {
      lordo: Math.round(safeNum((row as any).sums?.lordo)),
      netto: Math.round(safeNum((row as any).sums?.netto)),
      iva: Math.round(safeNum((row as any).sums?.iva)),
    };

    const existing =
      monthMap.get(m) ??
      ({
        month: m,
        byVariantId: {},
        totals: { lordo: 0, netto: 0, iva: 0 },
      } as MonthRow);

    existing.byVariantId[vid] = sums;
    existing.totals.lordo += sums.lordo;
    existing.totals.netto += sums.netto;
    existing.totals.iva += sums.iva;

    monthMap.set(m, existing);
  }

  const months: MonthRow[] = [];
  {
    let cursor = startOfMonthUTC(new Date(start));
    const endCursor = startOfMonthUTC(new Date(endNext));
    while (cursor < endCursor) {
      const mk = monthKey(cursor);
      const existing =
        monthMap.get(mk) ??
        ({
          month: mk,
          byVariantId: {},
          totals: { lordo: 0, netto: 0, iva: 0 },
        } as MonthRow);
      months.push(existing);
      cursor = addMonthsUTC(cursor, 1);
    }
  }

  function normTop(vid: string, x: any): TopRevenueItem {
    const toIso = (d: any) => (d ? new Date(d).toISOString() : null);

    return {
      id: safeStr(x?.id),
      variantId: vid || "unclassified",

      titolo: safeStr(x?.titolo) || "Ricavo",
      cliente: safeStr(x?.cliente) || null,
      statoFatturazione: safeStr(x?.statoFatturazione) || "ipotizzato",

      dataFatturazione: toIso(x?.dataFatturazione),
      dataPagamento: toIso(x?.dataPagamento),
      effectiveDate: toIso(x?.effectiveDate),

      lordo: Math.round(safeNum(x?.lordo)),
      netto: Math.round(safeNum(x?.netto)),
      iva: Math.round(safeNum(x?.iva)),

      numeroFattura: safeStr(x?.numeroFattura) || null,
      categoriaRicavo: safeStr(x?.categoriaRicavo) || null,
      provenienzaCliente: safeStr(x?.provenienzaCliente) || null,
    };
  }

  function buildTopMap(rows: TopAggRow[] | undefined): Record<string, TopRevenueItem[]> {
    const out: Record<string, TopRevenueItem[]> = {};
    for (const row of rows ?? []) {
      const vid = safeStr((row as any).variantId) || "unclassified";
      out[vid] = ((row as any).items ?? []).map((x: any) => normTop(vid, x));
    }
    return out;
  }

  return {
    range: { startMonth, endMonth, monthsBack: Math.max(1, monthsBack) },
    variantIds,
    months,
    top: {
      paidOrInvoicedRecent: buildTopMap(first.topPaidOrInvoicedRecent),
      programmatoRecent: buildTopMap(first.topProgrammatoRecent),
      programmatoTop: buildTopMap(first.topProgrammatoTop),
      ipotizzatoUpcoming: buildTopMap(first.topIpotizzatoUpcoming),
    },
  };
}
