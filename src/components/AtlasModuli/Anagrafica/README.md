# Atlas Moduli - Anagrafica

> Percorso: `src/components/AtlasModuli/Anagrafica/*`
>
> Stato documento: `step 1` - censimento iniziale e matrice supporto

Questo documento apre la fase di lavoro sulla parte `api/front` delle Anagrafiche,
in continuita' con la riparcellizzazione e la documentazione gia' introdotte lato:

- `src/server-utils/service/Anagrafiche/list/*`
- `src/server-utils/service/Anagrafiche/mutations/*`
- `src/app/api/anagrafiche/[type]/*`

Obiettivo di questo primo step:

1. fotografare lo stato reale della catena `config -> api -> store -> list -> viewer -> edit`
2. evidenziare i gap fra `FieldInputType` supportati a config/backend e quelli davvero gestiti dal front
3. preparare una checklist progressiva da usare come registro di avanzamento

Questo file non propone ancora modifiche dirette al codice applicativo: serve come base di lavoro,
allineamento e controllo dello stato.

Documenti collegati:

- `src/components/AtlasModuli/Anagrafica/AnagraficheList/info.md`
- `src/components/AtlasModuli/Anagrafica/viewer.info.md`
- `src/components/AtlasModuli/Anagrafica/edit.info.md`
- `src/components/AtlasModuli/Anagrafica/maps.plan.md`

---

## 0) Mappa del sistema

Per le Anagrafiche il flusso attuale e' questo:

1. `src/config/anagrafiche.fields.catalog.ts`
   definisce il catalogo dei tipi di campo (`FieldInputType`) e i field riusabili
2. `src/config/anagrafiche.types.public.ts`
   definisce i tipi anagrafica pubblici e i campi usati da ogni slug
3. `src/config/anagrafiche.registry.ts`
   costruisce il registry runtime (`getAnagraficaDef`)
4. `src/server-utils/models/Anagrafiche/*`
   genera model e indici in base al registry
5. `src/server-utils/service/Anagrafiche/*`
   applica list, get, create, update, delete, casting e projection
6. `src/app/api/anagrafiche/*`
   espone gli endpoint Next.js
7. `src/components/Store/*`
   gestisce i DTO FE e le chiamate API
8. `src/components/AtlasModuli/Anagrafica/*`
   rende list, viewer, edit e varianti lato UI

---

## 1) Stato attuale per area

### 1.1 Config

La parte config-driven e' gia' solida:

- il catalogo field types e' ampio e include anche tipi evoluti:
  `multiselect`, `labelArray`, `referenceMulti`, `rangeNumber`, `rangeDate`,
  `geoPoint`, `geoPointArray`, `pairNumber`, `numberArray`, `labelValuePairs`,
  `keyValueNumber`, `address`
- il registry e' gia' il punto unico di verita' per i tipi anagrafica
- il model dinamico legge il registry e genera collection e indici senza dipendere
  dalla forma attuale del file sorgente dei type

Conclusione:

- la futura riparcellizzazione delle config e' compatibile con l'architettura esistente
- lo step critico non e' il backend di definizione, ma l'allineamento del front

### 1.2 Backend service / mutations

La parte service e mutations e' gia' piu' avanzata del front:

- la list e' documentata e riparcellizzata a pipeline
- la mutation applica casting server-side config-driven sui tipi avanzati
- create/update usano gia' il catalogo in modo serio e coerente con la sparse strategy

Conclusione:

- il backend e' gia' pronto per molti tipi che il front non sfrutta ancora

### 1.3 API

Le API sono gia' state separate in modo leggibile, ma c'e' ancora un disallineamento
fra documentazione desiderata e comportamento reale del tratto `by id`.

Punti importanti:

- collection route: ben allineata al nuovo contratto list/create
- item route: leggibile, ma `GET by id` non e' ancora pienamente riallineata
  al modello ACL row-level della list

### 1.4 Front list

La list anagrafiche ha gia' un primo paradigma di configurazione UI per slug:

- usa projection dinamica
- puo' derivare colonne e title/subtitle dalla config
- ha una prima configurazione per slug in `anagrafiche.list.ui.ts`

Limiti attuali:

