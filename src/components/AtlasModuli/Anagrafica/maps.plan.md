# Atlas Moduli - Piano Integrazione Mappe

> Percorso: `src/components/AtlasModuli/Anagrafica/maps.plan.md`

Questo documento apre la pianificazione per integrare le mappe nelle Anagrafiche,
senza introdurre ancora codice di provider specifico.

Obiettivi:

1. mantenere `geoPoint` come dato canonico e stabile del dominio
2. definire il tratto API necessario senza cambiare la natura dei campi
3. chiarire come deve comportarsi edit e viewer
4. spezzare il lavoro in step piccoli e testabili

---

## 0) Obiettivo funzionale

La funzione desiderata e' questa:

- in edit devo poter scegliere una posizione da mappa
- il dato salvato deve restare `geoPoint` e deve restare leggibile anche senza provider mappe
- nel viewer la mappa deve comparire al posto della sola via
- l'etichetta indirizzo deve restare presente come sezione testuale

In termini pratici:

- la mappa e' la rappresentazione visuale primaria
- `geoPoint` e' il dato sorgente della localizzazione
- l'indirizzo resta un arricchimento descrittivo
- il provider non deve entrare nel modello dominio

---

## 1) Modello dati consigliato

Principio guida:

- `geoPoint` non cambia natura
- `geoPoint` e' il dato canonico che viene salvato
- i servizi mappe lavorano al servizio di `geoPoint`
- `address` puo' affiancarlo come descrizione, ma non lo sostituisce

Struttura consigliata minima:

```ts
{
  indirizzo: {
    street?: string;
    city?: string;
    zip?: string;
    province?: string;
    country?: string;
    extra?: string;
  },
  posizione: {
    lat: number;
    lng: number;
  }
}
```

Per non sporcare il dominio, eventuali metadati provider non vanno salvati nel record
come parte obbligatoria del modello. Se in futuro servissero, vanno trattati come
cache o dato tecnico separato, non come struttura primaria di anagrafica.

Decisione guida:

- il dato di business canonico della mappa resta `geoPoint`
- `address` e' complementare, non sostitutivo
- il provider non ridefinisce mai la struttura dominio

---

## 2) Contratto API da introdurre

Per tenere il frontend pulito, il tratto mappe va dietro API interne.

### 2.1 Geocoding testo -> coordinate

Endpoint proposto:

- `GET /api/maps/geocode?q=...`

Responsabilita':

- riceve testo libero o indirizzo composto
- interroga il provider configurato
- restituisce una lista normalizzata di risultati con `geoPoint` compatibile col dominio

Risposta minima consigliata:

```ts
{
  items: Array<{
    label: string;
    geoPoint: {
      lat: number;
      lng: number;
    };
    address?: {
      street?: string;
      city?: string;
      zip?: string;
      province?: string;
      country?: string;
    };
  }>;
}
```

### 2.2 Reverse geocoding coordinate -> indirizzo

Endpoint proposto:

- `GET /api/maps/reverse-geocode?lat=...&lng=...`

Responsabilita':

- riceve `geoPoint`
- restituisce label leggibile e address strutturato

### 2.3 Config client mappe

Endpoint opzionale:

- `GET /api/maps/config`

Responsabilita':

- espone solo config sicure lato client
- definisce provider attivo
- espone eventuale public token per tiles o SDK client

Questo evita di spargere env e condizioni nel frontend.

---

## 3) Architettura consigliata

### 3.1 Layer provider

Sul server conviene creare un adapter unico:

- `src/server-utils/service/Maps/*`

Struttura suggerita:

- `maps.types.ts`
- `maps.provider.ts`
- `providers/googleMaps.ts`
- `providers/mapbox.ts`
- `providers/osm.ts`
- `normalizers.ts`

Questo permette di cambiare provider senza cambiare:

- form edit
- viewer
- contratto API FE
- struttura dominio di `geoPoint`

### 3.2 Route API

Struttura suggerita:

- `src/app/api/maps/geocode/route.ts`
- `src/app/api/maps/reverse-geocode/route.ts`
- `src/app/api/maps/config/route.ts`

### 3.3 Frontend componenti

Struttura suggerita:

- `src/components/AtlasModuli/common/maps/MapPicker.tsx`
- `src/components/AtlasModuli/common/maps/MapPreview.tsx`
- `src/components/AtlasModuli/common/maps/useMapProvider.ts`

---

## 4) Comportamento edit

L'edit dovrebbe offrire:

1. campi address strutturati
2. preview mappa
3. bottone o modal per scegliere il punto
4. sincronizzazione fra click su mappa e form

Flusso consigliato:

1. l'utente apre il widget mappa
2. cerca un indirizzo oppure clicca il punto
3. il client riceve un `geoPoint`
4. il client chiama reverse geocode
5. il form aggiorna:
   - `geoPoint`
   - `address`

Decisione UX importante:

- il form deve restare usabile anche senza provider disponibile

Quindi il fallback minimo resta:

- lat/lng manuali
- address manuale

---

## 5) Comportamento viewer

Nel viewer la gerarchia consigliata e':

1. mappa preview
2. etichetta indirizzo
3. eventuali coordinate

Pattern suggerito:

