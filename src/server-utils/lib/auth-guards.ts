// src/server-utils/lib/auth-guards.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { AppRole } from "@/types/roles";
import type { AuthContext } from "./auth-context";
import { loadUserKeyScopes } from "@/server-utils/access/load-key-scopes";
import { RolesConfig } from "@/config/access/access-roles.config";

export async function requireAuth(
  req: NextRequest,
  opts?: { roles?: AppRole[] }
): Promise<
  | { ok: false; res: NextResponse }
  | { ok: true; token: any; auth: AuthContext }
> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return {
      ok: false,
      res: NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const role = token.role as AppRole | undefined;
  const userId = (token as any)?.id ?? (token as any)?.sub;

  if (!userId || !role) {
    return {
      ok: false,
      res: NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  // opzionale: filtro ruoli richiesti dalla route
  if (opts?.roles && !opts.roles.includes(role)) {
    return {
      ok: false,
      res: NextResponse.json(
        { message: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  // isAdmin derivato da RolesConfig (non hardcoded)
  const roleCfg = RolesConfig[role];
  const isAdmin = !!roleCfg?.isAdmin;

  // carichiamo le KEY solo per i non admin (se vuoi cambiare la policy, lo fai qui)
  let keyScopes: AuthContext["keyScopes"];
  if (!isAdmin) {
    keyScopes = await loadUserKeyScopes(userId);
  }

  const auth: AuthContext = {
    userId,
    role,
    isAdmin,
    keyScopes,
  };


  return { ok: true, token, auth };
}
