# Atlas Moduli - Spese

> Percorso: `src/components/AtlasModuli/Spese/*`
>
> Documento collegato: `src/components/AtlasModuli/financials.plan.md`

Il modulo `Spese` e' ora documentato come flusso live-only.

---

## 0) Flusso sintetico

1. `src/app/spese/page.tsx`
2. `src/components/AtlasModuli/Spese/SpeseOverview.tsx`
3. `useSpeseAnalyticsSource`
4. `financialsSlice` / `financialsService`
5. route API analytics spese
6. `src/server-utils/service/speseAnalytics.ts`
7. adapter FE + `useSpeseOverviewComputed`
8. `Grid1` / `Grid2`

---

## 1) Cosa fa adesso

- usa payload live Redux/API senza fallback automatico a mock
- usa costanti UI da `config.ts`, senza import runtime dal vecchio `mock.ts`
- risolve le label delle varianti reali via `useAnagraficaVariants`
- risolve il fornitore dei top 5 via `useReferenceBatchPreviewMulti`
- costruisce top 5 sul solo periodo selezionato usando il bucket `currentPeriodTop`
- rende il confronto istogramma piu' leggibile con il resto schiarito
- mostra la legenda dei donut sotto il grafico

---

## 2) Note tecniche

- `SpeseOverview.tsx` orchestra fetch, varianti, preview reference e render
- `useSpeseOverviewComputed.ts` contiene solo derivazioni live
- `speseOverview.api-adapters.ts` filtra current window, normalizza date label e prepara top/upcoming/monthly
- `config.ts` contiene solo opzioni tempo, label periodo, palette e shape vuote live

---

## 3) Stato

- [x] reducer store collegato
- [x] fallback mock rimosso dal runtime live
- [x] import runtime dal file `mock.ts` eliminati
- [x] parsing importi con virgola reso robusto
- [x] label reali fornitore nel top 5
- [x] top 5 davvero riferito al periodo selezionato