- la configurazione UI e' presente solo per alcuni slug
- la formattazione valori supporta pochi tipi
- il filtro `ownerOnly` usa ancora il valore sentinella `"OWNER"` e va ripensato

### 1.5 Front viewer

Il viewer ha gia':

- supporto reference singola con pill
- supporto varianti di visualizzazione
- detail card configurabile con `detailCard`
- attachments e modal statistiche

Limiti attuali:

- il rendering dei campi e' ancora centrato soprattutto su `text/date/number`
- i tipi strutturati o array non hanno una visualizzazione dedicata
- la visibilita' e' stata riallineata a `visibilityRoles[]` in edit/viewer; resta aperto il filtro list `OWNER`

### 1.6 Front edit

L'edit ha gia' alcuni punti buoni:

- filtra i campi per variante
- usa un form comune
- gestisce attachments e create/update

Limiti attuali:

- il renderer dei field widget copre solo `reference`, `textarea`, `select`, input semplici
- la visibilita' e' stata riallineata a `visibilityRoles[]`; resta aperto il filtro storico `OWNER` nella list
- i tipi complessi del catalogo non hanno ancora un widget dedicato

---

## 2) Evidenze tecniche raccolte

### 2.1 Field types presenti nel catalogo

Il catalogo dichiara esplicitamente molti tipi avanzati:

- `src/config/anagrafiche.fields.catalog.ts`

Questo e' il riferimento da considerare come fonte di verita' semantica.

### 2.2 Backend gia' pronto per tipi avanzati

Il builder di mutation supporta gia':

- array di stringhe
- array numerici
- boolean
- range numerici e data
- geopoint e array di geopoint
- coppie numeriche
- coppie label/value
- mappe key/value numeriche
- address

Riferimento:

- `src/server-utils/service/Anagrafiche/mutations/builders/data.ts`

### 2.3 EditForm ancora limitato

Il form comune oggi ha widget espliciti solo per:

- `reference`
- `textarea`
- `select`
- input base `date/email/tel/number/text`

Riferimento:

- `src/components/AtlasModuli/common/EditForm.tsx`

### 2.4 Viewer ancora limitato

Il viewer:

- gestisce bene le reference singole
- formatta bene alcuni casi text/number/date
- non ha ancora categorie visuali dedicate per i tipi strutturati

Riferimento:

- `src/components/AtlasModuli/Anagrafica/AnagraficaViewer.tsx`

### 2.5 Visibilita' disallineata

Il modello FE e il backend usano `visibilityRoles?: string[]`.

Con questo step edit e viewer sono stati riallineati alla multi-visibilita'.
Resta aperto il tratto list/filtro "solo miei", che usa ancora il placeholder `OWNER`.

---

## 3) Matrice supporto field types

Legenda:

- `SI` = supporto esplicito e coerente
- `PARZ` = supporto parziale o solo fallback
- `NO` = non gestito in modo dedicato

| FieldInputType | Config | Backend cast | List format | Viewer | Edit |
| --- | --- | --- | --- | --- | --- |
| `text` | SI | SI | PARZ | SI | SI |
| `email` | SI | SI | PARZ | SI | SI |
| `tel` | SI | SI | PARZ | SI | SI |
| `textarea` | SI | SI | PARZ | PARZ | SI |
| `number` | SI | SI | SI | SI | SI |
| `date` | SI | SI | SI | SI | SI |
| `select` | SI | SI | SI | PARZ | SI |
| `boolean` | SI | SI | SI | SI | SI |
| `multiselect` | SI | SI | SI | SI | SI |
| `labelArray` | SI | SI | SI | SI | SI |
| `reference` | SI | SI | PARZ | SI | SI |
| `referenceMulti` | SI | SI | SI | SI | SI |
| `numberArray` | SI | SI | SI | SI | SI |
| `rangeNumber` | SI | SI | SI | SI | SI |
| `rangeDate` | SI | SI | SI | SI | SI |
| `geoPoint` | SI | SI | SI | SI | SI |
| `geoPointArray` | SI | SI | SI | SI | SI |
| `pairNumber` | SI | SI | SI | SI | SI |
| `labelValuePairs` | SI | SI | SI | SI | SI |
| `keyValueNumber` | SI | SI | SI | SI | SI |
| `address` | SI | SI | SI | SI | SI |

