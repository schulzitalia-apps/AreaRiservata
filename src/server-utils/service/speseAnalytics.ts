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
  // possono arrivare anche stati da statoConsegna (es. "ordinato")
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

export type TopExpenseItem = {
  id: string;
  variantId: string;
  titolo: string;
  fornitore: string | null;
  statoFatturazione: StatoFatturazione;

  dataSpesa: string | null; // ISO
  dataFatturazione: string | null; // ISO
  effectiveDate: string | null; // ISO (scelta: spesa se nel range, else fatturazione se nel range)

  lordo: number; // totaleLordo
  netto: number; // totaleNetto
  iva: number;   // importoIva
};

export type SpeseAnalyticsResponse = {
  range: {
    startMonth: string; // "YYYY-MM"
    endMonth: string; // "YYYY-MM"
    monthsBack: number;
  };
  variantIds: string[];
  months: MonthRow[];

  top: {
    paidOrInvoicedRecent: Record<string, TopExpenseItem[]>;
    programmatoRecent: Record<string, TopExpenseItem[]>;
    programmatoTop: Record<string, TopExpenseItem[]>;
    ipotizzatoUpcoming: Record<string, TopExpenseItem[]>;
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
  const access = buildMongoAccessFilter<IAnagraficaDoc>(auth, "spese") as any;
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
 * - altrimenti data.statoConsegna
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

export async function getSpeseAnalytics(params: {
  auth: AuthContext;
  monthsBack?: number;
}): Promise<SpeseAnalyticsResponse> {
  const { auth, monthsBack = 24 } = params;

  await connectToDatabase();

  const Model =
    getAnagraficaModel("spese") as unknown as mongoose.Model<IAnagraficaDoc>;

  const { start, endNext, startMonth, endMonth } = buildMonthRange(monthsBack);
  const visibleFilter = buildVisibleFilter(auth);

  const now = new Date();
  const futureStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const futureEnd = addMonthsUTC(startOfMonthUTC(now), 12);

  const addFieldsStage: PipelineStage.AddFields = {
    $addFields: {
      __variantIdRaw: { $toString: { $ifNull: ["$data.variantId", ""] } },
      __stato: STATO_EXPR,

      __dataSpesa: { $convert: { input: "$data.dataSpesa", to: "date", onError: null, onNull: null } },
      __dataFatturazione: { $convert: { input: "$data.dataFatturazione", to: "date", onError: null, onNull: null } },

      __lordo: MONEY_EXPR.lordo,
      __netto: MONEY_EXPR.netto,
      __iva: MONEY_EXPR.iva,

      __titolo: {
        $toString: { $ifNull: ["$data.descrizioneSpesa", { $ifNull: ["$data.descrizione", { $ifNull: ["$data.titolo", ""] }] }] },
      },

      __fornitore: {
        $toString: { $ifNull: ["$data.fornitore", ""] },
      },
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

      // scegli dataSpesa se nel range, altrimenti dataFatturazione se nel range, altrimenti null
      __effectiveDate: {
        $cond: [
          {
            $and: [
              { $ne: ["$__dataSpesa", null] },
              { $gte: ["$__dataSpesa", start] },
              { $lt: ["$__dataSpesa", endNext] },
            ],
          },
          "$__dataSpesa",
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
      $and: [
        visibleFilter as any,
        { __stato: { $ne: "stornato" } },
      ],
    } as any,
  };

  const pipeline: PipelineStage[] = [
    addFieldsStage,
    addVariantAndEffectiveStage,
    baseMatchStage,
    {
      $facet: {
        // ✅ DONUT + MONTHLY: TUTTI GLI STATI (dentro range)
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

        // TOP actuals recent (se vuoi: solo pagato/fatturato)
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
                  fornitore: { $cond: [{ $eq: ["$__fornitore", ""] }, null, "$__fornitore"] },
                  statoFatturazione: "$__stato",
                  dataSpesa: "$__dataSpesa",
                  dataFatturazione: "$__dataFatturazione",
                  effectiveDate: "$__effectiveDate",
                  lordo: "$__lordo",
                  netto: "$__netto",
                  iva: "$__iva",
                },
              },
            },
          },
          { $project: { _id: 0, variantId: "$_id", items: { $slice: ["$items", 5] } } },
          { $sort: { variantId: 1 } },
        ],

        topProgrammatoRecent: [
          { $match: { __stato: "programmato" } as any },
          { $sort: { __dataSpesa: -1, __dataFatturazione: -1, updatedAt: -1 } },
          {
            $group: {
              _id: "$__variantId",
              items: {
                $push: {
                  id: { $toString: "$_id" },
                  titolo: "$__titolo",
                  fornitore: { $cond: [{ $eq: ["$__fornitore", ""] }, null, "$__fornitore"] },
                  statoFatturazione: "$__stato",
                  dataSpesa: "$__dataSpesa",
                  dataFatturazione: "$__dataFatturazione",
                  effectiveDate: "$__effectiveDate",
                  lordo: "$__lordo",
                  netto: "$__netto",
                  iva: "$__iva",
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
                  fornitore: { $cond: [{ $eq: ["$__fornitore", ""] }, null, "$__fornitore"] },
                  statoFatturazione: "$__stato",
                  dataSpesa: "$__dataSpesa",
                  dataFatturazione: "$__dataFatturazione",
                  effectiveDate: "$__effectiveDate",
                  lordo: "$__lordo",
                  netto: "$__netto",
                  iva: "$__iva",
                },
              },
            },
          },
          { $project: { _id: 0, variantId: "$_id", items: { $slice: ["$items", 5] } } },
          { $sort: { variantId: 1 } },
        ],

        topIpotizzatoUpcoming: [
          { $addFields: { __futureDate: { $ifNull: ["$__dataSpesa", "$__dataFatturazione"] } } },
          { $match: { __stato: "ipotizzato", __futureDate: { $gte: futureStart, $lt: futureEnd } } as any },
          { $sort: { __futureDate: 1, updatedAt: -1 } },
          {
            $group: {
              _id: "$__variantId",
              items: {
                $push: {
                  id: { $toString: "$_id" },
                  titolo: "$__titolo",
                  fornitore: { $cond: [{ $eq: ["$__fornitore", ""] }, null, "$__fornitore"] },
                  statoFatturazione: "$__stato",
                  dataSpesa: "$__dataSpesa",
                  dataFatturazione: "$__dataFatturazione",
                  effectiveDate: "$__futureDate",
                  lordo: "$__lordo",
                  netto: "$__netto",
                  iva: "$__iva",
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

  function normTop(vid: string, x: any): TopExpenseItem {
    const toIso = (d: any) => (d ? new Date(d).toISOString() : null);

    return {
      id: safeStr(x?.id),
      variantId: vid || "unclassified",
      titolo: safeStr(x?.titolo) || "Spesa",
      fornitore: safeStr(x?.fornitore) || null,
      statoFatturazione: safeStr(x?.statoFatturazione) || "ipotizzato",
      dataSpesa: toIso(x?.dataSpesa),
      dataFatturazione: toIso(x?.dataFatturazione),
      effectiveDate: toIso(x?.effectiveDate),
      lordo: Math.round(safeNum(x?.lordo)),
      netto: Math.round(safeNum(x?.netto)),
      iva: Math.round(safeNum(x?.iva)),
    };
  }

  function buildTopMap(rows: TopAggRow[] | undefined): Record<string, TopExpenseItem[]> {
    const out: Record<string, TopExpenseItem[]> = {};
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
