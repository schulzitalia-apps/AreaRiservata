import mongoose, { type FilterQuery, type PipelineStage } from "mongoose";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { getAnagraficaModel } from "@/server-utils/models/Anagrafiche/anagrafiche.factory";
import { buildMongoAccessFilter } from "@/server-utils/access/access-engine";
import type { AuthContext } from "@/server-utils/lib/auth-context";
import type { IAnagraficaDoc } from "@/server-utils/models/Anagrafiche/anagrafica.schema";

/* --------------------------------- TYPES --------------------------------- */

export type StatoAvanzamento = string;

export type ValueSums = {
  valore: number;
};

export type MonthRow = {
  month: string; // "YYYY-MM"
  byVariantId: Record<string, ValueSums>;
  totals: ValueSums;
};

export type TopOrderItem = {
  id: string;
  variantId: string;

  riferimento: string;
  codiceCliente: string | null;

  numeroOrdine: string | null;
  statoAvanzamento: StatoAvanzamento;

  inizioConsegna: string | null; // ISO
  fineConsegna: string | null;   // ISO
  effectiveDate: string | null;  // ISO (fine > inizio)

  valore: number; // valoreCommessa
};

export type ConfermeOrdineAnalyticsResponse = {
  range: {
    startMonth: string; // "YYYY-MM"
    endMonth: string;   // "YYYY-MM"
    monthsBack: number;
  };
  variantIds: string[];
  months: MonthRow[];

  top: {
    recent: Record<string, TopOrderItem[]>;
    upcoming: Record<string, TopOrderItem[]>;
    topValue: Record<string, TopOrderItem[]>;
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
  const access = buildMongoAccessFilter<IAnagraficaDoc>(auth, "conferme-ordine") as any;
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

/* -------------------------------- SERVICE -------------------------------- */

export async function getConfermeOrdineAnalytics(params: {
  auth: AuthContext;
  monthsBack?: number;
}): Promise<ConfermeOrdineAnalyticsResponse> {
  const { auth, monthsBack = 24 } = params;

  await connectToDatabase();

  const Model =
    getAnagraficaModel("conferme-ordine") as unknown as mongoose.Model<IAnagraficaDoc>;

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

      __stato: {
        $let: {
          vars: { s: { $toString: { $ifNull: ["$data.statoAvanzamento", ""] } } },
          in: { $cond: [{ $eq: ["$$s", ""] }, "da_definire", "$$s"] },
        },
      },

      __inizio: {
        $convert: { input: "$data.inizioConsegna", to: "date", onError: null, onNull: null },
      },
      __fine: {
        $convert: { input: "$data.fineConsegna", to: "date", onError: null, onNull: null },
      },

      __valore: { $round: [TO_DOUBLE_SAFE({ $ifNull: ["$data.valoreCommessa", 0] }), 0] },

      __riferimento: { $toString: { $ifNull: ["$data.riferimento", ""] } },
      __codiceCliente: { $toString: { $ifNull: ["$data.codiceCliente", ""] } },
      __numeroOrdine: { $toString: { $ifNull: ["$data.numeroOrdine", ""] } },
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
       * effectiveDate (conferme-ordine):
       * - se fineConsegna nel range => fine
       * - else se inizioConsegna nel range => inizio
       * - else null
       */
      __effectiveDate: {
        $cond: [
          {
            $and: [
              { $ne: ["$__fine", null] },
              { $gte: ["$__fine", start] },
              { $lt: ["$__fine", endNext] },
            ],
          },
          "$__fine",
          {
            $cond: [
              {
                $and: [
                  { $ne: ["$__inizio", null] },
                  { $gte: ["$__inizio", start] },
                  { $lt: ["$__inizio", endNext] },
                ],
              },
              "$__inizio",
              null,
            ],
          },
        ],
      },

      /**
       * futureDate (upcoming):
       * - preferisci inizio, fallback fine
       */
      __futureDate: { $ifNull: ["$__inizio", "$__fine"] },
    },
  };

  const baseMatchStage: PipelineStage.Match = {
    $match: { $and: [visibleFilter as any] } as any,
  };

  const pipeline: PipelineStage[] = [
    addFieldsStage,
    addVariantAndEffectiveStage,
    baseMatchStage,
    {
      $facet: {
        // MONTHLY: record che hanno effectiveDate nel range
        monthsAgg: [
          { $match: { __effectiveDate: { $ne: null } } as any },
          { $addFields: { __month: { $dateToString: { format: "%Y-%m", date: "$__effectiveDate" } } } },
          {
            $group: {
              _id: { month: "$__month", variantId: "$__variantId" },
              valore: { $sum: "$__valore" },
            },
          },
          { $sort: { "_id.month": 1, "_id.variantId": 1 } },
          {
            $project: {
              _id: 0,
              month: "$_id.month",
              variantId: "$_id.variantId",
              sums: { valore: { $round: ["$valore", 0] } },
            },
          },
        ],

        variants: [
          { $match: { __effectiveDate: { $ne: null } } as any },
          { $group: { _id: "$__variantId" } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, variantId: "$_id" } },
        ],

        // TOP recent: ordini con effectiveDate nel range, più recenti
        topRecent: [
          { $match: { __effectiveDate: { $ne: null } } as any },
          { $sort: { __effectiveDate: -1, updatedAt: -1 } },
          {
            $group: {
              _id: "$__variantId",
              items: {
                $push: {
                  id: { $toString: "$_id" },
                  riferimento: "$__riferimento",
                  codiceCliente: { $cond: [{ $eq: ["$__codiceCliente", ""] }, null, "$__codiceCliente"] },
                  numeroOrdine: { $cond: [{ $eq: ["$__numeroOrdine", ""] }, null, "$__numeroOrdine"] },
                  statoAvanzamento: "$__stato",
                  inizioConsegna: "$__inizio",
                  fineConsegna: "$__fine",
                  effectiveDate: "$__effectiveDate",
                  valore: "$__valore",
                },
              },
            },
          },
          { $project: { _id: 0, variantId: "$_id", items: { $slice: ["$items", 5] } } },
          { $sort: { variantId: 1 } },
        ],

        // TOP upcoming: prossimi 12 mesi (in base a __futureDate)
        topUpcoming: [
          { $match: { __futureDate: { $ne: null, $gte: futureStart, $lt: futureEnd } } as any },
          { $sort: { __futureDate: 1, updatedAt: -1 } },
          {
            $group: {
              _id: "$__variantId",
              items: {
                $push: {
                  id: { $toString: "$_id" },
                  riferimento: "$__riferimento",
                  codiceCliente: { $cond: [{ $eq: ["$__codiceCliente", ""] }, null, "$__codiceCliente"] },
                  numeroOrdine: { $cond: [{ $eq: ["$__numeroOrdine", ""] }, null, "$__numeroOrdine"] },
                  statoAvanzamento: "$__stato",
                  inizioConsegna: "$__inizio",
                  fineConsegna: "$__fine",
                  effectiveDate: "$__futureDate",
                  valore: "$__valore",
                },
              },
            },
          },
          { $project: { _id: 0, variantId: "$_id", items: { $slice: ["$items", 5] } } },
          { $sort: { variantId: 1 } },
        ],

        // TOP by value: più grandi (nel range o globali? qui: globali visibili)
        topValue: [
          { $sort: { __valore: -1, updatedAt: -1 } },
          {
            $group: {
              _id: "$__variantId",
              items: {
                $push: {
                  id: { $toString: "$_id" },
                  riferimento: "$__riferimento",
                  codiceCliente: { $cond: [{ $eq: ["$__codiceCliente", ""] }, null, "$__codiceCliente"] },
                  numeroOrdine: { $cond: [{ $eq: ["$__numeroOrdine", ""] }, null, "$__numeroOrdine"] },
                  statoAvanzamento: "$__stato",
                  inizioConsegna: "$__inizio",
                  fineConsegna: "$__fine",
                  effectiveDate: "$__effectiveDate",
                  valore: "$__valore",
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
  type MonthAggRow = { month: string; variantId: string; sums: ValueSums };
  type TopAggRow = { variantId: string; items: any[] };

  const agg = await Model.aggregate<{
    variants: VariantsRow[];
    monthsAgg: MonthAggRow[];
    topRecent: TopAggRow[];
    topUpcoming: TopAggRow[];
    topValue: TopAggRow[];
  }>(pipeline);

  const first = agg?.[0] ?? {
    variants: [],
    monthsAgg: [],
    topRecent: [],
    topUpcoming: [],
    topValue: [],
  };

  const variantIds = (first.variants ?? [])
    .map((x) => safeStr((x as any).variantId))
    .filter(Boolean);

  // months map
  const monthMap = new Map<string, MonthRow>();
  for (const row of first.monthsAgg ?? []) {
    const m = safeStr((row as any).month);
    const vid = safeStr((row as any).variantId);
    if (!m || !vid) continue;

    const sums: ValueSums = { valore: Math.round(safeNum((row as any).sums?.valore)) };

    const existing =
      monthMap.get(m) ??
      ({
        month: m,
        byVariantId: {},
        totals: { valore: 0 },
      } as MonthRow);

    existing.byVariantId[vid] = sums;
    existing.totals.valore += sums.valore;

    monthMap.set(m, existing);
  }

  // ensure all months present
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
          totals: { valore: 0 },
        } as MonthRow);
      months.push(existing);
      cursor = addMonthsUTC(cursor, 1);
    }
  }

  function normTop(vid: string, x: any): TopOrderItem {
    const toIso = (d: any) => (d ? new Date(d).toISOString() : null);

    return {
      id: safeStr(x?.id),
      variantId: vid || "unclassified",

      riferimento: safeStr(x?.riferimento) || "Conferma d'ordine",
      codiceCliente: safeStr(x?.codiceCliente) || null,

      numeroOrdine: safeStr(x?.numeroOrdine) || null,
      statoAvanzamento: safeStr(x?.statoAvanzamento) || "da_definire",

      inizioConsegna: toIso(x?.inizioConsegna),
      fineConsegna: toIso(x?.fineConsegna),
      effectiveDate: toIso(x?.effectiveDate),

      valore: Math.round(safeNum(x?.valore)),
    };
  }

  function buildTopMap(rows: TopAggRow[] | undefined): Record<string, TopOrderItem[]> {
    const out: Record<string, TopOrderItem[]> = {};
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
      recent: buildTopMap(first.topRecent),
      upcoming: buildTopMap(first.topUpcoming),
      topValue: buildTopMap(first.topValue),
    },
  };
}