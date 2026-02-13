// src/app/login/page.tsx (o dove hai definito SignIn)
// ⚠️ questo file deve essere un Server Component (di default lo è, basta non mettere "use client")

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server-utils/lib/auth-options";

import Signin from "@/components/Auth/Signin";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { platformConfig } from "@/config/platform.config";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignInPage() {
  const session = await getServerSession(authOptions);

  // 👇 se utente autenticato, mandalo dove vuoi (dashboard, home, ecc.)
  if (session?.user?.id) {
    redirect("/"); // o "/dashboard" ecc.
  }

  // se non autenticato, mostra la pagina di login
  return (
    <>
      <Breadcrumb pageName={platformConfig.breadcrumbSignIn} />
      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="flex flex-wrap items-center">
          <div className="w-full xl:w-1/2">
            <div className="w-full p-4 sm:p-12.5 xl:p-15">
              <Signin />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
