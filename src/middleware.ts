import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { AppRole } from "@/types/roles";

const PUBLIC_PATHS = [
  "/auth/sign-in",
  "/login",
  "/invito",
  "/activate",
  "/api/auth",
  "/api/invitations/consume",
  "/api/auth/set-password",
  "/api/meta-whatsapp-webhook",
  "/api/twilio-webhook",
];


function deny(req: NextRequest, to = "/auth/sign-in") {
  const url = req.nextUrl.clone();
  url.pathname = to;
  url.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ pubbliche
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 🔒 protezione standard (vale per Pagine e API)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = (token?.role ?? "") as AppRole | "";

  if (!token) return deny(req, "/auth/sign-in");

  if (pathname.startsWith("/admin")) {
    if (role !== "Super" && role !== "Amministrazione") {
      return NextResponse.rewrite(new URL("/403", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
