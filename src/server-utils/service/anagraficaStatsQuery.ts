import mongoose, { type FilterQuery, type PipelineStage } from "mongoose";
import { connectToDatabase } from "../lib/mongoose-connection";
import { getAnagraficaModel } from "../models/Anagrafiche/anagrafiche.factory";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import { buildMongoAccessFilter } from "@/server-utils/access/access-engine";
import type { AuthContext } from "@/server-utils/lib/auth-context";
import type { IAnagraficaDoc } from "@/server-utils/models/Anagrafiche/anagrafica.schema";

export type StatsKind = "select" | "date" | "number";

export type SelectStats = {
  kind: "select";
  fieldKey: string;
  totalAll: number;
  missingCount: number;
  totalValid: number;
  data: {
    counts: { value: string; count: number }[];
    myValue: string;
    myCount: number;
    myPercent: number;
    othersCount: number;
    othersPercent: number;
  };
};

export type DateStats = {
  kind: "date";
  fieldKey: string;
  totalAll: number;
  missingCount: number;
  totalValid: number;
  data: {
    pivotIso: string;
    beforeCount: number;
    afterCount: number;
    equalCount: number;
  };
};

export type NumberStats = {
  kind: "number";
  fieldKey: string;
  totalAll: number;
  missingCount: number;
  totalValid: number;
  data: {
    pivot: number;
    lessCount: number;
    greaterCount: number;
    equalCount: number;
    avg: number | null;
  };
};

export type FieldStatsResponse = SelectStats | DateStats | NumberStats;

function percent(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 10000) / 100; // 2 decimali
}

function buildVisibleFilter(
  auth: AuthContext,
  slug: AnagraficaTypeSlug,
): FilterQuery<IAnagraficaDoc> {
  const access = buildMongoAccessFilter<IAnagraficaDoc>(auth, slug) as any;
  return access && Object.keys(access).length ? (access as any) : ({} as any);
}

function missingExpr(fieldPath: string): FilterQuery<IAnagraficaDoc> {
  return {
    $or: [
      { [fieldPath]: { $exists: false } },
      { [fieldPath]: null },
      { [fieldPath]: "" },
    ],
  } as any;
}

function validExpr(fieldPath: string): FilterQuery<IAnagraficaDoc> {
  return { [fieldPath]: { $exists: true, $nin: [null, ""] } } as any;
}

/**
 * Stats ACL-aware su un campo (select/date/number).
 * Il kind NON viene preso dal client: lo deduciamo dal registry.
 */
