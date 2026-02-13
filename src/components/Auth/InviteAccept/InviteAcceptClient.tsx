"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Notice = { type: "success" | "error" | "info"; text: string } | null;

function InlineAlert({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const tone =
    notice.type === "success"
      ? "bg-green-50 border-green-500 text-green-800 dark:bg-green-900/30 dark:border-green-400 dark:text-green-100"
      : notice.type === "error"
        ? "bg-red-50 border-red-500 text-red-800 dark:bg-red-900/30 dark:border-red-400 dark:text-red-100"
        : "bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-100";

  return (
    <div className={`mb-3 rounded-lg border px-3 py-2 text-sm ${tone}`}>
      {notice.text}
    </div>
  );
}

function isStrongEnough(pw: string) {
  // semplice: almeno 8, una maiuscola, un numero
  if (pw.length < 8) return false;
  if (!/[A-Z]/.test(pw)) return false;
  if (!/[0-9]/.test(pw)) return false;
  return true;
}

export default function InviteAcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>({ type: "info", text: "Verifico invito…" });

  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "saving" | "done">(
    "checking",
  );
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const canSubmit = useMemo(() => {
    return (
      status === "ready" &&
      password.length > 0 &&
      password === password2 &&
      isStrongEnough(password)
    );
  }, [status, password, password2]);

  // 1) validate/consume invite (server)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/api/invitations/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.message || "Invito non valido o scaduto.");
        }

        if (cancelled) return;

        setInviteId(json.inviteId || null);
        setEmail(json.email || null);
        setNotice({ type: "success", text: "Invito valido. Imposta la tua password." });
        setStatus("ready");
      } catch (e: any) {
        if (cancelled) return;
        setNotice({ type: "error", text: e?.message || "Invito non valido." });
        setStatus("invalid");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSetPassword() {
    if (!canSubmit) return;

    setStatus("saving");
    setNotice({ type: "info", text: "Salvo password…" });

    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          inviteId,
          token,
          password,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Errore salvataggio password.");

      setNotice({ type: "success", text: "Password impostata. Ti reindirizzo…" });
      setStatus("done");

      // redirect dove vuoi
      router.replace("/login");
    } catch (e: any) {
      setNotice({ type: "error", text: e?.message || "Errore salvataggio password." });
      setStatus("ready");
    }
  }

  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-xl rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="border-b border-stroke p-4 dark:border-dark-3">
          <h1 className="text-base font-semibold text-dark dark:text-white">
            Attiva account
          </h1>
          <p className="mt-1 text-xs text-dark/60 dark:text-white/60">
            {email ? `Account: ${email}` : "Imposta la password per il tuo account."}
          </p>
        </div>

        <div className="p-4">
          <InlineAlert notice={notice} />

          {status === "invalid" ? (
            <div className="text-sm text-dark/70 dark:text-white/70">
              Questo link non è valido o è scaduto. Richiedi un nuovo invito.
            </div>
          ) : (
            <>
              <label className="block text-sm text-dark dark:text-white">
                Nuova password
                <input
                  className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={status !== "ready"}
                />
              </label>

              <label className="mt-3 block text-sm text-dark dark:text-white">
                Ripeti password
                <input
                  className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  autoComplete="new-password"
                  disabled={status !== "ready"}
                />
              </label>

              <div className="mt-2 text-xs text-dark/60 dark:text-white/60">
                Requisiti minimi: 8 caratteri, 1 maiuscola, 1 numero.
                {password && !isStrongEnough(password) ? (
                  <span className="ml-2 text-red-600 dark:text-red-300">
                    Password troppo debole.
                  </span>
                ) : null}
                {password2 && password !== password2 ? (
                  <span className="ml-2 text-red-600 dark:text-red-300">
                    Le password non coincidono.
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleSetPassword}
                disabled={!canSubmit}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-blue-light"
              >
                {status === "saving" ? "Salvo…" : "Imposta password"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
