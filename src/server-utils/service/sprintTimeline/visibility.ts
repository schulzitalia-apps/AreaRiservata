import mongoose from "mongoose";

import type { AuthContext } from "@/server-utils/lib/auth-context";
import UserModel from "@/server-utils/models/User";
import UserResourceKeyModel from "@/server-utils/models/userResourceKey";

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  );
}

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function validObjectIds(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      values
        .map((id) => {
          if (!id) return null;
          const raw = String(id).trim();
          if (raw.includes("::")) return raw.split("::")[1];
          return raw;
        })
        .filter((id): id is string => !!id && mongoose.isValidObjectId(id)),
    ),
  );
}

function flattenViewerAnagraficaIds(auth: AuthContext) {
  const scopes = auth.keyScopes?.anagrafica ?? {};
  return new Set(
    Object.values(scopes)
      .flatMap((ids) => ids ?? [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
}

export type SprintTimelineVisibilityContext = {
  auth: AuthContext;
  viewerUserId: string;
  viewerAnagraficaIds: Set<string>;
  resolvedUserIdsByAnagraficaId: Record<string, string[]>;
  resolvedUserIdsByName: Record<string, string[]>;
  isScrumMaster: boolean;
};

export async function buildSprintTimelineVisibilityContext(args: {
  auth: AuthContext;
  referenceIds?: string[];
  actorNames?: string[];
}): Promise<SprintTimelineVisibilityContext> {
  const referenceIds = validObjectIds(args.referenceIds ?? []);
  const actorNames = uniqueStrings(args.actorNames ?? []);

  const [referenceLinks, namedUsers] = await Promise.all([
    referenceIds.length
      ? UserResourceKeyModel.find({
          scopeKind: "anagrafica",
          resourceId: {
            $in: referenceIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .select({ userId: 1, resourceId: 1 })
          .lean()
      : Promise.resolve([]),
    actorNames.length
      ? UserModel.find(
          {
            $or: [
              { name: { $in: actorNames } },
              { email: { $in: actorNames } },
            ],
          },
          { name: 1, email: 1 },
        ).lean()
      : Promise.resolve([]),
  ]);

  const resolvedUserIdsByAnagraficaId: Record<string, string[]> = {};
  for (const link of referenceLinks as Array<{ userId: any; resourceId: any }>) {
    const resourceId = String(link.resourceId);
    const userId = String(link.userId);
    if (!resolvedUserIdsByAnagraficaId[resourceId]) {
      resolvedUserIdsByAnagraficaId[resourceId] = [];
    }
    if (!resolvedUserIdsByAnagraficaId[resourceId]!.includes(userId)) {
      resolvedUserIdsByAnagraficaId[resourceId]!.push(userId);
    }
  }

  const resolvedUserIdsByName: Record<string, string[]> = {};
  for (const user of namedUsers as Array<{ _id: any; name?: string; email?: string }>) {
    const userId = String(user._id);
    const keys = uniqueStrings([user.name, user.email]).map(normalize);
    for (const key of keys) {
      if (!key) continue;
      if (!resolvedUserIdsByName[key]) {
        resolvedUserIdsByName[key] = [];
      }
      if (!resolvedUserIdsByName[key]!.includes(userId)) {
        resolvedUserIdsByName[key]!.push(userId);
      }
    }
  }

  return {
    auth: args.auth,
    viewerUserId: String(args.auth.userId),
    viewerAnagraficaIds: flattenViewerAnagraficaIds(args.auth),
    resolvedUserIdsByAnagraficaId,
    resolvedUserIdsByName,
    isScrumMaster: args.auth.isAdmin || args.auth.role === "Super",
  };
}

export function resolveUserIdsByAnagraficaId(
  context: SprintTimelineVisibilityContext,
  anagraficaId?: string | null,
) {
  if (!anagraficaId) return [];
  return context.resolvedUserIdsByAnagraficaId[String(anagraficaId)] ?? [];
}

export function resolveUserIdsByActorNames(
  context: SprintTimelineVisibilityContext,
  names?: string[],
) {
  return Array.from(
    new Set(
      (names ?? []).flatMap(
        (name) => context.resolvedUserIdsByName[normalize(name)] ?? [],
      ),
    ),
  );
}

export function viewerOwnsReference(
  context: SprintTimelineVisibilityContext,
  referenceId?: string | null,
) {
  if (!referenceId) return false;
  if (context.viewerAnagraficaIds.has(String(referenceId))) return true;
  return resolveUserIdsByAnagraficaId(context, referenceId).includes(
    context.viewerUserId,
  );
}

export function viewerMatchesResolvedUserIds(
  context: SprintTimelineVisibilityContext,
  userIds?: string[],
) {
  return (userIds ?? []).includes(context.viewerUserId);
}
