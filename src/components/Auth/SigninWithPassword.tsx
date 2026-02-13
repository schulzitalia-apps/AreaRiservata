"use client";
import { EmailIcon, PasswordIcon } from "@/assets/icons";
import Link from "next/link";
import React, { useState } from "react";
import InputGroup from "../FormElements/InputGroup";
import { Checkbox } from "../FormElements/checkbox";

// 1. Importa signIn da next-auth/react
import { signIn } from "next-auth/react";
// 2. Importa useRouter per il reindirizzamento (dall'App Router di Next.vector-maps)
import { useRouter } from "next/navigation";

// 3. Importa la config di piattaforma per generalizzare la route di redirect
import { platformConfig } from "@/config/platform.config";

export default function SigninWithPassword() {
  const [data, setData] = useState({
    email: process.env.NEXT_PUBLIC_DEMO_USER_MAIL || "",
    password: process.env.NEXT_PUBLIC_DEMO_USER_PASS || "",
    remember: false,
  });

  const [loading, setLoading] = useState(false);
  // 4. Stato per gestire i messaggi di errore dal login
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({
      ...data,
      [e.target.name]: e.target.value,
    });
  };

  // 5. Funzione handleSubmit che usa NextAuth
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null); // Resetta gli errori precedenti ad ogni nuovo tentativo

    try {
      // Chiama la funzione signIn di NextAuth per il provider 'credentials'
      const result = await signIn("credentials", {
        // Non reindirizzare automaticamente, gestiamo noi la risposta
        redirect: false,
        email: data.email,
        password: data.password,
        // Il campo 'remember: mock.remember' non è uno standard per signIn con 'credentials'
        // per modificare la durata della sessione. La durata della sessione è gestita
        // globalmente nella configurazione di NextAuth (session.maxAge o opzioni cookie).
      });

      setLoading(false);

      if (result?.error) {
        // Se c'è un errore (es. credenziali errate, utente non approvato),
        // NextAuth lo restituisce in result.error.
        // Questi sono i messaggi che hai lanciato con `throw new Error(...)`
        // nella tua funzione `authorize`.
        setError(result.error);
      } else if (result?.ok && !result?.error) {
        // Login riuscito: reindirizza usando la route definita in config
        console.log("Login riuscito! Reindirizzando...");

        router.push(platformConfig.signInRedirectPath);
      } else {
        // Caso inaspettato
        setError("Si è verificato un errore sconosciuto durante il login.");
      }
    } catch (err) {
      // Questo blocco catch gestisce errori di rete o altre eccezioni
      // che potrebbero verificarsi durante la chiamata a signIn stessa.
      console.error("Errore imprevisto durante il tentativo di signIn:", err);
      setError("Impossibile connettersi al server. Riprova più tardi.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* 6. Mostra il messaggio di errore, se presente */}
      {error && (
        <div className="mb-4 rounded-md border border-red-400 bg-red-100 p-3 text-center text-sm text-red-700">
          {error}
        </div>
      )}

      <InputGroup
        type="email"
        label="Email"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="Inserisci la tua email"
        name="email"
        handleChange={handleChange}
        value={data.email}
        icon={<EmailIcon />}
      />

      <InputGroup
        type="password"
        label="Password"
        className="mb-5 [&_input]:py-[15px]"
        placeholder="Inserisci la tua password"
        name="password"
        handleChange={handleChange}
        value={data.password}
        icon={<PasswordIcon />}
      />

      <div className="mb-6 flex items-center justify-between gap-2 py-2 font-medium">
        <Checkbox
          label="Ricordami"
          name="remember"
          withIcon="check"
          minimal
          radius="md"
          checked={data.remember}
          onChange={(e) =>
            setData({
              ...data,
              remember: e.currentTarget.checked,
            })
          }
        />

        <Link
          href="/auth/forgot-password"
          className="hover:text-primary dark:text-white dark:hover:text-primary"
        >
          Hai dimenticato la password?
        </Link>
      </div>

      <div className="mb-4.5">
        <button
          type="submit"
          disabled={loading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Accedendo..." : "Accedi"}
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
          )}
        </button>
      </div>
    </form>
  );
}
