# Atlas Moduli - Bilancio

> Percorso: `src/components/AtlasModuli/Bilancio/*`
>
> Documento collegato: `src/components/AtlasModuli/financials.plan.md`

`Bilancio` resta un orchestratore di `Spese` e `Ricavi`, ma ora e' stato riallineato al flusso live reale.

---

## 0) Flusso sintetico

1. `useSpeseAnalyticsSource` + `useSpeseOverviewComputed`
2. `useRicaviAnalyticsSource` + `useRicaviOverviewComputed`
3. `useBilancioTotals`
4. `bilancio.compute.ts`
5. `bilancio.fiscal.ts`
6. `bilancio.monthly.live.ts`
7. `BilancioOverview.tsx`

---

## 1) Cosa e' live adesso

- gauge ricavi/spese del periodo
- utile fiscale e simulatore tassa utile
- confronto mensile ricavi vs spese
- movimenti recenti aggregati dai bucket live di spese e ricavi
- KPI secondari derivati dal periodo invece di tile mock
- note laterali calcolate dal saldo/margine del filtro

---

## 2) Correzioni introdotte

- rimosso il vecchio switch runtime `useMock` dal wiring principale
- sostituiti `BILANCIO_MOVIMENTI_MOCK` e `BILANCIO_TILES_MOCK` come fonte runtime
- mantenuto il pattern sticky per evitare flash durante i refresh
- formattazione monetaria non piu' compressa a interi forzati
- legenda donut resa coerente con gli altri moduli
- costanti di periodo spostate in `config.ts` invece del file `mock.ts`

---

## 3) Stato

- [x] legge davvero `Spese` e `Ricavi`
- [x] ultimi movimenti alimentati da feed live
- [x] KPI secondari alimentati da medie/margini reali
- [x] copy UI principale non dichiara piu' il mock come stato corrente
- [x] import runtime dal file `mock.ts` eliminati
- [x] lint mirato pulito sui file toccati