### 3.1 Lettura della matrice

La situazione reale e' questa:

- il contratto dominio/backend e' molto piu' maturo del contratto UI
- viewer ed edit non sono ancora allineati al catalogo
- la list e' avanti come struttura, ma non ancora come copertura di tutti i tipi

Conclusione operativa:

- la prossima fase non deve inventare nuovi tipi
- deve tradurre nel front i tipi che il backend gia' comprende

---

## 4) Punti deboli emersi

### 4.1 Contratto visibilita' incoerente

Il sistema dati usa `visibilityRoles[]`.
Con questo step il mismatch principale e' stato corretto in edit/viewer, ma la list
mantiene ancora il filtro storico `visibilityRole: "OWNER"` per il toggle "solo miei".

Rischi:

- semantica incoerente fra list e dettaglio
- filtro "solo miei" accoppiato a un ruolo sentinella
- debito tecnico finche' il tratto list non viene ripulito

### 4.2 GET by id ancora non allineato alla list ACL

Il documento API lo segnala gia' come punto aperto: la lettura singola va riallineata
al principio "non puoi leggere cio' che non vedi".

Rischi:

- incoerenza fra list e dettaglio
- comportamento meno sicuro o meno prevedibile

### 4.3 Viewer troppo piatto per tipi strutturati

Oggi il viewer rende quasi tutto come valore semplice in card.

Conseguenza:

- i tipi avanzati, anche quando sono corretti a database, non trovano una forma leggibile

Nota aggiornata:

- i campi multipli principali ora usano una resa collassabile/espandibile a livello di field card
- il preview mostra il primo valore e, se presenti, `e altri x...`
- resta comunque da progettare una vera grammatica viewer per sezioni e priorita' visive

### 4.4 EditForm troppo generico

Il form comune oggi non e' ancora un renderer per widget config-driven, ma un form dinamico
con pochi casi speciali.

Conseguenza:

- ogni nuovo tipo complesso richiede refactor del form comune

### 4.5 Config UI list ancora incompleta

Il file:

- `src/components/AtlasModuli/Anagrafica/AnagraficheList/anagrafiche.list.ui.ts`

e' il seme corretto del paradigma UI per slug, ma non copre ancora l'intero sistema.

### 4.6 Search list ancora da affinare

La search list e' stata spostata a modalita' esplicita:

- input locale mentre si digita
- fetch solo su bottone `Cerca` o tasto `Enter`

Questo riduce le chiamate durante la digitazione.

Resta da valutare se applicare lo stesso paradigma anche ad altri filtri o introdurre pulsanti `Cerca` / `Reset`.

### 4.7 Config anagrafiche ancora monolitica

Il file:

- `src/config/anagrafiche.types.public.ts`

contiene troppi tipi in un unico punto.

Conseguenza:

- cresce bene solo fino a una certa soglia
- rende piu' faticosa la manutenzione per gruppi di anagrafiche

---

## 5) Direzione di lavoro confermata

Dal censimento emerge che il piano piu' credibile e' questo:

1. completare il tratto documentale `api/front`
2. costruire la matrice widget/rendere per i field types mancanti
3. introdurre una config di presentazione per viewer/list, distinta dal solo catalogo dati
4. consolidare la visibilita' multi-ruolo anche nei filtri list
5. spezzare le config type in piu' file mantenendo invariato il registry runtime

---

## 6) Checklist iniziale di avanzamento

### 6.1 Step 1 - censimento e allineamento iniziale

- [x] mappare il flusso `config -> api -> store -> list -> viewer -> edit`
- [x] costruire una matrice iniziale dei field types
- [x] individuare i gap principali fra backend e front
- [x] individuare i punti deboli strutturali gia' visibili
- [ ] validare insieme l'ordine di priorita' delle implementazioni front

### 6.2 Step 2 - documentazione api/front

- [x] documentare il contratto list FE
- [x] documentare il contratto viewer FE
- [x] documentare il contratto edit FE
- [x] documentare il ruolo delle varianti
- [ ] documentare il ruolo della list UI config per slug

### 6.3 Step 3 - supporto tipi nel viewer/edit

