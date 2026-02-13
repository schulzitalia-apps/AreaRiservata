"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { InfoPill, type InfoPillTone } from "@/components/AtlasModuli/common/InfoPill";
import { GlowButton } from "@/components/AtlasModuli/common/GlowButton";
import { fetchAzioni } from "@/components/Store/slices/azioniSlice";
import type { AzionePreview } from "@/components/Store/models/azioni";

import { getEventoActionUiConfig } from "@/config/actions.registry";

const tipi = getEventoActionUiConfig();

type AzioneTypeConfig = {
  slug: string; // es. "urgenze", "avvisi"
  label: string; // etichetta visibile
  tone?: InfoPillTone; // colore pill
};

type FilterByAnagrafica = {
  anagraficaType: string;
  anagraficaId: string;
};

type FilterByGruppo = {
  gruppoType: string;
  gruppoId: string;
};

export type AzioniOverviewPanelProps = {
  /** Tipi evento da mostrare, con etichetta e tono per la pill */
  types: AzioneTypeConfig[];

  /** Filtro testuale opzionale */
  query?: string;

  /** Filtro per anagrafica (es. tutte le azioni collegate a un atleta) */
  anagraficaFilter?: FilterByAnagrafica;

  /** Filtro per aula/gruppo (es. tutte le azioni collegate a un corso) */
  gruppoFilter?: FilterByGruppo;

  /** Numero massimo di elementi per tipo (default 5) */
  maxPerType?: number;

  /** Classe extra per il contenitore esterno */
  className?: string;

  /**
   * Funzione che costruisce l'href per il dettaglio evento.
   * Di default punta a /app/eventi/:type/:id
   */
  buildEventoHref?: (type: string, id: string) => string;
};

/**
 * Pannello "Avvisi & Urgenze"
 * Design lineare, categorie collassabili, info di dettaglio solo in espansione.
 */