export async function getAnagraficaFieldStats(params: {
  type: string;
  fieldKey: string;
  pivot: unknown;
  auth: AuthContext;
}): Promise<FieldStatsResponse> {
  const { type, fieldKey, pivot, auth } = params;

  await connectToDatabase();

  const slug = type as AnagraficaTypeSlug;
  const def = getAnagraficaDef(slug);

  const fieldDef = (def.fields as any)?.[fieldKey] as
    | { type: string; label?: string }
    | undefined;

  if (!fieldDef) throw new Error("FIELD_NOT_FOUND");

  const kind = fieldDef.type as StatsKind;
  if (kind !== "select" && kind !== "date" && kind !== "number") {
    throw new Error("FIELD_KIND_NOT_SUPPORTED");
  }

  // 🔧 qui è il punto che risolve un sacco di overload TS da factory
  const Model = getAnagraficaModel(slug) as unknown as mongoose.Model<IAnagraficaDoc>;

  const visibleFilter = buildVisibleFilter(auth, slug);
  const fieldPath = `data.${fieldKey}`;

  const totalAll = await Model.countDocuments(visibleFilter);
  const missingCount = await Model.countDocuments({
    $and: [visibleFilter, missingExpr(fieldPath)],
  } as any);
  const totalValid = Math.max(0, totalAll - missingCount);

  if (kind === "select") {
    const myValue =
      pivot === null || pivot === undefined ? "" : String(pivot);

    const pipeline: PipelineStage[] = [
      { $match: visibleFilter as any },
      { $match: validExpr(fieldPath) as any },
      {
        $group: {
          _id: `$${fieldPath}`,
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ];

    const groups = await Model.aggregate<{ _id: any; count: number }>(pipeline);

    const counts = groups
      .map((g) => ({
        value: g._id === null || g._id === undefined ? "" : String(g._id),
        count: Number(g.count || 0),
      }))
      .filter((x) => x.value !== "");

    const myCount = counts.find((c) => c.value === myValue)?.count ?? 0;

    const myPercent = percent(myCount, totalValid);
    const othersCount = Math.max(0, totalValid - myCount);
    const othersPercent = Math.round((100 - myPercent) * 100) / 100;

    return {
      kind: "select",
      fieldKey,
      totalAll,
      missingCount,
      totalValid,
      data: {
        counts,
        myValue,
        myCount,
        myPercent,
        othersCount,
        othersPercent,
      },
    };
  }

  if (kind === "date") {
    const pivotDate = new Date(String(pivot ?? ""));
    if (Number.isNaN(pivotDate.getTime())) {
      throw new Error("PIVOT_INVALID_DATE");
    }

    const pipeline: PipelineStage[] = [
      { $match: visibleFilter as any },
      {
        $addFields: {
          __d: {
            $convert: {
              input: `$${fieldPath}`,
              to: "date",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          missingCount: {
            $sum: { $cond: [{ $eq: ["$__d", null] }, 1, 0] },
          },
          beforeCount: {
            $sum: { $cond: [{ $lt: ["$__d", pivotDate] }, 1, 0] },
          },
          afterCount: {
            $sum: { $cond: [{ $gt: ["$__d", pivotDate] }, 1, 0] },
          },
          equalCount: {
            $sum: { $cond: [{ $eq: ["$__d", pivotDate] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          missingCount: 1,
          beforeCount: 1,
          afterCount: 1,
          equalCount: 1,
        },
      },
    ];

    const out = await Model.aggregate<{
      missingCount: number;
      beforeCount: number;
      afterCount: number;
      equalCount: number;
    }>(pipeline);

    const row = out[0] ?? {
      missingCount: 0,
      beforeCount: 0,
      afterCount: 0,
      equalCount: 0,
    };

    const totalValidDate = Math.max(0, totalAll - row.missingCount);

    return {
      kind: "date",
      fieldKey,
      totalAll,
      missingCount: row.missingCount,
      totalValid: totalValidDate,
      data: {
        pivotIso: pivotDate.toISOString(),
        beforeCount: row.beforeCount,
        afterCount: row.afterCount,
        equalCount: row.equalCount,
      },
    };
  }

  // kind === "number"
  const pivotNum = typeof pivot === "number" ? pivot : Number(pivot);
  if (!Number.isFinite(pivotNum)) throw new Error("PIVOT_INVALID_NUMBER");

  const pipeline: PipelineStage[] = [
    { $match: visibleFilter as any },
    {
      $addFields: {
        __n: {
          $convert: {
            input: `$${fieldPath}`,
            to: "double",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        missingCount: {
          $sum: { $cond: [{ $eq: ["$__n", null] }, 1, 0] },
        },
        lessCount: {
          $sum: { $cond: [{ $lt: ["$__n", pivotNum] }, 1, 0] },
        },
        greaterCount: {
          $sum: { $cond: [{ $gt: ["$__n", pivotNum] }, 1, 0] },
        },
        equalCount: {
          $sum: { $cond: [{ $eq: ["$__n", pivotNum] }, 1, 0] },
        },
        avg: { $avg: "$__n" },
      },
    },
    {
      $project: {
        _id: 0,
        missingCount: 1,
        lessCount: 1,
        greaterCount: 1,
        equalCount: 1,
        avg: 1,
      },
    },
  ];

  const out = await Model.aggregate<{
    missingCount: number;
    lessCount: number;
    greaterCount: number;
    equalCount: number;
    avg: number | null;
  }>(pipeline);

  const row = out[0] ?? {
    missingCount: 0,
    lessCount: 0,
    greaterCount: 0,
    equalCount: 0,
    avg: null as number | null,
  };

  const totalValidNum = Math.max(0, totalAll - row.missingCount);

  return {
    kind: "number",
    fieldKey,
    totalAll,
    missingCount: row.missingCount,
    totalValid: totalValidNum,
    data: {
      pivot: pivotNum,
      lessCount: row.lessCount,
      greaterCount: row.greaterCount,
      equalCount: row.equalCount,
      avg:
        row.avg === null || row.avg === undefined
          ? null
          : Math.round(row.avg * 100) / 100,
    },
  };
}
