"use client";

import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { useIsMobile } from "@/design/hooks/use-mobile";
import { cn } from "@/server-utils/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BellIcon } from "./icons";

import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchAzioni } from "@/components/Store/slices/azioniSlice";
import { fetchNotifichePreferenze } from "@/components/Store/slices/notificheSlice";
import { getEventoActionUiConfig } from "@/config/actions.registry";
import { getEventoDef } from "@/config/eventi.registry";

const TYPE_ICON_MAP: Record<string, string> = {
  urgenze: "/images/user/user-18.png",
  avvisi: "/images/user/user-03.png",
  pagamenti: "/images/user/user-26.png",
  tasks: "/images/user/user-28.png",
  team: "/images/user/user-27.png",
};

const DEFAULT_ICON = "/images/user/user-01.png";
const MAX_ITEMS = 4;

function buildEventoHref(type: string, id: string) {
  return `/eventi/${type}/${id}`;
}

function safeDateValue(a: { startAt?: any; endAt?: any; updatedAt?: any }): number {
  const src = a.startAt || a.endAt || a.updatedAt;
  if (!src) return 0;
  const t = new Date(src).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function pickBaseDateForPreferenza(item: any): Date | null {
  const src =
    item?.state === "PAST"
      ? item.endAt || item.startAt || item.updatedAt
      : item.startAt || item.endAt || item.updatedAt;

  if (!src) return null;
  const d = new Date(src);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatRelativeIt(diffMs: number) {
  const abs = Math.abs(diffMs);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return "pochi secondi";
  if (abs < hour) {
    const m = Math.round(abs / minute);
    return `${m} minut${m === 1 ? "o" : "i"}`;
  }
  if (abs < day) {
    const h = Math.round(abs / hour);
    return `${h} or${h === 1 ? "a" : "e"}`;
  }
  const d = Math.round(abs / day);
  return `${d} giorn${d === 1 ? "o" : "i"}`;
}

function formatDateLabel(a: { startAt?: any; endAt?: any }) {
  const src = a.startAt || a.endAt;
  if (!src) return "";
  try {
    const d = new Date(src);
    return d.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function Notification() {
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile();

  const session = useAppSelector((s) => s.session);
  const isAuthed = session.status === "authenticated";

  const azioniState = useAppSelector((s) => s.azioni);
  const notificheState = useAppSelector((s) => s.notifiche);

  const [isOpen, setIsOpen] = useState(false);

  // ✅ una fetch al mount, poi refetch su open solo se stale
  const fetchedOnceRef = useRef(false);
  const lastFetchRef = useRef<number>(0);

  const types = useMemo(() => {
    return getEventoActionUiConfig().map((cfg) => ({
      slug: cfg.eventType,
      label: cfg.label,
      tone: cfg.tone,
    }));
  }, []);

  const runFetch = useCallback(() => {
    if (!isAuthed) return;
    if (!types.length) return;

    // 1) autoevents (azioni)
    types.forEach((t) => {
      dispatch(
        fetchAzioni({
          type: t.slug,
          query: undefined,
          visibilityRole: undefined,
          timeFrom: undefined,
          timeTo: undefined,
          anagraficaType: undefined,
          anagraficaId: undefined,
          gruppoType: undefined,
          gruppoId: undefined,
        }),
      );
    });

    // 2) preferenze eventi
    dispatch(fetchNotifichePreferenze({ limit: 100 }));

    lastFetchRef.current = Date.now();
  }, [dispatch, isAuthed, types]);

  // ✅ BOOTSTRAP: carica appena monta la navbar
  useEffect(() => {
    if (!isAuthed) return;
    if (!types.length) return;
    if (fetchedOnceRef.current) return;

    fetchedOnceRef.current = true;
    runFetch();
  }, [isAuthed, types, runFetch]);

  // ✅ REFRESH su open con cooldown 20 minuti
  useEffect(() => {
    if (!isAuthed) return;
    if (!isOpen) return;
    if (!types.length) return;

    const STALE_MS = 20 * 60_000; // ✅ 20 minuti
    const age = Date.now() - (lastFetchRef.current || 0);

    if (age > STALE_MS) runFetch();
  }, [isAuthed, isOpen, types, runFetch]);

  const flattened = useMemo(() => {
    const all: Array<{
      kind: "azione" | "preferenza";
      typeSlug: string;
      typeLabel: string;
      item: any;
    }> = [];

    // azioni
    for (const t of types) {
      const bucket = azioniState.byType[t.slug];
      const items = bucket?.items ?? [];
      items.forEach((it) => {
        all.push({
          kind: "azione",
          typeSlug: t.slug,
          typeLabel: t.label,
          item: it,
        });
      });
    }

    // preferenze eventi
    for (const [typeSlug, bucket] of Object.entries(notificheState.byType ?? {})) {
      const items = (bucket as any)?.items ?? [];
      items.forEach((it: any) => {
        all.push({
          kind: "preferenza",
          typeSlug,
          typeLabel: "Preferenze eventi",
          item: it,
        });
      });
    }

    all.sort((a, b) => safeDateValue(b.item) - safeDateValue(a.item));
    return all.slice(0, MAX_ITEMS);
  }, [azioniState.byType, notificheState.byType, types]);

  const totalCount = useMemo(() => {
    const azioniCount = types.reduce((acc, t) => {
      const bucket = azioniState.byType[t.slug];
      return acc + (bucket?.items?.length ?? 0);
    }, 0);

    const prefCount = Object.values(notificheState.byType ?? {}).reduce(
      (acc, b: any) => acc + (b?.items?.length ?? 0),
      0,
    );

    return azioniCount + prefCount;
  }, [azioniState.byType, notificheState.byType, types]);

  const isAnyLoading = useMemo(() => {
    const azioniLoading = types.some(
      (t) => azioniState.byType[t.slug]?.status === "loading",
    );
    const prefLoading = Object.values(notificheState.byType ?? {}).some(
      (b: any) => b?.status === "loading",
    );
    return azioniLoading || prefLoading;
  }, [azioniState.byType, notificheState.byType, types]);

  // ✅ Dot: resta finché c’è roba
  const showDot = totalCount > 0;

  const itemLinkBase = cn(
    "flex items-start gap-3 min-[420px]:gap-4",
    "rounded-lg px-2 py-2.5",
    "outline-none",
    "hover:bg-gray-2 focus-visible:bg-gray-2",
    "dark:hover:bg-dark-3 dark:focus-visible:bg-dark-3",
    "border border-transparent",
    "focus-visible:border-primary/40 dark:focus-visible:border-dark-border/40",
  );

  return (
    <>
      {/* Scrollbar brandizzata locale (theme-based) */}
      <style jsx global>{`
          .notif-scroll {
              scrollbar-width: thin;
              scrollbar-color: rgba(16, 185, 129, 0.55) transparent;
          }
          .notif-scroll::-webkit-scrollbar {
              width: 10px;
          }
          .notif-scroll::-webkit-scrollbar-track {
              background: transparent;
          }
          .notif-scroll::-webkit-scrollbar-thumb {
              background-color: rgba(16, 185, 129, 0.45);
              border-radius: 999px;
              border: 2px solid transparent;
              background-clip: content-box;
          }
          .notif-scroll::-webkit-scrollbar-thumb:hover {
              background-color: rgba(16, 185, 129, 0.65);
          }

          .dark .notif-scroll {
              scrollbar-color: rgba(16, 185, 129, 0.55) transparent;
          }
          .dark .notif-scroll::-webkit-scrollbar-thumb {
              background-color: rgba(16, 185, 129, 0.35);
          }
          .dark .notif-scroll::-webkit-scrollbar-thumb:hover {
              background-color: rgba(16, 185, 129, 0.55);
          }
      `}</style>

      <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
        <DropdownTrigger
          className="grid size-12 place-items-center rounded-full border bg-gray-2 text-dark outline-none hover:text-primary focus-visible:border-primary focus-visible:text-primary dark:border-dark-4 dark:bg-dark-3 dark:text-white dark:focus-visible:border-primary"
          aria-label="Notifiche"
        >
          <span className="relative">
            <BellIcon />

            {showDot && (
              <span className="absolute right-0 top-0 z-1 size-2 rounded-full bg-red-light ring-2 ring-gray-2 dark:ring-dark-3">
                <span className="absolute inset-0 -z-1 animate-ping rounded-full bg-red-light opacity-75" />
              </span>
            )}
          </span>
        </DropdownTrigger>

        <DropdownContent
          align="center"
          className={cn(
            "border border-stroke bg-white px-3.5 py-3 shadow-md dark:border-black dark:bg-black",
            "w-[min(22rem,calc(100vw-2rem))]",
            "max-h-[min(23rem,calc(100vh-8rem))] overflow-hidden",
            isMobile && "fixed left-1/2 top-20 -translate-x-1/2",
          )}
        >
          <div className="mb-1 flex items-center justify-between px-2 py-1.5">
            <span className="text-lg font-medium text-dark dark:text-white">
              Notifiche
            </span>

            <span className="rounded-md bg-primary px-[9px] py-0.5 text-xs font-medium text-white">
              {isAnyLoading ? "…" : totalCount}{" "}
              {totalCount === 1 ? "nuova" : "nuove"}
            </span>
          </div>

          {/* ✅ LISTA: snap + fondo extra + spacer (non taglia l’ultima) */}
          <ul
            className={cn(
              "notif-scroll mb-3 overflow-y-auto overscroll-contain pr-1",
              "max-h-[18.5rem] min-[420px]:max-h-[23rem]",
              "[webkit-overflow-scrolling:touch]",
              "snap-y snap-mandatory",
              // ✅ extra fondo per arrivare a mostrare l'ultimo item intero
              "scroll-py-2 scroll-pb-10 pb-10",
            )}
          >
            {!isAuthed && (
              <li className="snap-start scroll-mt-2 px-2 py-2 text-sm text-dark-5 dark:text-dark-6">
                Effettua l’accesso per vedere le notifiche.
              </li>
            )}

            {isAuthed && isAnyLoading && flattened.length === 0 && (
              <li className="snap-start scroll-mt-2 px-2 py-2 text-sm text-dark-5 dark:text-dark-6">
                Caricamento notifiche…
              </li>
            )}

            {isAuthed && !isAnyLoading && flattened.length === 0 && (
              <li className="snap-start scroll-mt-2 px-2 py-2 text-sm text-dark-5 dark:text-dark-6">
                Nessuna notifica al momento.
              </li>
            )}

            {isAuthed &&
              flattened.map(({ kind, typeSlug, typeLabel, item }) => {
                const href = buildEventoHref(typeSlug, item.id);

                let img = DEFAULT_ICON;
                if (kind === "azione") {
                  img = TYPE_ICON_MAP[typeSlug] ?? DEFAULT_ICON;
                } else {
                  try {
                    img = getEventoDef(typeSlug).detailCard.avatarSrc || DEFAULT_ICON;
                  } catch {
                    img = DEFAULT_ICON;
                  }
                }

                if (kind === "preferenza") {
                  const state = item.state as ("UPCOMING" | "PAST" | null);
                  const baseDate = pickBaseDateForPreferenza(item);
                  const diffMs = baseDate ? baseDate.getTime() - Date.now() : 0;

                  const titleTop =
                    state === "PAST"
                      ? "Evento passato da poco"
                      : "Nuovo evento in arrivo";

                  const whenText =
                    state === "PAST"
                      ? `è passato da ${formatRelativeIt(diffMs)}`
                      : `è in programma tra ${formatRelativeIt(diffMs)}`;

                  const eventTitle = item.displayName || "Titolo evento";

                  return (
                    <li
                      key={`${kind}:${typeSlug}:${item.id}`}
                      role="menuitem"
                      className="snap-start scroll-mt-2"
                    >
                      <Link
                        href={href}
                        onClick={() => setIsOpen(false)}
                        className={itemLinkBase}
                      >
                        <Image
                          src={img}
                          className="size-14 rounded-full object-cover"
                          width={200}
                          height={200}
                          alt=""
                        />

                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-dark dark:text-white">
                            {titleTop}
                          </div>

                          <div className="mt-0.5 whitespace-normal break-words text-sm font-normal text-dark dark:text-white">
                            L&apos;evento{" "}
                            <span className="font-medium text-primary">
                              “{eventTitle}”
                            </span>{" "}
                            {whenText}.
                          </div>

                          <div className="mt-1 text-xs font-normal text-gray-600 dark:text-white/70">
                            Clicca per dettagli
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                }

                const title = item.displayName || typeLabel || "Notifica";
                const sub =
                  item.subtitle ||
                  item.ownerName ||
                  formatDateLabel(item) ||
                  "—";
                const dateLabel = formatDateLabel(item);

                return (
                  <li
                    key={`${kind}:${typeSlug}:${item.id}`}
                    role="menuitem"
                    className="snap-start scroll-mt-2"
                  >
                    <Link
                      href={href}
                      onClick={() => setIsOpen(false)}
                      className={itemLinkBase}
                    >
                      <Image
                        src={img}
                        className="size-14 rounded-full object-cover"
                        width={200}
                        height={200}
                        alt=""
                      />

                      <div className="min-w-0">
                        <div className="text-sm font-medium text-dark dark:text-white">
                          {title}
                        </div>

                        <div className="mt-0.5 whitespace-normal break-words text-sm font-medium text-gray-700 dark:text-dark-6">
                          {sub}
                        </div>

                        <div className="mt-0.5 text-xs text-gray-600 dark:text-dark-6/80">
                          {typeLabel}
                          {dateLabel ? ` · ${dateLabel}` : ""}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}

            {/* ✅ Spacer finale: permette di scrollare fino a mostrare l’ultimo item intero */}
            <li aria-hidden="true" className="h-10" />
          </ul>

          <Link
            href="/profile"
            onClick={() => setIsOpen(false)}
            className="block rounded-lg border border-primary p-2 text-center text-sm font-medium tracking-wide text-primary outline-none transition-colors hover:bg-blue-light-5 focus:bg-blue-light-5 focus:text-primary focus-visible:border-primary dark:border-dark-3 dark:text-dark-6 dark:hover:border-dark-5 dark:hover:bg-dark-3 dark:hover:text-dark-7 dark:focus-visible:border-dark-5 dark:focus-visible:bg-dark-3 dark:focus-visible:text-dark-7"
          >
            Vai al Profilo
          </Link>
        </DropdownContent>
      </Dropdown>
    </>
  );
}
