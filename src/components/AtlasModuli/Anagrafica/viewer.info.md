# Atlas Moduli - Anagrafica Viewer (Frontend)

> Percorso: `src/components/AtlasModuli/Anagrafica/AnagraficaViewer.tsx`

Questo documento descrive il comportamento attuale del **viewer** delle Anagrafiche.

Obiettivi:

1. chiarire cosa arriva al viewer
2. chiarire come agiscono varianti e field overrides
3. evidenziare i limiti attuali di rendering
4. preparare il terreno per una futura configurazione di layout piu' ricca

---

## 0) Flusso sintetico

Il viewer segue questo percorso:

1. riceve `type` e `id`
2. risolve `def = getAnagraficaDef(type)`
3. carica il record via Redux/API (`fetchAnagrafica`)
4. carica le varianti disponibili via `/api/anagrafiche/:type/variants`
5. legge il `variantId` del record
6. decide i `visibleKeys` in base alla variante del record
7. costruisce `infoFields`
8. renderizza `DetailInfoCard` + `AttachmentsPanel`

---

## 1) Cosa governa il viewer oggi

Il viewer e' guidato da tre livelli distinti:

### 1.1 Config dati del tipo

Da `getAnagraficaDef(type)` arrivano:

- label del tipo
- field map
- preview title
- detailCard

### 1.2 Dati del record

Dal backend arrivano:

- `data`
- `visibilityRoles`
- `attachments`
- timestamp

### 1.3 Varianti di viewer

Le varianti influenzano:

- `includeFields`
- `fieldOverrides`

Il viewer non espone piu' una scelta manuale della variante:

- la variante attiva e' quella dichiarata dalla scheda tramite `variantId`
- il viewer usa le API varianti solo per risolvere label e override corretti

Questo significa che la configurabilita' oggi agisce piu' sul **set di campi** e sul **formato**,
non ancora sul **layout semantico**.

---

## 2) Cosa fa bene il viewer attuale

### 2.1 Reference singola

Le reference singole sono gia' rese bene:

- il field viene riconosciuto
- viene recuperata una label leggibile
- viene mostrata una pill cliccabile

### 2.2 Varianti

Le varianti funzionano gia' come primo livello di personalizzazione:

- consentono di mostrare solo alcuni campi
- consentono override di formato
- consentono rename etichetta

### 2.3 Header card

Il viewer usa gia' `detailCard` del tipo per:

- cover
- avatar
- variante header
- dimensione avatar
- hover effect

Questo e' un buon punto di partenza per la futura personalizzazione della componente.

---

## 3) Limiti attuali del viewer

### 3.1 Rendering tipi ancora poco esteso

Il renderer gestisce bene soprattutto:

- `reference`
- `date`
- `number`
- `text`
- `email`
- `tel`

Tutto il resto tende a rientrare in un fallback semplice.

### 3.2 Mancanza di categorie di presentazione

Oggi i campi vengono trasformati in una lista piatta di `DetailField`.

Questo limita molto:

- mappe
- blocchi evidenza
- sezioni specializzate
- gruppi di campi vettoriali o ripetuti

Primo correttivo introdotto:

- per i campi multipli (`multiselect`, `labelArray`, `referenceMulti`, `numberArray`, `geoPointArray`)
  il viewer usa ora un contenitore collassabile a livello di field card, cosi' non rompe il layout su mobile e desktop
- il preview compatto mostra il primo valore e una pill `+x`
- l'espansione apre il contenitore del field stesso, non un widget interno
- se e' presente un `geoPoint`, il viewer mostra una sezione mappa sopra la griglia campi, subito sotto il titolo
- l'indirizzo resta sotto la mappa come supporto descrittivo

Aggiornamento successivo:

- i campi multipli espandibili sono stati resi piu' asciutti:
  - titolo del field
  - pill `N elementi`
  - toggle semplice `+ / -`
- la sezione mappa del viewer espone anche:
  - calcolo opzionale della distanza dalla posizione utente
  - link semplice verso Google Maps per la navigazione

### 3.3 Visibilita' multi-ruolo riallineata

- `visibilityRoles[]`

Con questo step il viewer mostra correttamente l'elenco ruoli aggregato.

### 3.4 Statistiche solo su pochi tipi

La modal statistiche oggi si attiva solo per:

- `select`
- `date`
- `number`

Scelta esplicita di questo step:

- niente stats per `boolean`
- niente stats per `multiselect`
- niente stats per `labelArray`
- niente stats per `referenceMulti`

Quando verranno introdotti nuovi gruppi di rendering, andra' deciso se:

- espandere i casi supportati
- oppure lasciare la statistica come funzione specialistica

---

## 4) Contratto attuale del viewer

### 4.1 Input

```ts
{
  type: string;
  id: string;
}
```

### 4.2 Dipendenze

- registry Anagrafica
- store Redux
- API anagrafiche by id
- API varianti
- batch preview reference

### 4.3 Output UI

Il viewer rende oggi:

- detail card principale
- pills tipo/variante/visibilita'
- attachments
- modal statistiche

---

## 5) Direzione di evoluzione del viewer

Il viewer va fatto evolvere da:

- lista piatta di campi

a:

- layout config-driven per sezioni

Le categorie future piu' naturali sono:

- `hero`
- `highlights`
- `references`
- `details`
- `geo`
- `repeaters`
- `attachments`

Questa evoluzione non richiede di cambiare il catalogo dati:

- richiede una nuova config di presentazione per slug

---

## 6) Decisione guida per i prossimi interventi

I prossimi interventi sul viewer dovranno seguire queste regole:

1. non introdurre logiche speciali hardcoded per singolo field
2. introdurre renderer per **categorie di tipo**
3. separare il piu' possibile:
   - dato
   - formato
   - layout
4. mantenere ogni step piccolo e testabile

## 7) Stato dopo il primo incremento widget

Con questo step il viewer supporta ora in modo esplicito anche:

- `boolean`
- `multiselect`
- `labelArray`
- `referenceMulti`
- `numberArray`
- `rangeNumber`
- `rangeDate`
- `geoPoint`
- `geoPointArray`
- `pairNumber`
- `labelValuePairs`
- `keyValueNumber`
- `address`

Il supporto e' ancora dentro la grammatica attuale della detail card,
ma rappresenta gia' il primo allineamento concreto fra catalogo tipi e UI.
