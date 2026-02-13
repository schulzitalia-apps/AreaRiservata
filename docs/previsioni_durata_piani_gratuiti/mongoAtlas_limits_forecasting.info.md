# Stime di “durata” e cosa costruirci attorno (base: 400.000 record totali oggi)

## Premesse rapide
- Parti da **400.000 record** (misti: anagrafiche + eventi + qualunque “riga” generata dal sistema).
- Ti do 3 letture per ogni caso:
    1) **Operativo** (clienti/contatti/preventivi + eventi)
    2) **Finanza base** (ricavi/spese + eventi collegati)
    3) **Unito** (Operativo + Finanza)

### Soglie pratiche (non limiti assoluti)
- **1.000.000 record**: spesso iniziano accorgimenti “normali” (indici/viste/cache, report più curati).
- **5.000.000 record**: spesso conviene archiviazione/partizionamento o BI per storico pesante.

---

# A) CASI — Operativo (clienti/contatti/preventivi + eventi)

## CASO 1 — PMI commerciale (processo snello)
**Assunzioni**
- 5 utenti, 15 preventivi/giorno
- ~6 eventi per preventivo
- ~10 eventi generici per utente/giorno
- 2 nuovi contatti/giorno  
  **Totale Operativo stimato:** **157 record/giorno**

**Durata (solo Operativo, partendo da 400k)**
- Verso 1M: **~10 anni e 6 mesi**
- Verso 5M: **~80 anni e 3 mesi**

**Cosa ci fai (reporting serio)**
- Funnel preventivi (creati/inviati/vinti/persi), win rate per commerciale/settore
- Follow-up mancati (es. nessuna attività entro 7 giorni)
- Clienti dormienti/attivi, produttività commerciale

---

## CASO 2 — Azienda media (preventivi costanti + follow-up regolare)
**Assunzioni**
- 10 utenti, 40 preventivi/giorno
- ~8 eventi per preventivo
- ~12 eventi generici per utente/giorno
- 5 nuovi contatti/giorno  
  **Totale Operativo stimato:** **485 record/giorno**

**Durata (solo Operativo)**
- Verso 1M: **~3 anni e 5 mesi**
- Verso 5M: **~26 anni**

**Cosa ci fai**
- Forecast “weighted pipeline”, qualità pipeline
- Analisi tempi di chiusura e colli di bottiglia
- Performance per segmento/canale e per commerciale

---

## CASO 3 — Volume alto (tanti preventivi, tanta attività)
**Assunzioni**
- 20 utenti, 120 preventivi/giorno
- ~10 eventi per preventivo
- ~15 eventi generici per utente/giorno
- 15 nuovi contatti/giorno  
  **Totale Operativo stimato:** **1.635 record/giorno**

**Durata (solo Operativo)**
- Verso 1M: **~1 anno**
- Verso 5M: **~7 anni e 8 mesi**

**Cosa ci fai**
- Reporting completo + storico lungo
- Coorti e trend multi-anno (meglio iniziare a pensare a BI per storico pesante)
- KPI avanzati: touches-per-win, conversioni per mese acquisizione, stagionalità

---

## CASO 4 — Preventivi complessi (molte revisioni/approvazioni)
**Assunzioni**
- 15 utenti, 60 preventivi/giorno
- ~20 eventi per preventivo (revisioni, approvazioni, negoziazioni)
- ~25 eventi generici per utente/giorno
- 8 nuovi contatti/giorno  
  **Totale Operativo stimato:** **1.643 record/giorno**

**Durata (solo Operativo)**
- Verso 1M: **~1 anno**
- Verso 5M: **~7 anni e 8 mesi**

**Cosa ci fai**
- Report su efficienza preventivo: # revisioni, tempo in approvazione, SLA interni
- Controllo sconti/approvazioni e colli di bottiglia tra uffici

---

## CASO 5 — Post-vendita / ticketing (poche offerte, tante attività)
**Assunzioni**
- 8 utenti, 10 preventivi/giorno
- ~5 eventi per preventivo
- ~50 eventi per utente/giorno (ticket, interventi, note)
- 2 nuovi contatti/giorno  
  **Totale Operativo stimato:** **462 record/giorno**

**Durata (solo Operativo)**
- Verso 1M: **~3 anni e 7 mesi**
- Verso 5M: **~27 anni e 3 mesi**

