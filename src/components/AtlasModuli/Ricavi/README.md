# Atlas Moduli - Ricavi

> Percorso: `src/components/AtlasModuli/Ricavi/*`
>
> Documento collegato: `src/components/AtlasModuli/financials.plan.md`

Il modulo `Ricavi` segue ora lo stesso contratto live-only di `Spese`.

---

## 0) Flusso sintetico

1. `src/app/ricavi/page.tsx`
2. `src/components/AtlasModuli/Ricavi/RicaviOverview.tsx`
3. `useRicaviAnalyticsSource`
4. `financialsSlice` / `financialsService`
5. route API analytics ricavi
6. `src/server-utils/service/ricaviAnalytics.ts`
7. adapter FE + `useRicaviOverviewComputed`
8. `Grid1` / `Grid2`

---

## 1) Cosa fa adesso

- usa dati live senza fallback automatico a mock
- usa costanti UI da `config.ts`, senza import runtime dal vecchio `mock.ts`
- risolve le label delle varianti reali via `useAnagraficaVariants`
- risolve il cliente del top 5 via preview reference
- costruisce top 5 sul current window del filtro scelto
- allinea i donut alla legenda esterna sotto il grafico
- mantiene il confronto mese-per-mese sul solo periodo corrente

---

## 2) Note tecniche

- `RicaviOverview.tsx` arricchisce il top 5 con label cliente reali
- `useRicaviOverviewComputed.ts` e' stato ripulito dalla logica ibrida mock/live
- `ricaviOverview.api-adapters.ts` normalizza date, filtri periodali e bucket top/upcoming
- `config.ts` raccoglie solo costanti UI e shape live vuote

---

## 3) Stato

- [x] reducer store collegato
- [x] runtime live-only su overview e computed
- [x] import runtime dal file `mock.ts` eliminati
- [x] parsing importi locale migliorato
- [x] label cliente reali nel top 5
- [x] top 5 coerente con il solo periodo selezionato