- [x] boolean
- [x] multiselect
- [x] labelArray
- [x] referenceMulti
- [x] numberArray
- [x] rangeNumber
- [x] rangeDate
- [x] geoPoint
- [x] geoPointArray
- [x] pairNumber
- [x] labelValuePairs
- [x] keyValueNumber
- [x] address

### 6.4 Step 4 - riallineamenti strutturali

- [x] riallineare `visibilityRole` a `visibilityRoles[]` in edit/viewer
- [ ] riallineare `GET by id` al modello ACL row-level
- [ ] superare il placeholder `"OWNER"` nella list
- [ ] progettare la config viewer per slug
- [ ] progettare la riparcellizzazione dei type in cartella

### 6.5 Sandbox di test UI

- [x] aggiungere uno slug reale di test per i field types front
- [x] esporre lo slug di test in navigazione
- [x] configurare campi `titolo + boolean + multiselect`
- [x] aggiungere `labelArray` e `referenceMulti` nello slug sandbox
- [x] usare lo slug per validare i prossimi widget front

---

## 7) Appunti per la fase successiva

Quando iniziera' lo step 2, il prossimo documento dovra' concentrarsi su:

- contratti FE reali
- confini fra dati, presentazione e varianti
- modello di configurazione del viewer
- ordine di implementazione dei widget mancanti

L'ordine consigliato per il lavoro pratico sui tipi e':

1. `boolean`
2. `multiselect` e `labelArray`
3. `referenceMulti`
4. `rangeNumber` e `rangeDate`
5. `address`
6. `numberArray` e `pairNumber`
7. `geoPoint` e `geoPointArray`
8. `labelValuePairs` e `keyValueNumber`

Motivazione:

- i primi gruppi danno subito valore gestionale
- i gruppi geo e strutturati richiedono invece una decisione UI piu' accurata

## 8) Nota aggiornata sul viewer

Con l'ultimo step il viewer segue due regole nuove:

- la variante non e' piu' una scelta manuale a tendina, ma viene derivata dal `variantId` del record
- i campi multipli mostrano il primo valore e una pill `+x`, poi si espandono a livello di card

Questo rende la scheda piu' fedele al dato reale e piu' stabile visivamente.

## 9) Piano mappe

La pianificazione per l'integrazione mappe e' stata aperta in:

- `src/components/AtlasModuli/Anagrafica/maps.plan.md`

Il documento definisce:

- modello dati consigliato
- contratti API da introdurre
- comportamento edit/viewer
- roadmap a step testabili

Stato attuale mappe:

- [x] step M1 completato
- [x] step M2 completato
- [x] step M3 completato
- [x] step M4 completato in forma iniziale
- [ ] step M5 in attesa

Provider attualmente predisposti:

- `geoapify`
- `mapbox`

Lo switch e' centralizzato in:

- `src/config/maps.config.ts`

Nota aggiornata sull'ultimo incremento mappe:

- il viewer promuove la mappa sopra la griglia campi, subito sotto il titolo, quando trova un `geoPoint`
- l'edit mostra sempre una mappa anche con `geoPoint` vuoto, usando un centro iniziale configurabile
- la ricerca posizione avviene ora direttamente nel campo `geoPoint`, senza passare da una modal
- il pin della mappa edit e' trascinabile e la mappa accetta click per spostare il punto
- l'autocompilazione `address <- geopoint` riusa prima la selezione gia' scelta in ricerca e solo dopo cade sul reverse geocode
- il viewer aggiunge azioni semplici per `Distanza da me` e `Apri navigazione`
- il centro iniziale di default e' configurabile in `src/config/maps.config.ts`
- il pannello address usa binding esplicito `address -> geopoint` tramite scelta del campo geo sorgente

Stato sintetico del piano ad oggi:

- completata la documentazione base `list / viewer / edit`
- completato l'allineamento dei field types principali nel front
- completato il primo blocco mappe con provider switch, geocode/reverse geocode, viewer top map e edit interattivo
- aperti ma non ancora chiusi i lavori su:
  - ACL `GET by id`
  - filtro list `OWNER`
  - config viewer per slug
  - riparcellizzazione "galassia di file" delle config anagrafiche
  - supporto mappa evoluto per `geoPointArray`