**Cosa ci fai**
- KPI assistenza: tempi risposta/risoluzione, backlog, cause ricorrenti
- Clienti “a rischio” (molti eventi post-vendita, poca attività commerciale)

---

# B) CASI — Finanza base (ricavi/spese + eventi collegati)

> “Finanza base” = registrazione ricavi/spese + eventi tipici: scadenze, pagamenti, solleciti, riconciliazioni.

## CASO 1 — Finanza leggera (PMI)
**Assunzioni**
- 8 ricavi/fatture al giorno
- 5 spese al giorno
- ~3 eventi per documento (scadenza, incasso/pagamento, riconciliazione/sollecito) + piccoli movimenti extra  
  **Totale Finanza stimato:** **55 record/giorno**

**Durata (solo Finanza)**
- Verso 1M: **~29 anni e 11 mesi**
- Verso 5M: **~229 anni e 2 mesi**

**Cosa ci fai**
- Scadenziario clienti/fornitori, cash-in/cash-out
- Report incassi vs fatturato, ritardi medi di pagamento

---

## CASO 2 — Finanza media
**Assunzioni**
- 20 ricavi/fatture al giorno
- 12 spese al giorno
- ~2–3 eventi per documento + riconciliazioni  
  **Totale Finanza stimato:** **115 record/giorno**

**Durata (solo Finanza)**
- Verso 1M: **~14 anni e 4 mesi**
- Verso 5M: **~109 anni e 7 mesi**

**Cosa ci fai**
- Aging crediti (0–30 / 31–60 / 61–90 / >90)
- Scostamenti costi per categoria/centro di costo “leggero”
- Previsione cassa a 30/60/90 giorni

---

## CASO 3 — Finanza sostenuta (volumi alti)
**Assunzioni**
- 60 ricavi/fatture al giorno
- 30 spese al giorno
- ~1–2 eventi per documento + riconciliazioni più frequenti  
  **Totale Finanza stimato:** **260 record/giorno**

**Durata (solo Finanza)**
- Verso 1M: **~6 anni e 4 mesi**
- Verso 5M: **~48 anni e 6 mesi**

**Cosa ci fai**
- Cashflow operativo (incassi/pagamenti) con trend
- Report ritardi per cliente/segmento, efficacia solleciti

---

## CASO 4 — Finanza con approvazioni e scadenze “dense”
**Assunzioni**
- 45 ricavi/fatture al giorno
- 25 spese al giorno
- ~2 eventi per documento + extra (approvazioni/variazioni scadenze)  
  **Totale Finanza stimato:** **220 record/giorno**

**Durata (solo Finanza)**
- Verso 1M: **~7 anni e 6 mesi**
- Verso 5M: **~57 anni e 3 mesi**

**Cosa ci fai**
- Controllo ciclo passivo/attivo (tempi approvazione, pagamenti, dispute)
- Report su “tempo medio incasso” e “tempo medio pagamento”

---

## CASO 5 — Finanza “mista” (più spese operative + tracciamenti)
**Assunzioni**
- 15 ricavi/fatture al giorno
- 20 spese al giorno
- ~3 eventi per documento (scadenze, pagamenti rateali, note) + extra  
  **Totale Finanza stimato:** **140 record/giorno**

**Durata (solo Finanza)**
- Verso 1M: **~11 anni e 9 mesi**
- Verso 5M: **~90 anni**

**Cosa ci fai**
- Cost-to-serve (spese/attività per cliente o commessa “light”)
- Scadenziario + controllo uscite ricorrenti

---

# Stime di durata con limite 500.000 record (gestionale “unito”: Operativo + Finanza)
Base attuale: **400.000 record** (misti).  
Limite: **500.000 record**.  
Margine disponibile: **100.000 record**.

## Premessa
Qui considero **un unico sistema** che gestisce:
- **Operativo**: clienti/contatti/preventivi + eventi collegati
- **Finanza base**: ricavi/spese + eventi collegati (scadenze, incassi/pagamenti, riconciliazioni/solleciti)

La durata è calcolata come:
**Durata = 100.000 / (record al giorno del caso)**

---

# A) Definizione casi (assunzioni “da azienda”)

