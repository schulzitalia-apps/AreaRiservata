# Atlas Moduli - Anagrafica Edit (Frontend)

> Percorso: `src/components/AtlasModuli/Anagrafica/AnagraficaEdit.tsx`
>
> Form comune: `src/components/AtlasModuli/common/EditForm.tsx`

Questo documento descrive il comportamento attuale dell'**edit frontend** delle Anagrafiche.

Scopo:

1. chiarire il contratto di create/update lato UI
2. distinguere i ruoli di `AnagraficaEdit` e `EditForm`
3. fissare i limiti attuali del renderer di campi
4. preparare una roadmap per widget config-driven

---

## 0) Flusso sintetico

Il tratto edit segue oggi questo flusso:

1. `AnagraficaEdit.tsx`
   risolve `def`
2. se siamo in edit:
   carica il record via `fetchAnagrafica`
3. carica le varianti disponibili
4. decide i `visibleFieldKeys` in base alla variante selezionata
5. costruisce `fieldsForForm`
6. costruisce `initial`
7. passa tutto a `EditForm`
8. su submit:
   - compone `mergedData`
   - aggiunge `variantId`
   - chiama create o update
9. se siamo in create e ci sono allegati in coda:
   - crea prima il record
   - poi carica i documenti accodati

---

## 1) Ruoli distinti

### 1.1 `AnagraficaEdit.tsx`

Responsabilita':

- load record
- load varianti
- decidere campi visibili
- preparare dati iniziali
- orchestrare submit create/update
- gestire attachments

### 1.2 `EditForm.tsx`

Responsabilita':

- renderizzare i widget dei campi
- gestire stato locale del form
- normalizzare il payload di submit

Problema attuale:

- `EditForm` e' ancora un renderer dinamico con pochi casi speciali,
  non ancora un vero **widget engine config-driven**

---

## 2) Varianti nell'edit

Le varianti oggi influenzano:

- quali campi mostrare
- quale `variantId` salvare nel record

Questo e' gia' utile, ma porta una conseguenza tecnica:

- `AnagraficaEdit.tsx` oggi lavora molto sulla selezione dei campi,
  ma poco ancora sulla semantica dei widget

Quindi:

- la variante sceglie **quali campi**
- il form comune decide ancora in modo troppo rigido **come renderizzarli**

---

## 3) Contratto attuale del form

Il form oggi supporta esplicitamente:

- `reference`
- `referenceMulti`
- `textarea`
- `select`
- `boolean`
- `multiselect`
- `labelArray`
- `numberArray`
- `rangeNumber`
- `rangeDate`
- input base per:
  - `date`
  - `email`
  - `tel`
  - `number`
  - `text`

Tutto cio' che non rientra in questi casi viene ricondotto a un input base.

Conseguenza:

- il catalogo dati e il backend possono gia' gestire piu' tipi del form stesso

---

## 4) Visibilita'

L'edit tratta ora la visibilita' come:

- `visibilityRoles: string[]`

Questo allinea il form al modello dati reale.

Resta aperto solo il tema list/filtro "solo miei", non il contratto di edit.

---

## 5) Limiti attuali dell'edit

### 5.1 Nessun widget dedicato per i tipi complessi

Oggi i widget dedicati mancanti riguardano soprattutto eventuali evoluzioni future
di UX specialistica, non piu' la copertura base dei tipi del catalogo.

### 5.2 Logica form troppo centralizzata

Il renderer e' concentrato in `EditForm.tsx`.

Direzione futura:

- introdurre componenti piccoli per famiglia di tipo
- lasciare a `EditForm` il ruolo di orchestratore

### 5.3 Merge dati da monitorare quando arriveranno tipi strutturati

Con campi semplici il merge e' lineare.

Con campi complessi diventera' importante verificare bene:

- valori vuoti
- reset
- array
- oggetti annidati

Questo va tenuto sotto controllo step per step.

---

## 6) Direzione di evoluzione del form

L'evoluzione consigliata e':

1. tenere `AnagraficaEdit.tsx` come orchestratore
2. trasformare `EditForm.tsx` in dispatcher di widget
3. introdurre un widget per famiglia di tipo
4. documentare ogni widget nuovo quando viene introdotto

Famiglie di widget suggerite:

- `ScalarInputs`
- `ChoiceInputs`
- `ReferenceInputs`
- `RangeInputs`
- `GeoInputs`
- `ArrayInputs`
- `StructuredInputs`

---

## 7) Ordine raccomandato dei prossimi widget

Per valore pratico e rischio contenuto, l'ordine migliore e':

1. `boolean`
2. `multiselect`
3. `labelArray`
4. `referenceMulti`
5. `rangeNumber`
6. `rangeDate`
7. `address`
8. `numberArray`
9. `pairNumber`
10. `geoPoint`
11. `geoPointArray`
12. `labelValuePairs`
13. `keyValueNumber`

## 8) Stato dopo il secondo incremento widget

Con questo step il form supporta ora:

- `boolean` tramite selezione tri-state implicita:
  `non impostato / sì / no`
- `multiselect` tramite selezione multipla a pill
- `labelArray` tramite tag liberi con input `+`
- `referenceMulti` tramite ricerca e selezione multipla di reference
- `numberArray` tramite input incrementale con chip numerici
- `rangeNumber` tramite coppia `da / a`
- `rangeDate` tramite coppia `inizio / fine`
- `geoPoint` tramite coppia `lat / lng`
- `geoPointArray` tramite lista incrementale di coppie coordinate
- `pairNumber` tramite coppia `a / b`
- `labelValuePairs` tramite righe `label / value`
- `keyValueNumber` tramite righe `key / value`
- `address` tramite form strutturato `via / citta' / cap / provincia / paese / extra`
- `visibilityRoles[]` tramite selezione multi-ruolo
- allegati anche in create, con coda locale fino al primo salvataggio

Incremento mappe del form:

- `geoPoint` ha ora una preview mappa dedicata anche senza token client-side
- se il campo e' vuoto, il form mostra un centro iniziale configurabile
- la ricerca posizione avviene direttamente nel widget `geoPoint`
- la selezione aggiorna il `geoPoint`
- il pin e' trascinabile e il click in mappa sposta il punto
- il widget usa una mappa interattiva reale basata su Leaflet
- ogni campo `address` puo' autocompilarsi scegliendo esplicitamente il `geoPoint` sorgente
- non esiste piu' autocompilazione implicita "a caso" su `address` multipli
- quando una ricerca e' stata appena selezionata, l'autocompilazione dell'indirizzo riusa prima quell'address in cache

Questa scelta mantiene la compatibilita' con la sparse strategy backend:

- `boolean` puo' ancora essere non valorizzato
- `multiselect` resta coerente con il catalogo a options controllate

Questo ordine aiuta a:

- sbloccare prima i casi gestionali piu' comuni
- lasciare i casi piu' visuali o strutturati a un momento in cui il viewer
  e il sistema di layout saranno gia' piu' chiari
