# Stime di durata con limite 10 GB per PDF “medi” (F24 + preventivi in PDF)

## Premesse rapide
- Limite storage: **10 GB**
- Per semplicità considero **10 GB ≈ 10.240 MB** (base 1024).
- I PDF “medi” cambiano tantissimo se sono **nativi** (generati da gestionale) o **scannerizzati**.
    - **F24**: spesso *piccoli* se nativi; *più grandi* se scansioni/foto.
    - **Preventivi**: in genere più grandi dell’F24 (logo/immagini, più pagine).

### Regola base
**Numero PDF ≈ 10.240 MB / (dimensione media PDF in MB)**  
**Durata (giorni) ≈ Numero PDF / PDF al giorno**

---

# A) Dimensione media PDF → quanti PDF stanno in 10 GB

| Dimensione media PDF | Tipico esempio | Quanti PDF in 10 GB |
|---:|---|---:|
| **0,2 MB (200 KB)** | F24 nativo / PDF leggero | **~51.200** |
| **0,5 MB (500 KB)** | PDF “normale” leggero | **~20.480** |
| **1,0 MB** | preventivo medio / PDF con 2–6 pagine | **~10.240** |
| **2,0 MB** | scansione buona / preventivo più “pesante” | **~5.120** |
| **5,0 MB** | scansione/foto pesante / molte immagini | **~2.048** |

---

# B) CASI “da azienda” (F24 + preventivi) con durata stimata

> In ogni caso ti do:
> - ipotesi “comprensibili” (quanti PDF al giorno/mese)
> - dimensione media realistica (mix F24 piccoli + preventivi più grandi)
> - **quanto dura 10 GB**

## CASO 1 — Basso volume (PMI snella)
**Assunzioni**
- **5 F24/mese** (scaricati o generati, leggeri)
- **200 preventivi/mese** (PDF medi)
- Totale: **205 PDF/mese** (~6,8 PDF/giorno)
- Mix dimensione media: **0,8 MB** (F24 piccoli, preventivi ~0,8–1,2MB)

**Capienza & durata**
- PDF totali in 10 GB: 10.240 / 0,8 ≈ **12.800 PDF**
- Durata: 12.800 / 205 ≈ **62 mesi** ≈ **5,2 anni**

**Cosa ci fai**
- Tieni lo storico “comodo” multi-anno direttamente nel gestionale
- Ricerca per cliente/anno/documento senza ansia

---

## CASO 2 — Volume medio (azienda commerciale “standard”)
**Assunzioni**
- **20 F24/mese**
- **800 preventivi/mese**
- Totale: **820 PDF/mese** (~27 PDF/giorno)
- Dimensione media: **1,0 MB** (preventivi medi + qualche scansione)

**Capienza & durata**
- PDF totali in 10 GB: 10.240 / 1,0 ≈ **10.240 PDF**
- Durata: 10.240 / 820 ≈ **12,5 mesi** ≈ **1,0 anno**

**Cosa ci fai**
- Storico di ~1 anno “tutto dentro”
- Per andare oltre: archiviazione annuale (es. esportazione su storage esterno)

---

## CASO 3 — Volume alto (molti preventivi + molta documentazione)
**Assunzioni**
- **50 F24/mese**
- **2.500 preventivi/mese**
- Totale: **2.550 PDF/mese** (~85 PDF/giorno)
- Dimensione media: **1,2 MB** (preventivi più lunghi + allegati “light”)

**Capienza & durata**
- PDF totali in 10 GB: 10.240 / 1,2 ≈ **8.533 PDF**
- Durata: 8.533 / 2.550 ≈ **3,35 mesi**

**Cosa ci fai**
- Sei obbligato a una strategia:
    - tenere “hot storage” (ultimi 3–6 mesi) nel gestionale
    - archiviare il resto (storage esterno o repository documentale)

---

## CASO 4 — Documenti scansiti (peso alto, ma volumi non enormi)
**Assunzioni**
- **30 F24/mese** ma spesso *scannerizzati*
- **600 preventivi/mese** con scansioni/immagini
- Totale: **630 PDF/mese**
- Dimensione media: **2,0 MB**

**Capienza & durata**
- PDF totali in 10 GB: 10.240 / 2,0 ≈ **5.120 PDF**
- Durata: 5.120 / 630 ≈ **8,1 mesi**

**Cosa ci fai**
- Funziona, ma serve:
    - compressione PDF / ottimizzazione scansioni
    - policy: “allegati pesanti” fuori dal gestionale

---

## CASO 5 — “Foto-PDF” pesanti (peggior scenario)
**Assunzioni**
- Molti PDF convertiti da foto/scan non ottimizzati
- Totale: **400 PDF/mese**
- Dimensione media: **5,0 MB**

**Capienza & durata**
- PDF totali in 10 GB: 10.240 / 5,0 ≈ **2.048 PDF**
- Durata: 2.048 / 400 ≈ **5,1 mesi**

**Cosa ci fai**
- Limite 10 GB diventa rapidamente un collo di bottiglia
- Priorità: standard di scansione (dpi, b/n, compressione) e/o storage esterno

---

# C) Tabella riassuntiva (durata su 10 GB)

| Caso | PDF/mese | Dim. media | PDF in 10 GB | Durata stimata |
|---|---:|---:|---:|---:|
| **CASO 1** | 205 | 0,8 MB | ~12.800 | **~5,2 anni** |
| **CASO 2** | 820 | 1,0 MB | ~10.240 | **~12,5 mesi** |
| **CASO 3** | 2.550 | 1,2 MB | ~8.533 | **~3,35 mesi** |
| **CASO 4** | 630 | 2,0 MB | ~5.120 | **~8,1 mesi** |
| **CASO 5** | 400 | 5,0 MB | ~2.048 | **~5,1 mesi** |

---

# D) Note pratiche (per far “durare” 10 GB senza cambiare processi)
- **Ottimizza PDF scansiti** (compressione, 150–200 dpi, scala di grigi)
- Evita allegati “dentro DB”: salva file su storage oggetti (S3/Blob/NAS) e nel gestionale tieni metadati+link
- Retention: nel gestionale tieni **ultimi 12 mesi**, archivia per anno

Fine.