- se esiste `geoPoint`, mostra una card mappa dedicata
- se esiste anche `address`, mostra sotto la label indirizzo
- se esiste solo `address`, mostra la card testuale
- se esiste solo `geoPoint`, mostra coordinate e mappa

Direzione UI:

- la mappa non va trattata come un field normale in griglia
- va promossa a sezione `geo`

Questo e' coerente con la futura configurazione viewer per sezioni.

---

## 6) Sicurezza e responsabilita'

Le chiavi private non devono stare nel browser.

Quindi:

- geocoding e reverse geocoding vanno dietro API server
- eventuali token pubblici per tiles o SDK client vanno separati
- caching e rate limit vanno gestiti lato server

Punti da prevedere:

- debounce query geocoding
- cache risultati per query/coordinate
- gestione quota provider
- fallback errore provider

---

## 7) Step operativi consigliati

### Step M1 - Contratto e documentazione

- fissare `geoPoint` come dato canonico della localizzazione
- definire il ruolo complementare di `address`
- documentare il contratto API
- decidere il provider iniziale

Stato:

- [x] completato
- provider iniziali predisposti: `Geoapify` e `Mapbox`

Test:

- review documentale del contratto

### Step M2 - Adapter server

- creare service `Maps`
- creare normalizzazione comune risultati
- aggiungere route `geocode` e `reverse-geocode`

Stato:

- [x] completato

File introdotti:

- `src/config/maps.config.ts`
- `src/server-utils/service/Maps/index.ts`
- `src/server-utils/service/Maps/maps.types.ts`
- `src/server-utils/service/Maps/providers/mapbox.ts`
- `src/server-utils/service/Maps/providers/geoapify.ts`
- `src/app/api/maps/config/route.ts`
- `src/app/api/maps/geocode/route.ts`
- `src/app/api/maps/reverse-geocode/route.ts`

Test:

- chiamate API con query e coordinate di esempio

### Step M3 - Widget edit

- creare `MapPicker`
- agganciare `geoPoint` come valore primario del widget
- aggiornare `address` come informazione complementare
- mantenere fallback manuale

Stato:

- [x] completato

Con questo primo incremento il widget edit offre:

- preview mappa del `geoPoint`
- centro iniziale configurabile quando il `geoPoint` e' vuoto
- ricerca indirizzo inline nel widget
- selezione risultato geocoding
- aggiornamento del `geoPoint`
- binding esplicito `address -> geopoint` per l'autocompilazione reverse geocode
- drag del marker e click in mappa per ricalcolare posizione e address

Limitazione esplicita di questo step:

- `geoPointArray` non e' ancora agganciato a un editor mappa dedicato
- la navigazione nel viewer e' demandata all'apertura semplificata di Google Maps

Test:

- scelta punto da mappa
- sincronizzazione coordinate <-> address
- salvataggio record

### Step M4 - Viewer geo

- creare `MapPreview`
- promuovere la mappa a sezione dedicata nel viewer
- usare `geoPoint` come sorgente per il rendering mappa
- mostrare label indirizzo sotto mappa

Stato:

- [x] completato in forma iniziale

Test:

- viewer con solo address
- viewer con solo geoPoint
- viewer con address + geoPoint
- viewer con mappa promossa sopra la griglia campi

### Step M5 - Hardening

- cache
- gestione errori
- eventuale static preview o lazy load

Stato:

- [ ] pending

Test:

- uso ripetuto
- provider down
- mobile

---

## 8) Decisioni ancora aperte

Le decisioni da prendere prima dell'implementazione vera sono:

- provider iniziale
- presenza o meno di autocomplete indirizzo
- uso di mappa interattiva o preview statica nel viewer
- gestione di `geoPointArray` come percorso o serie di marker

La scelta raccomandata per partire e':

- primo step su `geoPoint` singolo come base canonica
- `address` solo come arricchimento visuale e di ricerca
- niente geocoding automatico aggressivo
- niente polilinee o mappe avanzate nel primo rilascio

## 9) Configurazione tecnica iniziale

Per questo primo step Mapbox, il server legge:

- `MAPBOX_ACCESS_TOKEN`
- `GEOAPIFY_API_KEY`
- `MAPS_PROVIDER`

Fallback supportato:

- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `NEXT_PUBLIC_GEOAPIFY_API_KEY`
- `NEXT_PUBLIC_MAPS_PROVIDER`

Nota operativa:

- il token server e' preferibile per `geocode` e `reverse-geocode`
- il widget mappa puo' comunque mostrare un embed anche senza token client-side
- lo switch provider e' centralizzato in `src/config/maps.config.ts`
- il centro iniziale e' configurabile con `MAPS_DEFAULT_LAT`, `MAPS_DEFAULT_LNG`, `MAPS_DEFAULT_LABEL`
- il layer interattivo edit usa Leaflet

---

## 10) Regola guida

Le mappe devono restare un'estensione del sistema anagrafiche,
non una dipendenza architetturale che sporca dominio e form.

Quindi:

- `geoPoint` resta il dato reale salvato
- API interne stabili
- provider intercambiabile
- UI con fallback manuale sempre disponibile
- nessuna dipendenza provider dentro il modello dominio