## CASO 1 — PMI commerciale (processo snello) + finanza leggera
**Operativo**
- 5 utenti, 15 preventivi/giorno
- ~6 eventi per preventivo
- ~10 eventi generici per utente/giorno
- 2 nuovi contatti/giorno  → **157 record/giorno**

**Finanza base**
- 8 ricavi/fatture al giorno
- 5 spese al giorno
- ~3 eventi per documento + piccoli extra → **55 record/giorno**

**Totale UNITO:** **212 record/giorno**

---

## CASO 2 — Azienda media (preventivi costanti + follow-up) + finanza media
**Operativo**
- 10 utenti, 40 preventivi/giorno
- ~8 eventi per preventivo
- ~12 eventi generici per utente/giorno
- 5 nuovi contatti/giorno → **485 record/giorno**

**Finanza base**
- 20 ricavi/fatture al giorno
- 12 spese al giorno
- ~2–3 eventi per documento + riconciliazioni → **115 record/giorno**

**Totale UNITO:** **600 record/giorno**

---

## CASO 3 — Volume alto (tanti preventivi + attività) + finanza sostenuta
**Operativo**
- 20 utenti, 120 preventivi/giorno
- ~10 eventi per preventivo
- ~15 eventi generici per utente/giorno
- 15 nuovi contatti/giorno → **1.635 record/giorno**

**Finanza base**
- 60 ricavi/fatture al giorno
- 30 spese al giorno
- ~1–2 eventi per documento + riconciliazioni frequenti → **260 record/giorno**

**Totale UNITO:** **1.895 record/giorno**

---

## CASO 4 — Preventivi complessi (molte revisioni/approvazioni) + finanza “densa”
**Operativo**
- 15 utenti, 60 preventivi/giorno
- ~20 eventi per preventivo
- ~25 eventi generici per utente/giorno
- 8 nuovi contatti/giorno → **1.643 record/giorno**

**Finanza base**
- 45 ricavi/fatture al giorno
- 25 spese al giorno
- ~2 eventi per documento + extra (approvazioni/variazioni scadenze) → **220 record/giorno**

**Totale UNITO:** **1.863 record/giorno**

---

## CASO 5 — Post-vendita / ticketing (molte attività) + finanza mista
**Operativo**
- 8 utenti, 10 preventivi/giorno
- ~5 eventi per preventivo
- ~50 eventi per utente/giorno (ticket, interventi, note)
- 2 nuovi contatti/giorno → **462 record/giorno**

**Finanza base**
- 15 ricavi/fatture al giorno
- 20 spese al giorno
- ~3 eventi per documento + extra → **140 record/giorno**

**Totale UNITO:** **602 record/giorno**

---

# B) Quanto dura il margine (400k → 500k)

| Caso | Unito (record/giorno) | 100k record: durata (giorni) | Durata (mesi) | Durata (anni) |
|---|---:|---:|---:|---:|
| **CASO 1** | 212 | ~472 | ~15,5 | ~1,29 |
| **CASO 2** | 600 | ~167 | ~5,5 | ~0,46 |
| **CASO 3** | 1.895 | ~53 | ~1,7 | ~0,15 |
| **CASO 4** | 1.863 | ~54 | ~1,8 | ~0,15 |
| **CASO 5** | 602 | ~166 | ~5,5 | ~0,46 |

---

# C) “Cosa ci fai” (solo in funzione del limite 500k)

## CASO 1 (≈ 15,5 mesi di margine)
- Reporting completo operativo + finanza base direttamente nel gestionale
- Storico “comodo” anche oltre 12 mesi senza ansia di saturazione
- Priorità: qualità dati, report utili, automazioni leggere

## CASO 2 e CASO 5 (≈ 5,5 mesi di margine)
- Fattibile fare reporting serio, ma serve disciplina:
    - report per default su ultimi 6–12 mesi
    - filtri data obbligatori sulle timeline
- Priorità: definire retention (archiviazione eventi vecchi) o “compattare” eventi non essenziali

## CASO 3 e CASO 4 (≈ 1,7–1,8 mesi di margine)
- Il limite 500k è troppo stretto per mantenere tutto lo storico in-line
- Priorità immediata:
    - retention aggressiva (es. eventi > 3–6 mesi archiviati)
    - reporting storico su storage separato (BI/archivio)
    - riduzione “granularità” eventi (log troppo verbosi)

---

Fine.
