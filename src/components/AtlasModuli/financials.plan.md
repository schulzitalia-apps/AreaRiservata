# Atlas Moduli - Piano Spese, Ricavi, Bilancio

> Percorso: `src/components/AtlasModuli/{Spese,Ricavi,Bilancio}/*`
>
> Stato documento: `step 3` - live-only, config separate dai mock storici, top periodali e bilancio ripulito

Questo documento tiene allineata la triade `Spese / Ricavi / Bilancio` con il lavoro reale fatto sul codice.

Documenti collegati:

- `src/components/AtlasModuli/Spese/README.md`
- `src/components/AtlasModuli/Ricavi/README.md`
- `src/components/AtlasModuli/Bilancio/README.md`

---

## 0) Obiettivo del refactor

1. eliminare il fallback ai mock come comportamento implicito
2. usare dati live reali per top, grafici e bilancio
3. risolvere label varianti/reference tramite config-driven atlas
4. rendere leggibili i numeri monetari anche con formati locali e decimali

---

## 1) Stato attuale consolidato

- [x] `financialsSlice` montato nello store Redux reale
- [x] `Spese` e `Ricavi` passati a flusso live-only
- [x] top 5 calcolati sul solo periodo selezionato
- [x] tabs e categorie alimentate dalle varianti reali
- [x] controparti top 5 risolte con preview reference al posto degli id Mongo
- [x] grafico barre con resto piu' chiaro per il confronto
- [x] legenda donut portata sotto al grafico
- [x] `Bilancio` riportato su feed live per movimenti e KPI secondari
- [x] formattazione bilancio non piu' arrotondata forzatamente a interi
- [x] costanti UI spostate in file `config.ts` separati dai dati mock storici

---

## 2) Note architetturali

### 2.1 Spese / Ricavi

Il flusso reale resta:

1. page
2. overview
3. analytics source hook
4. redux slice / service
5. route api
6. service server-side
7. adapter FE
8. computed hook
9. grid / charts

### 2.2 Bilancio

`Bilancio` non ha una sua API dedicata.
Compone `Spese` e `Ricavi`, ma ora lo fa senza dipendere dai blocchi mock storici per:

- ultimi movimenti
- KPI secondari del pannello
- note laterali

---

## 3) Checklist operativa

### 3.1 Stabilizzazione live

- [x] rimuovere il fallback live -> mock
- [x] mantenere sticky data quando utile e non fake data
- [x] riallineare overview, header e source hook dopo la rimozione del toggle mock

### 3.2 Accuratezza dati

- [x] parsing robusto di valori con virgola/punti
- [x] top 5 filtrati sul current window effettivo
- [x] date label esplicite nelle card top 5
- [x] label reference reali per fornitore/cliente

### 3.3 Pulizia bilancio

- [x] togliere dipendenza runtime da `BILANCIO_MOVIMENTI_MOCK`
- [x] sostituire `BILANCIO_TILES_MOCK` con KPI calcolati
- [x] rimuovere copy UI che dichiarava ancora il mock come stato corrente

### 3.4 Verifica

- [x] lint mirato sui file toccati
- [ ] validazione visuale finale su dataset reale per rifinitura UX

---

## 4) Prossimo step consigliato

1. test visuale reale su `Spese`, `Ricavi`, `Bilancio`
2. eventuale rifinitura copy/spacing delle legend donut e delle top card
3. se serve, estrazione dei nuovi helper live di `Bilancio` in file dedicati
4. quando il team vorra', cancellazione fisica dei vecchi `mock.ts` ormai fuori dal runtime