export function AzioniOverviewPanel({
                                      types,
                                      query,
                                      anagraficaFilter,
                                      gruppoFilter,
                                      maxPerType = 5,
                                      className,
                                      buildEventoHref = (type, id) => `/eventi/${type}/${id}`,
                                    }: AzioniOverviewPanelProps) {
  const dispatch = useAppDispatch();
  const azioniState = useAppSelector((s) => s.azioni);

  // trigger fetch al mount / quando cambiano filtri
  useEffect(() => {
    if (!types.length) return;

    types.forEach((t) => {
      dispatch(
        fetchAzioni({
          type: t.slug,
          query,
          visibilityRole: undefined, // lascia alle ACL di backend
          timeFrom: undefined,
          timeTo: undefined,
          anagraficaType: anagraficaFilter?.anagraficaType,
          anagraficaId: anagraficaFilter?.anagraficaId,
          gruppoType: gruppoFilter?.gruppoType,
          gruppoId: gruppoFilter?.gruppoId,
        }),
      );
    });
  }, [
    dispatch,
    types,
    query,
    anagraficaFilter?.anagraficaType,
    anagraficaFilter?.anagraficaId,
    gruppoFilter?.gruppoType,
    gruppoFilter?.gruppoId,
  ]);

  const hasAnyItem = useMemo(() => {
    return types.some((t) => {
      const bucket = azioniState.byType[t.slug];
      return (bucket?.items?.length ?? 0) > 0;
    });
  }, [azioniState.byType, types]);

  const hasFilters = !!(query || anagraficaFilter || gruppoFilter);

  return (
    <div
      className={clsx(
        "border bg-white p-4 md:p-5",
        "rounded-lg",
        "border-slate-200 text-slate-900",
        "dark:border-white/10 dark:bg-[#050714] dark:text-slate-100",
        "shadow-sm",
        className,
      )}
    >
      {/* HEADER CENTRATO */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div>
          <h3 className="text-sm md:text-base font-semibold tracking-[0.18em] uppercase">
            Avvisi &amp; Urgenze
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Eventi automatici rilevanti per te, filtrati secondo le tue visibilità.
          </p>
        </div>

        <div className="mt-1 inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 dark:border-white/20 dark:text-slate-200">
          {hasAnyItem
            ? `${types.length} categori${types.length !== 1 ? "e" : "a"} attive`
            : "Nessuna azione visibile"}
        </div>

        {hasFilters && (
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-500">
            Filtri:
            {query && <> testo “{query}”</>}
            {anagraficaFilter && (
              <> · {anagraficaFilter.anagraficaType} #{anagraficaFilter.anagraficaId}</>
            )}
            {gruppoFilter && (
              <> · {gruppoFilter.gruppoType} #{gruppoFilter.gruppoId}</>
            )}
          </p>
        )}
      </div>

      {!hasAnyItem && (
        <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          Al momento non ci sono azioni o avvisi da mostrarti.
        </p>
      )}

      {/* LISTA TIPI (SEZIONI COLLASSABILI) */}
      <div className="mt-4 space-y-0 divide-y divide-slate-200 dark:divide-white/10">
        {types.map((cfg) => {
          const bucket = azioniState.byType[cfg.slug];
          const items = (bucket?.items ?? []).slice(0, maxPerType);
          const isLoading = bucket?.status === "loading";

          // se non sta caricando e non ci sono elementi, non mostro la categoria
          if (!isLoading && items.length === 0) return null;

          return (
            <AzioniTypeSection
              key={cfg.slug}
              cfg={cfg}
              items={items}
              isLoading={!!isLoading}
              buildEventoHref={buildEventoHref}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                        SEZIONE PER OGNI TIPO                       */
/* ------------------------------------------------------------------ */

type AzioniTypeSectionProps = {
  cfg: AzioneTypeConfig;
  items: AzionePreview[];
  isLoading: boolean;
  buildEventoHref: (type: string, id: string) => string;
};

function AzioniTypeSection({
                             cfg,
                             items,
                             isLoading,
                             buildEventoHref,
                           }: AzioniTypeSectionProps) {
  const [open, setOpen] = useState(false); // parte chiusa

  const count = items.length;

  const handleToggle = () => {
    setOpen((v) => !v);
  };

  return (
    <section className="py-3 first:pt-0 last:pb-0">
      <TypeHeader
        cfg={cfg}
        count={count}
        isLoading={isLoading}
        open={open}
        onToggle={handleToggle}
      />

      {/* Quando è chiusa NON mostriamo nulla sotto: solo header con il conteggio  */}
      {open && (
        <>
          {isLoading && count === 0 && (
            <div className="mt-2 space-y-1.5">
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}

          {!isLoading && count > 0 && (
            <ul className="mt-2 space-y-1">
              {items.map((azione) => (
                <AzioneRow
                  key={azione.id}
                  typeSlug={cfg.slug}
                  azione={azione}
                  buildHref={buildEventoHref}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*                            SUB COMPONENTS                          */
/* ------------------------------------------------------------------ */

type TypeHeaderProps = {
  cfg: AzioneTypeConfig;
  count: number;
  isLoading: boolean;
  open: boolean;
  onToggle: () => void;
};

function TypeHeader({ cfg, count, isLoading, open, onToggle }: TypeHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 text-left"
    >
      <div className="flex items-center gap-2">
        <InfoPill tone={cfg.tone ?? "neutral"} className="px-2 py-0.5 text-xs">
          {cfg.label}
        </InfoPill>

        {isLoading ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Caricamento…
          </span>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {count} notific{count !== 1 ? "he" : "a"}
          </span>
        )}
      </div>

      <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        {open ? "Nascondi" : "Mostra"}
        <span>{open ? "▲" : "▼"}</span>
      </span>
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-2 px-1.5 py-1.5 text-xs">
      <div className="flex flex-1 flex-col gap-1">
        <div className="h-3 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-2.5 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="h-7 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                           RIGA AZIONE                              */
/* ------------------------------------------------------------------ */

type AzioneRowProps = {
  typeSlug: string;
  azione: AzionePreview;
  buildHref: (type: string, id: string) => string;
};

function AzioneRow({ typeSlug, azione, buildHref }: AzioneRowProps) {
  const [expanded, setExpanded] = useState(false);

  const dateLabel = useMemo(() => {
    const src = azione.startAt || azione.endAt;
    if (!src) return "Senza data";
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
      return src;
    }
  }, [azione.startAt, azione.endAt]);

  const subtitle = azione.subtitle || "—";

  const isRecent = useMemo(() => {
    const src = azione.startAt || azione.endAt;
    if (!src) return false;
    const d = new Date(src);
    if (Number.isNaN(d.getTime())) return false;
    const diff = Date.now() - d.getTime();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    return diff >= 0 && diff <= threeDays;
  }, [azione.startAt, azione.endAt]);

  const handleToggle = () => {
    setExpanded((v) => !v);
  };

  return (
    <li className="flex gap-3 px-1.5 py-1.5">
      {/* timeline minimale */}
      <div className="flex flex-col items-center">
        <span className="mt-1 h-2 w-2 rounded-full bg-sky-500" />
        <span className="mt-1 h-full w-px bg-slate-200 dark:bg-slate-700" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col border-b border-slate-100 pb-1 last:border-b-0 dark:border-slate-700">
        <button
          type="button"
          onClick={handleToggle}
          className="flex min-w-0 items-start justify-between gap-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                {azione.displayName}
              </span>
              {isRecent && (
                <span className="rounded-sm border border-sky-500 px-1 text-[10px] font-medium uppercase text-sky-500">
                  Nuovo
                </span>
              )}
            </div>

            {/* QUANDO COMPRESSO: SOLO SOTTOTITOLO, NIENTE DATA */}
            <span className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </span>
          </div>

          <div className="flex flex-col items-end gap-1 pl-1">
            <GlowButton color="primary" size="sm" href={buildHref(typeSlug, azione.id)}>
              Apri
            </GlowButton>
            {azione.ownerName && (
              <span className="text-[11px] text-slate-500 dark:text-slate-500">
                di {azione.ownerName}
              </span>
            )}
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {expanded ? "▲" : "▼"}
            </span>
          </div>
        </button>

        {/* INFO ESTESA: DATA + EXTRA SOLO QUANDO ESPANSA */}
        {expanded && (
          <div className="mt-1 space-y-1 text-xs leading-snug text-slate-600 dark:text-slate-300">
            <div>{subtitle}</div>
            <div className="text-slate-500 dark:text-slate-400">{dateLabel}</div>
          </div>
        )}
      </div>
    </li>
  );
}
