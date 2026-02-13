"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchMyProfile } from "@/components/Store/slices/profileSlice";

export function UploadPhotoForm() {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.profile.data);

  const [avatars, setAvatars] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [initializedSelection, setInitializedSelection] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  // 1) carica la lista avatar dal backend
  useEffect(() => {
    let cancelled = false;

    async function loadAvatars() {
      setLoadingList(true);
      try {
        const res = await fetch("/api/avatar/list");
        if (!res.ok) throw new Error("Impossibile caricare gli avatar");
        const data = await res.json();
        if (!cancelled) {
          setAvatars(Array.isArray(data.images) ? data.images : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error(e);
          setErr(e?.message || "Errore durante il caricamento degli avatar");
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }

    loadAvatars();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) inizializza selectedIndex in base a profile.avatarKey *quando* ho sia profilo che lista
  useEffect(() => {
    if (initializedSelection) return;
    if (!avatars.length) return;

    const key = profile?.avatarKey;
    if (key) {
      const idx = avatars.indexOf(key);
      setSelectedIndex(idx !== -1 ? idx : 0);
    } else {
      setSelectedIndex(0);
    }

    setInitializedSelection(true);
  }, [avatars, profile?.avatarKey, initializedSelection]);

  const fallbackAvatar = profile?.avatarKey || "/images/user/user-02.png";
  const currentAvatar: string =
    avatars[selectedIndex] ?? fallbackAvatar;

  const handleCancel = () => {
    setErr(null);
    setSaved(false);

    if (profile?.avatarKey && avatars.length) {
      const idx = avatars.indexOf(profile.avatarKey);
      setSelectedIndex(idx !== -1 ? idx : 0);
    } else {
      setSelectedIndex(0);
    }
  };

  const handleSave = async () => {
    if (!avatars.length) return;

    setBusy(true);
    setErr(null);
    setSaved(false);

    try {
      const key = avatars[selectedIndex];

      const res = await fetch("/api/avatar/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });

      if (!res.ok) {
        let message = "Errore nel salvataggio dell'avatar";
        try {
          const data = await res.json();
          if (data?.message) message = data.message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      await dispatch(fetchMyProfile());
      setSaved(true);
    } catch (e: any) {
      setErr(e?.message || "Errore di salvataggio");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ShowcaseSection title="Your Photo" className="!p-7">
      <div className="space-y-5">
        {/* Header con preview */}
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gradient-to-tr from-primary/25 via-primary/10 to-transparent p-[2px]">
            <Image
              src={currentAvatar}
              width={56}
              height={56}
              alt="User"
              className="size-14 rounded-full object-cover bg-gray-2 dark:bg-dark-2"
              quality={90}
            />
          </div>

          <div className="flex flex-col">
            <span className="mb-1.5 font-medium text-dark dark:text-white">
              Edit your photo
            </span>
            <span className="text-body-sm text-gray-5 dark:text-gray-4">
              Seleziona un avatar dalla galleria qui sotto
            </span>
          </div>
        </div>

        {/* Card griglia avatar – sfondo neutro, solo palline */}
        <div className="rounded-2xl border border-dashed border-gray-3 bg-white/80 p-4 shadow-sm dark:border-dark-3 dark:bg-dark-2/80">
          <p className="mb-4 text-center text-body-sm font-medium text-dark dark:text-white">
            Scegli un avatar tra quelli disponibili
          </p>

          {loadingList && (
            <p className="text-center text-body-sm text-gray-5 dark:text-gray-4">
              Carico gli avatar...
            </p>
          )}

          {!loadingList && !avatars.length && (
            <p className="text-center text-body-sm text-gray-5 dark:text-gray-4">
              Nessun avatar disponibile.
            </p>
          )}

          {!loadingList && avatars.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4 sm:gap-5">
              {avatars.map((src, index) => {
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => {
                      setSelectedIndex(index);
                      setSaved(false);
                      setErr(null);
                    }}
                    className={`
                      group flex items-center justify-center rounded-full p-1
                      transition-transform duration-200
                      hover:scale-[1.06]
                      focus:outline-none
                    `}
                  >
                    <div
                      className={`
                        avatar-bubble relative flex h-16 w-16 items-center justify-center rounded-full
                        bg-gray-2 shadow-sm dark:bg-dark-3
                        overflow-hidden
                        ${isSelected ? "avatar-bubble--selected" : ""}
                      `}
                    >
                      <Image
                        src={src}
                        alt="Avatar"
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {err && (
          <p className="text-sm text-red">
            {err}
          </p>
        )}
        {saved && !err && (
          <p className="text-sm text-primary">
            Avatar aggiornato con successo.
          </p>
        )}

        {/* Bottoni azione */}
        <div className="flex justify-end gap-3">
          <button
            className="flex justify-center rounded-lg border border-stroke px-6 py-[7px] font-medium text-dark hover:shadow-1 dark:border-dark-3 dark:text-white"
            type="button"
            onClick={handleCancel}
            disabled={busy || loadingList}
          >
            Annulla
          </button>
          <button
            className="flex justify-center rounded-lg border border-stroke px-6 py-[7px] font-medium text-dark hover:shadow-1 dark:border-dark-3 dark:text-white disabled:opacity-60"
            type="button"
            onClick={handleSave}
            disabled={busy || loadingList || !avatars.length}
          >
            {busy ? "Salvo..." : "Salva"}
          </button>
        </div>
      </div>

      {/* Animazioni float + glow POTENZIATO per le palline */}
      <style jsx>{`
        @keyframes avatarFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        .avatar-bubble {
          animation: avatarFloat 4s ease-in-out infinite;
        }

        .avatar-bubble--selected {
          box-shadow:
            0 0 0 3px rgba(59, 130, 246, 0.9),
            0 0 20px rgba(59, 130, 246, 0.7),
            0 0 35px rgba(59, 130, 246, 0.45);
          animation-duration: 3s;
          transform: translateY(-2px) scale(1.04);
        }

        :global(.dark) .avatar-bubble--selected {
          box-shadow:
            0 0 0 3px rgba(59, 130, 246, 1),
            0 0 24px rgba(59, 130, 246, 0.85),
            0 0 40px rgba(59, 130, 246, 0.6);
        }
      `}</style>
    </ShowcaseSection>
  );
}
