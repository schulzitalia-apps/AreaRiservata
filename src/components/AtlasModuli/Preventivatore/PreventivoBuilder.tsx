"use client";

import { useEffect, useMemo, useState, FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  fetchAnagrafica,
  createAnagrafica,
  updateAnagrafica,
  deleteAnagrafica,
} from "@/components/Store/slices/anagraficheSlice";
import { anagraficheService } from "@/components/Store/services/anagraficheService";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import { FloatingSection } from "@/components/Layouts/FloatingSection";
import { Select } from "@/components/ui/select";

import PreventivoRigheTable, {
  type RigaPreventivoState,
  type ArticoloOption,
} from "./PreventivoRigheTable";

import PreventivoPrintLayout, {
  type PreventivoPrintData,
} from "./PreventivoPrintLayout";

import {
  safeNumber,
  clampPct,
  calcTotale,
  extractRefId,
  pickFirst,
} from "./PreventiviUtils";

type PreventivoBuilderProps = {
  preventivoId?: string;
};

const PREVENTIVO_TYPE = "preventivi";
const RIGHE_TYPE = "righe-preventivo";
const ARTICOLI_TYPE = "articoli";

// ✅ root pages
const PREVENTIVO_ROOT = "/preventivi";

// 🔎 abilita/disabilita log qui
const DEBUG_PREVENTIVI = true;

