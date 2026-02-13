import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server-utils/lib/auth-options";
import InviteAcceptClient from "@/components/Auth/InviteAccept/InviteAcceptClient";

export const metadata: Metadata = {
  title: "Attiva account",
};

type SearchParams = {
  token?: string | string[];
};

export default async function InvitePage({
                                           searchParams,
                                         }: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const sp = await searchParams;

  const rawToken = sp?.token;
  const token = Array.isArray(rawToken) ? rawToken[0]?.trim() : rawToken?.trim();

  if (!token) {
    return (
      <div className="p-6">
        <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <h1 className="text-base font-semibold text-dark dark:text-white">
            Link non valido
          </h1>
          <p className="mt-2 text-sm text-dark/70 dark:text-white/70">
            Manca il token di invito.
          </p>
        </div>
      </div>
    );
  }

  return <InviteAcceptClient token={token} />;
}