export default function PreventivoBuilder({ preventivoId }: PreventivoBuilderProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const preventivoDef = getAnagraficaDef(PREVENTIVO_TYPE);

  const selectedPreventivo = useAppSelector(
    (s) => s.anagrafiche.byType[PREVENTIVO_TYPE]?.selected,
  );

  const [currentId, setCurrentId] = useState<string | undefined>(preventivoId);

  /* ---------------------------------------------------------------------- */
  /*                                STATE                                   */
  /* ---------------------------------------------------------------------- */

  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  const [testata, setTestata] = useState<{
    numeroPreventivo: string;
    dataPreventivo: string; // YYYY-MM-DD
    clientePreventivo: string;
    statoPreventivo: string;
    notePreventivo: string;

    testoIntroduzione: string;
    testoFinale: string;
    noteCliente: string;

    firmaNome: string;
    firmaRuolo: string;
    firmaLuogoData: string;
  }>(() => ({
    numeroPreventivo: "",
    dataPreventivo: new Date().toISOString().slice(0, 10),
    clientePreventivo: "",
    statoPreventivo: "bozza",
    notePreventivo: "",

    testoIntroduzione: "Gentile Cliente,\n\nLe sottoponiamo il seguente preventivo:",
    testoFinale: "Rimaniamo a disposizione per qualsiasi chiarimento.\nCordiali saluti,",
    noteCliente: "",

    firmaNome: "Nome Cognome",
    firmaRuolo: "Ruolo",
    firmaLuogoData: "Luogo e data",
  }));

  // UI è single-select, ma backend ora è visibilityRoles: string[]
  const [visRole, setVisRole] = useState<string>("");

  const [righe, setRighe] = useState<RigaPreventivoState[]>([]);
  const [loadingRighe, setLoadingRighe] = useState(false);
  const [originalRigheIds, setOriginalRigheIds] = useState<string[]>([]);

  const [articoli, setArticoli] = useState<ArticoloOption[]>([]);
  const [loadingArticoli, setLoadingArticoli] = useState(false);

  const [templateSearch, setTemplateSearch] = useState("");
  const [templateOptions, setTemplateOptions] = useState<
    { id: string; label: string; data: Record<string, any>; visibilityRoles?: string[] }[]
  >([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSelectedId, setTemplateSelectedId] = useState("");

  const [printData, setPrintData] = useState<PreventivoPrintData | null>(null);

  /* ---------------------------------------------------------------------- */
  /*             SINCRONIZZA currentId quando cambia la prop                */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (preventivoId !== currentId) setCurrentId(preventivoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preventivoId]);

  /* ---------------------------------------------------------------------- */
  /*                        LOAD TESTATA + PREVENTIVO (EDIT)                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!currentId) return;
    dispatch(fetchAnagrafica({ type: PREVENTIVO_TYPE, id: currentId }));
  }, [dispatch, currentId]);

  useEffect(() => {
    if (!selectedPreventivo) return;
    if (currentId && String(selectedPreventivo.id) !== String(currentId)) return;

    const d = (selectedPreventivo as any).data ?? {};

    setTestata((prev) => ({
      numeroPreventivo: d.numeroPreventivo ?? "",
      dataPreventivo: d.dataPreventivo
        ? new Date(d.dataPreventivo).toISOString().slice(0, 10)
        : prev.dataPreventivo,
      clientePreventivo: d.clientePreventivo ?? "",
      statoPreventivo: d.statoPreventivo ?? "bozza",
      notePreventivo: d.notePreventivo ?? "",

      testoIntroduzione: d.testoIntroduzione ?? prev.testoIntroduzione,
      testoFinale: d.testoFinale ?? prev.testoFinale,
      noteCliente: d.noteCliente ?? prev.noteCliente,

      firmaNome: d.firmaNome ?? prev.firmaNome,
      firmaRuolo: d.firmaRuolo ?? prev.firmaRuolo,
      firmaLuogoData: d.firmaLuogoData ?? prev.firmaLuogoData,
    }));

    // ✅ nuovo modello: visibilityRoles: string[]
    // fallback legacy eventuale: visibilityRole
    const roles = (selectedPreventivo as any).visibilityRoles;
    const legacy = (selectedPreventivo as any).visibilityRole;
    setVisRole(Array.isArray(roles) ? (roles[0] ?? "") : (legacy ?? ""));
  }, [selectedPreventivo, currentId]);

  /* ---------------------------------------------------------------------- */
  /*                         LOAD RIGHE DAL BACKEND                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!currentId) {
      setRighe([]);
      setOriginalRigheIds([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingRighe(true);

        // 1) preview list
        const res = await anagraficheService.list({
          type: RIGHE_TYPE,
          page: 1,
          pageSize: 5000,
        });

        if (cancelled) return;

        const previewItems: any[] = (res as any).items ?? [];

        // 2) filtro per preventivo via preview
        const filteredPreview = previewItems.filter((item: any) => {
          const rd = item.data ?? {};
          const refId = extractRefId(
            rd.preventivoRiferimento ?? rd.preventivoId ?? rd.preventivo,
          );
          return refId != null && String(refId) === String(currentId);
        });

        // 3) FULL per ogni riga filtrata (così hai articoloId/prezzo ecc. reali)
        const fullItems = await Promise.all(
          filteredPreview.map(async (p: any) => {
            try {
              const id = String(p.id);
              const full = await anagraficheService.getOne({ type: RIGHE_TYPE, id });
              return full;
            } catch {
              // fallback: almeno non esplode tutto
              return p;
            }
          }),
        );

        if (cancelled) return;

        // 4) mappa usando FULL
        const mapped: RigaPreventivoState[] = (fullItems ?? []).map((item: any) => {
          const rd = item?.data ?? {};

          const articoloId = extractRefId(
            rd.articoloRiferimento ?? rd.articoloId ?? rd.articolo,
          );

          const quantitaRaw = pickFirst(rd, ["quantitaRiga", "quantita", "qta"]);
          const prezzoRaw = pickFirst(rd, ["prezzoUnitarioRiga", "prezzoUnitario", "prezzo"]);
          const scontoRaw = pickFirst(rd, [
            "scontoPercentualeRiga",
            "scontoPercentuale",
            "sconto",
          ]);
          const totaleRaw = pickFirst(rd, ["totaleRiga", "totale"]);

          const quantita = safeNumber(quantitaRaw);
          const prezzo = safeNumber(prezzoRaw);
          const sconto = clampPct(scontoRaw);

          const totaleStored = safeNumber(totaleRaw);
          const totale = totaleStored > 0 ? totaleStored : calcTotale(quantita, prezzo, sconto);

          if (DEBUG_PREVENTIVI) {
            console.log("[Preventivi] Riga FULL (PARSED)", {
              id: item?.id,
              articoloId,
              quantita,
              prezzo,
              sconto,
              totale,
              rd,
            });
          }

          return {
            id: String(item?.id ?? item?.recordId ?? ""),
            articoloId: articoloId ? String(articoloId) : null,
            articoloLabel: "",
            descrizione: rd.descrizioneRiga ?? rd.descrizione ?? "",
            quantita,
            prezzoUnitario: prezzo,
            scontoPercentuale: sconto,
            totale,
          };
        });

        const cleaned = mapped.filter((r) => !!r.id);

        setRighe(cleaned);
        setOriginalRigheIds(cleaned.map((r) => r.id!).filter(Boolean));
      } catch (e) {
        console.error("Errore caricando le righe del preventivo", e);
        setRighe([]);
        setOriginalRigheIds([]);
      } finally {
        if (!cancelled) setLoadingRighe(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentId]);

  /* ---------------------------------------------------------------------- */
  /*                          LOAD ARTICOLI DI CATALOGO                     */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingArticoli(true);

        const res = await anagraficheService.list({
          type: ARTICOLI_TYPE,
          page: 1,
          pageSize: 500,
        });

        if (cancelled) return;

        const opts: ArticoloOption[] =
          (res as any).items?.map((item: any) => {
            const data = item.data ?? {};
            const nome = data.nomeArticolo ?? item.displayName ?? item.id;

            // NOTA: in preview può essere 0. Va bene: prezzo "vero" lo puoi anche
            // idratare in tabella (getOne su select) se ti serve.
            const prezzo = safeNumber(data.prezzoUnitario ?? data.costoUnitario ?? 0);
            const descrizione = String(data.descrizioneArticolo ?? "");

            return {
              id: String(item.id),
              label: String(nome),
              prezzoUnitario: prezzo,
              descrizione,
            };
          }) ?? [];

        setArticoli(opts);
      } catch (e) {
        console.error("Errore caricando articoli", e);
        if (!cancelled) setArticoli([]);
      } finally {
        if (!cancelled) setLoadingArticoli(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /*                           LOAD TEMPLATE PREVENTIVI                     */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingTemplates(true);
        const res = await anagraficheService.list({
          type: PREVENTIVO_TYPE,
          query: templateSearch || undefined,
          page: 1,
          pageSize: 10,
        });
        if (cancelled) return;

        const opts =
          (res as any).items?.map((item: any) => {
            const roles: string[] | undefined = Array.isArray(item.visibilityRoles)
              ? item.visibilityRoles
              : item.visibilityRole
                ? [String(item.visibilityRole)]
                : undefined;

            return {
              id: String(item.id),
              label: item.data?.numeroPreventivo || item.displayName || String(item.id),
              data: item.data ?? {},
              visibilityRoles: roles,
            };
          }) ?? [];

        setTemplateOptions(opts);
      } catch (e) {
        console.error("Errore caricando template preventivo", e);
        if (!cancelled) setTemplateOptions([]);
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [templateSearch]);

  /* ---------------------------------------------------------------------- */
  /*                                TOTALI                                  */
  /* ---------------------------------------------------------------------- */

  const totali = useMemo(() => {
    const imponibile = righe.reduce(
      (acc, r) => acc + (Number.isFinite(r.totale) ? r.totale : 0),
      0,
    );
    const iva = imponibile * 0.22;
    const totale = imponibile + iva;
    return { imponibile, iva, totale };
  }, [righe]);

  /* ---------------------------------------------------------------------- */
  /*                    LOAD RIGHE DI UN TEMPLATE (helper)                  */
  /* ---------------------------------------------------------------------- */

  const loadRigheForPreventivoId = useCallback(async (prevId: string) => {
    // 1) preview list
    const res = await anagraficheService.list({
      type: RIGHE_TYPE,
      page: 1,
      pageSize: 5000,
    });

    const previewItems: any[] = (res as any)?.items ?? [];

    // 2) filtro via preview
    const filteredPreview = previewItems.filter((it: any) => {
      const refId = extractRefId(
        it?.data?.preventivoRiferimento ?? it?.data?.preventivoId ?? it?.data?.preventivo,
      );
      return refId != null && String(refId) === String(prevId);
    });

    // 3) full for each riga
    const fullItems = await Promise.all(
      filteredPreview.map(async (p: any) => {
        try {
          const id = String(p.id);
          const full = await anagraficheService.getOne({ type: RIGHE_TYPE, id });
          return full;
        } catch {
          return p;
        }
      }),
    );

    // 4) mapping (senza id perché è copia)
    const mapped: RigaPreventivoState[] = (fullItems ?? []).map((item: any) => {
      const rd = item?.data ?? {};

      const articoloId = extractRefId(
        rd.articoloRiferimento ?? rd.articoloId ?? rd.articolo,
      );

      const quantita = safeNumber(pickFirst(rd, ["quantitaRiga", "quantita", "qta"]));
      const prezzo = safeNumber(
        pickFirst(rd, ["prezzoUnitarioRiga", "prezzoUnitario", "prezzo"]),
      );
      const sconto = clampPct(
        pickFirst(rd, ["scontoPercentualeRiga", "scontoPercentuale", "sconto"]),
      );

      const totaleStored = safeNumber(pickFirst(rd, ["totaleRiga", "totale"]));
      const totale = totaleStored > 0 ? totaleStored : calcTotale(quantita, prezzo, sconto);

      return {
        articoloId: articoloId ? String(articoloId) : null,
        articoloLabel: "",
        descrizione: rd.descrizioneRiga ?? rd.descrizione ?? "",
        quantita,
        prezzoUnitario: prezzo,
        scontoPercentuale: sconto,
        totale,
      };
    });

    return mapped;
  }, []);

  /* ---------------------------------------------------------------------- */
  /*                          HANDLER TEMPLATE (DUPLICA)                    */
  /* ---------------------------------------------------------------------- */

  const handleApplyTemplate = useCallback(
    async (tempId: string) => {
      const t = templateOptions.find((x) => x.id === tempId);
      if (!t) return;

      const d = t.data ?? {};

      setCurrentId(undefined);
      setTemplateSelectedId("");

      setTestata((prev) => ({
        ...prev,
        numeroPreventivo: d.numeroPreventivo
          ? `${d.numeroPreventivo}-Copia`
          : prev.numeroPreventivo,
        dataPreventivo: new Date().toISOString().slice(0, 10),
        clientePreventivo: d.clientePreventivo ?? prev.clientePreventivo,
        statoPreventivo: "bozza",
        notePreventivo: d.notePreventivo ?? "",

        testoIntroduzione: d.testoIntroduzione ?? prev.testoIntroduzione,
        testoFinale: d.testoFinale ?? prev.testoFinale,
        noteCliente: d.noteCliente ?? prev.noteCliente,

        firmaNome: d.firmaNome ?? prev.firmaNome,
        firmaRuolo: d.firmaRuolo ?? prev.firmaRuolo,
        firmaLuogoData: d.firmaLuogoData ?? prev.firmaLuogoData,
      }));

      setVisRole(t.visibilityRoles?.[0] ?? "");

      try {
        setLoadingRighe(true);
        const copied = await loadRigheForPreventivoId(tempId);
        setRighe(copied);
        setOriginalRigheIds([]);
      } catch (e) {
        console.error("Errore duplicando righe template", e);
        setRighe([]);
        setOriginalRigheIds([]);
      } finally {
        setLoadingRighe(false);
      }
    },
    [templateOptions, loadRigheForPreventivoId],
  );

  /* ---------------------------------------------------------------------- */
  /*                            SYNC RIGHE (SAVE)                           */
  /* ---------------------------------------------------------------------- */

  const buildRigaBackendData = (preventivoIdToUse: string, riga: RigaPreventivoState) => {
    const quantita = safeNumber(riga.quantita);
    const prezzo = safeNumber(riga.prezzoUnitario);
    const sconto = clampPct(riga.scontoPercentuale);
    const totale = calcTotale(quantita, prezzo, sconto);

    // ✅ inviamo doppio naming per compatibilità backend (se usa nomi diversi)
    const data = {
      // reference
      preventivoRiferimento: preventivoIdToUse,
      preventivoId: preventivoIdToUse,

      articoloRiferimento: riga.articoloId || null,
      articoloId: riga.articoloId || null,

      // descrizione
      descrizioneRiga: riga.descrizione,
      descrizione: riga.descrizione,

      // numerici (doppio)
      quantitaRiga: quantita,
      quantita,

      prezzoUnitarioRiga: prezzo,
      prezzoUnitario: prezzo,
      prezzo,

      scontoPercentualeRiga: sconto,
      scontoPercentuale: sconto,
      sconto: sconto,

      totaleRiga: totale,
      totale,
    };

    return { data, quantita, prezzo, sconto, totale };
  };

  const syncRigheWithBackend = async (preventivoIdToUse: string) => {
    const nextRighe: RigaPreventivoState[] = [...righe];

    for (let i = 0; i < nextRighe.length; i++) {
      const riga = nextRighe[i];

      const built = buildRigaBackendData(preventivoIdToUse, riga);

      if (DEBUG_PREVENTIVI) {
        console.log("[Preventivi] Sync riga (SEND)", { i, id: riga.id, payload: built.data });
      }

      const visibilityRoles = visRole ? [visRole] : [];

      if (riga.id) {
        await dispatch(
          updateAnagrafica({
            type: RIGHE_TYPE,
            id: riga.id,
            data: { data: built.data, visibilityRoles },
          }),
        ).unwrap();
      } else {
        const res = await dispatch(
          createAnagrafica({
            type: RIGHE_TYPE,
            payload: { data: built.data, visibilityRoles },
          }),
        ).unwrap();

        const newId = (res as any).id;

        nextRighe[i] = {
          ...riga,
          id: newId,
          quantita: built.quantita,
          prezzoUnitario: built.prezzo,
          scontoPercentuale: built.sconto,
          totale: built.totale,
        };
      }
    }

    const currentIds = nextRighe.map((r) => r.id).filter((id): id is string => !!id);
    const toDelete = originalRigheIds.filter((id) => !currentIds.includes(id));

    for (const id of toDelete) {
      await dispatch(deleteAnagrafica({ type: RIGHE_TYPE, id })).unwrap();
    }

    setRighe(nextRighe);
    setOriginalRigheIds(currentIds);
  };

  /* ---------------------------------------------------------------------- */
  /*                               SALVATAGGIO                              */
  /* ---------------------------------------------------------------------- */

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payloadData = {
        numeroPreventivo: testata.numeroPreventivo,
        dataPreventivo: testata.dataPreventivo ? new Date(testata.dataPreventivo) : null,
        clientePreventivo: testata.clientePreventivo || null,
        statoPreventivo: testata.statoPreventivo,
        notePreventivo: testata.notePreventivo,

        testoIntroduzione: testata.testoIntroduzione,
        testoFinale: testata.testoFinale,
        noteCliente: testata.noteCliente,

        firmaNome: testata.firmaNome,
        firmaRuolo: testata.firmaRuolo,
        firmaLuogoData: testata.firmaLuogoData,

        totaleImponibile: totali.imponibile,
        totaleIva: totali.iva,
        totalePreventivo: totali.totale,
      };

      let id = currentId;

      const visibilityRoles = visRole ? [visRole] : [];

      if (id) {
        await dispatch(
          updateAnagrafica({
            type: PREVENTIVO_TYPE,
            id,
            data: { data: payloadData, visibilityRoles },
          }),
        ).unwrap();
      } else {
        const res = await dispatch(
          createAnagrafica({
            type: PREVENTIVO_TYPE,
            payload: { data: payloadData, visibilityRoles },
          }),
        ).unwrap();
        id = (res as any).id;
        setCurrentId(id);
      }

      if (id) {
        await syncRigheWithBackend(id);
        router.push(`${PREVENTIVO_ROOT}`);
      }
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /*                            BUILD PRINT DATA                            */
  /* ---------------------------------------------------------------------- */

  const buildPrintData = async (): Promise<PreventivoPrintData> => {
    let clienteNome = "Cliente";
    let clienteIndirizzo: string | null = null;

    if (testata.clientePreventivo) {
      try {
        const id = String(testata.clientePreventivo);
        const ids = [id];

        const [names, indirOp, indirLeg, caps, citta] = await Promise.all([
          anagraficheService.getFieldValues({ targetSlug: "clienti", field: "ragioneSociale", ids }),
          anagraficheService.getFieldValues({
            targetSlug: "clienti",
            field: "indirizzooperativa",
            ids,
          }),
          anagraficheService.getFieldValues({ targetSlug: "clienti", field: "indirizzolegale", ids }),
          anagraficheService.getFieldValues({ targetSlug: "clienti", field: "cap", ids }),
          anagraficheService.getFieldValues({ targetSlug: "clienti", field: "citta", ids }),
        ]);

        clienteNome = (names as any)[id] ?? clienteNome;

        const indirizzo = (indirOp as any)[id] || (indirLeg as any)[id] || null;
        const pieces = [indirizzo, (caps as any)[id], (citta as any)[id]].filter(Boolean);
        clienteIndirizzo = pieces.length > 0 ? pieces.join(" - ") : null;
      } catch (e) {
        console.error("Errore lookup cliente per stampa", e);
      }
    }

    const righePrint = righe.map((r) => ({
      descrizione: r.descrizione || "",
      quantita: safeNumber(r.quantita),
      prezzoUnitario: safeNumber(r.prezzoUnitario),
      scontoPercentuale: clampPct(r.scontoPercentuale),
      totale: Number.isFinite(r.totale) ? r.totale : 0,
    }));

    return {
      numeroPreventivo: testata.numeroPreventivo || "",
      dataPreventivo: testata.dataPreventivo || "",
      clienteNome,
      clienteIndirizzo,
      testoIntroduzione: testata.testoIntroduzione,
      testoFinale: testata.testoFinale,
      noteCliente: testata.noteCliente,
      firmaNome: testata.firmaNome,
      firmaRuolo: testata.firmaRuolo,
      firmaLuogoData: testata.firmaLuogoData,
      totaleImponibile: totali.imponibile,
      totaleIva: totali.iva,
      totalePreventivo: totali.totale,
      righe: righePrint,
    };
  };

  const handlePrintClick = async () => {
    if (printing) return;
    try {
      setPrinting(true);
      const data = await buildPrintData();
      setPrintData(data);
      setTimeout(() => {
        window.print();
        setPrinting(false);
      }, 80);
    } catch (e) {
      console.error("Errore preparazione PDF", e);
      setPrinting(false);
      alert("Errore durante la preparazione del PDF.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /*                                VISIBILITÀ                              */
  /* ---------------------------------------------------------------------- */

  const headerTitle = currentId ? "Modifica preventivo" : "Nuovo preventivo";

  const coverSrc =
    preventivoDef.detailCard?.coverSrc ?? "/images/illustration/cover/cover-02.png";
  const avatarSrc =
    preventivoDef.detailCard?.avatarSrc ?? "/images/illustration/avatar/avatar-02.png";
  const headerVariant = preventivoDef.detailCard?.headerVariant ?? "cover-avatar";
  const avatarSize = preventivoDef.detailCard?.avatarSize ?? "medium";
  const hoverEffect = preventivoDef.detailCard?.hoverEffect ?? true;

  const visibilityOptions =
    preventivoDef.visibilityOptions ?? ([] as ReadonlyArray<readonly [string, string]>);

  const visibilityOptionsWithPublic = useMemo(() => {
    const hasPublic = visibilityOptions.some(([value]) => value === "Public");
    const hasPublicReadOnly = visibilityOptions.some(([value]) => value === "PublicReadOnly");

    const extra: Array<[string, string]> = [];
    if (!hasPublic) {
      extra.push(["Public", "Pubblico (visibile e modificabile dagli utenti abilitati)"]);
    }
    if (!hasPublicReadOnly) {
      extra.push([
        "PublicReadOnly",
        "Pubblico (solo lettura per altri, modificabile solo da te e admin)",
      ]);
    }

    return [...extra, ...visibilityOptions] as ReadonlyArray<readonly [string, string]>;
  }, [visibilityOptions]);

  /* ---------------------------------------------------------------------- */
  /*                                RENDER                                  */
  /* ---------------------------------------------------------------------- */

  const templateSelectOptions: ReadonlyArray<readonly [string, string]> = [
    ["", loadingTemplates ? "Caricamento..." : "Nessun modello selezionato"],
    ...templateOptions.map((t) => [t.id, t.label] as const),
  ];

  return (
    <>
      <style jsx global>{`
        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          body * {
            visibility: hidden;
          }

          #preventivo-print-sheet,
          #preventivo-print-sheet * {
            visibility: visible;
          }

          #preventivo-print-sheet {
            position: absolute;
            inset: 0;
            margin: 0;
            padding: 24px;
          }

          .preventivo-edit-root {
            display: none !important;
          }
        }

        @media screen {
          .preventivo-print-root {
            display: none;
          }
        }
      `}</style>

      <div className="preventivo-edit-root">
        <form onSubmit={handleSubmit} className="space-y-6">
          <FloatingSection
            coverSrc={coverSrc}
            avatarSrc={avatarSrc}
            title={headerTitle}
            subtitle={preventivoDef.label}
            headerVariant={headerVariant}
            avatarSize={avatarSize}
            hoverEffect={hoverEffect}
          >
            <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
              <p className="text-xs text-dark/60 dark:text-white/60">
                {visRole === "Public"
                  ? "Visibile a tutti gli utenti abilitati (con i permessi, possono anche modificarla)."
                  : visRole === "PublicReadOnly"
                    ? "Visibile a tutti gli utenti abilitati, ma modificabile solo da te (proprietario) e dagli amministratori."
                    : visRole
                      ? `Visibile anche alla classe: ${visRole}`
                      : "Visibile solo a te (proprietario)."}
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push(PREVENTIVO_ROOT)}
                  className="rounded-lg border border-stroke px-4 py-2 text-sm text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                >
                  Indietro
                </button>

                <button
                  type="button"
                  onClick={handlePrintClick}
                  disabled={printing}
                  className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10 disabled:opacity-60 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10"
                >
                  {printing ? "Preparazione PDF…" : "Stampa / PDF"}
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Salvataggio…" : "Salva preventivo"}
                </button>
              </div>
            </div>

            <div className="mt-6 max-w-sm">
              <Select
                label="Classe di visibilità"
                value={visRole}
                onChange={(v) => setVisRole(v)}
                options={visibilityOptionsWithPublic as any}
              />
            </div>

            <div className="mt-6 rounded-lg border border-dashed border-stroke p-4 text-sm dark:border-dark-3">
              <div className="mb-2 font-semibold text-dark dark:text-white">
                Usa un preventivo esistente come modello (duplica)
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr]">
                <label className="text-xs text-dark dark:text-white">
                  <div className="mb-1">Cerca preventivi</div>
                  <input
                    className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-transparent dark:text-white"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Numero, note..."
                  />
                </label>

                <div className="text-xs text-dark dark:text-white">
                  <Select
                    label="Seleziona modello"
                    value={templateSelectedId}
                    onChange={async (v: string) => {
                      setTemplateSelectedId(v);
                      if (v) await handleApplyTemplate(v);
                    }}
                    options={templateSelectOptions as any}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                label="Numero preventivo"
                value={testata.numeroPreventivo}
                onChange={(v) => setTestata((s) => ({ ...s, numeroPreventivo: v }))}
              />
              <Input
                label="Data preventivo"
                type="date"
                value={testata.dataPreventivo}
                onChange={(v) => setTestata((s) => ({ ...s, dataPreventivo: v }))}
              />
              <ClientReferenceInput
                label="Cliente"
                value={testata.clientePreventivo}
                onChange={(v) => setTestata((s) => ({ ...s, clientePreventivo: v }))}
              />
              <Select
                label="Stato preventivo"
                value={testata.statoPreventivo}
                onChange={(v: string) => setTestata((s) => ({ ...s, statoPreventivo: v }))}
                options={[
                  ["bozza", "Bozza"],
                  ["inviato", "Inviato"],
                  ["accettato", "Accettato"],
                  ["rifiutato", "Rifiutato"],
                  ["fatturato", "Fatturato"],
                  ["acconto pagato", "Acconto Pagato"],
                  ["saldo pagato", "Saldo Pagato"],
                ]}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Textarea
                label="Testo introduzione (per PDF)"
                rows={6}
                value={testata.testoIntroduzione}
                onChange={(v) => setTestata((s) => ({ ...s, testoIntroduzione: v }))}
              />
              <Textarea
                label="Note interne (non stampate)"
                rows={6}
                value={testata.notePreventivo}
                onChange={(v) => setTestata((s) => ({ ...s, notePreventivo: v }))}
              />
            </div>

            <div className="mt-4">
              <Textarea
                label="Note per il cliente (stampate nel PDF)"
                rows={4}
                value={testata.noteCliente}
                onChange={(v) => setTestata((s) => ({ ...s, noteCliente: v }))}
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Textarea
                label="Testo finale (per PDF)"
                rows={4}
                value={testata.testoFinale}
                onChange={(v) => setTestata((s) => ({ ...s, testoFinale: v }))}
              />
              <Input
                label="Firma - Nome e Cognome"
                value={testata.firmaNome}
                onChange={(v) => setTestata((s) => ({ ...s, firmaNome: v }))}
              />
              <div className="space-y-2">
                <Input
                  label="Firma - Ruolo"
                  value={testata.firmaRuolo}
                  onChange={(v) => setTestata((s) => ({ ...s, firmaRuolo: v }))}
                />
                <Input
                  label="Luogo e data firma"
                  value={testata.firmaLuogoData}
                  onChange={(v) => setTestata((s) => ({ ...s, firmaLuogoData: v }))}
                />
              </div>
            </div>

            <div className="mt-8">
              <PreventivoRigheTable
                righe={righe}
                setRighe={setRighe}
                articoli={articoli}
                loadingArticoli={loadingArticoli}
                loadingRighe={loadingRighe}
              />
            </div>

            <div className="mt-6 flex flex-col items-end gap-1 text-sm text-dark dark:text-white">
              <div className="flex min-w-[260px] justify-between">
                <span>Totale imponibile:</span>
                <span>{totali.imponibile.toFixed(2)} €</span>
              </div>
              <div className="flex min-w-[260px] justify-between">
                <span>Totale IVA (22%):</span>
                <span>{totali.iva.toFixed(2)} €</span>
              </div>
              <div className="flex min-w-[260px] justify-between font-semibold">
                <span>Totale preventivo:</span>
                <span>{totali.totale.toFixed(2)} €</span>
              </div>
            </div>
          </FloatingSection>
        </form>
      </div>

      {printData && (
        <div className="preventivo-print-root">
          <PreventivoPrintLayout
            logoSrc="/images/logo/logo_nero.png"
            aziendaNome="Evolve S.r.l.s."
            aziendaIndirizzo="Via Ciciliano, 59/b 00036 Palestrina (RM)"
            aziendaPiva="18138881000"
            dati={printData}
          />
        </div>
      )}
    </>
  );
}

/* ------------------------- INPUT / TEXTAREA BASE ------------------------ */

function Input({
                 label,
                 value,
                 onChange,
                 type = "text",
               }: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm text-dark dark:text-white">
      <div className="mb-1">{label}</div>
      <input
        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-transparent dark:text-white"
        value={value ?? ""}
        type={type}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Textarea({
                    label,
                    value,
                    onChange,
                    rows = 4,
                  }: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-sm text-dark dark:text-white">
      <div className="mb-1">{label}</div>
      <textarea
        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/* ------------------------ CLIENTE REFERENCE INPUT ---------------------- */

function ClientReferenceInput({
                                label,
                                value,
                                onChange,
                              }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const targetSlug = "clienti";
  const previewField = "ragioneSociale";

  useEffect(() => {
    if (!value) {
      setSelectedLabel(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await anagraficheService.getFieldValues({
          targetSlug,
          field: previewField,
          ids: [value],
        });
        if (cancelled) return;
        const lbl = (res as any)[value] ?? null;
        setSelectedLabel(lbl);
      } catch {
        if (!cancelled) setSelectedLabel(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await anagraficheService.list({
          type: targetSlug,
          query: query || undefined,
          page: 1,
          pageSize: 10,
        });
        if (cancelled) return;
        const opts =
          (res as any).items?.map((item: any) => {
            const d = item.data ?? {};
            const lbl = d[previewField] || item.displayName || String(item.id);
            return { id: String(item.id), label: String(lbl) };
          }) ?? [];
        setOptions(opts);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  const current = options.find((o) => o.id === value) || null;
  const shownLabel = current?.label ?? selectedLabel ?? (value || "");

  return (
    <div className="text-sm text-dark dark:text-white">
      <div className="mb-1">{label}</div>

      {value && shownLabel && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs text-primary dark:border-red-400 dark:text-red-400">
          <span className="font-semibold">Cliente:</span>
          <span className="truncate max-w-[220px]">{shownLabel}</span>
          <button
            type="button"
            className="ml-1 text-[10px] opacity-70 hover:opacity-100"
            onClick={() => onChange("")}
          >
            ✕
          </button>
        </div>
      )}

      <input
        className="mb-2 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-transparent dark:text-white"
        type="text"
        placeholder="Cerca cliente per nome…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-wrap gap-1">
        {loading && <span className="text-xs text-dark/60 dark:text-white/60">Caricamento…</span>}

        {!loading &&
          options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors ${
                opt.id === value
                  ? "border-primary bg-primary text-white dark:border-red-400 dark:bg-red-400"
                  : "border-primary text-primary hover:bg-primary/10 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10"
              }`}
            >
              <span className="truncate max-w-[180px]">{opt.label}</span>
            </button>
          ))}

        {!loading && options.length === 0 && (
          <span className="text-xs text-dark/50 dark:text-white/50">Nessun risultato.</span>
        )}
      </div>
    </div>
  );
}
