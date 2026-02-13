// src/components/AtlasModuli/Preventivatore/PreventivoPrintLayout.tsx
"use client";

export type PreventivoPrintRiga = {
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
  scontoPercentuale: number;
  totale: number;
};

export type PreventivoPrintData = {
  numeroPreventivo: string;
  dataPreventivo: string; // YYYY-MM-DD
  clienteNome: string;
  clienteIndirizzo?: string | null;

  testoIntroduzione: string;
  testoFinale: string;
  noteCliente?: string;

  firmaNome: string;
  firmaRuolo: string;
  firmaLuogoData: string;

  totaleImponibile: number;
  totaleIva: number;
  totalePreventivo: number;

  righe: PreventivoPrintRiga[];
};

type Props = {
  logoSrc: string;
  aziendaNome: string;
  aziendaIndirizzo?: string;
  aziendaPiva?: string;
  dati: PreventivoPrintData;
};

export default function PreventivoPrintLayout({
                                                logoSrc,
                                                aziendaNome,
                                                aziendaIndirizzo,
                                                aziendaPiva,
                                                dati,
                                              }: Props) {
  const {
    numeroPreventivo,
    dataPreventivo,
    clienteNome,
    clienteIndirizzo,
    testoIntroduzione,
    testoFinale,
    noteCliente,
    firmaNome,
    firmaRuolo,
    firmaLuogoData,
    totaleImponibile,
    totaleIva,
    totalePreventivo,
    righe,
  } = dati;

  return (
    <div
      id="preventivo-print-sheet"
      className="preventivo-print-page mx-auto my-0 bg-white text-sm text-black"
    >
      {/* HEADER */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {logoSrc && (
            <img
              src={logoSrc}
              alt={aziendaNome}
              className="h-16 w-auto"
            />
          )}
          <div>
            <div className="text-lg font-semibold">{aziendaNome}</div>
            {aziendaIndirizzo && (
              <div className="text-xs">{aziendaIndirizzo}</div>
            )}
            {aziendaPiva && (
              <div className="text-xs">P.IVA / CF: {aziendaPiva}</div>
            )}
          </div>
        </div>

        <div className="text-right text-xs">
          <div className="font-semibold">PREVENTIVO</div>
          <div>N. {numeroPreventivo || "—"}</div>
          <div>Data: {dataPreventivo || "—"}</div>
        </div>
      </header>

      {/* CLIENTE */}
      <section className="mb-4 text-xs">
        <div className="mb-1 font-semibold">Destinatario</div>
        <div>Gentile {clienteNome || "Cliente"},</div>
        {clienteIndirizzo && (
          <div className="mt-1 whitespace-pre-line">
            {clienteIndirizzo}
          </div>
        )}
      </section>

      {/* INTRODUZIONE */}
      {testoIntroduzione && (
        <section className="mb-4 text-xs whitespace-pre-line">
          {testoIntroduzione}
        </section>
      )}

      {/* TABELLA RIGHE */}
      <section className="mb-6">
        <table className="w-full border-collapse text-xs">
          <thead>
          <tr className="border-b border-black/60 bg-black/5">
            <th className="px-2 py-1 text-left">Descrizione</th>
            <th className="px-2 py-1 text-right">Qtà</th>
            <th className="px-2 py-1 text-right">Prezzo</th>
            <th className="px-2 py-1 text-right">Sconto %</th>
            <th className="px-2 py-1 text-right">Totale</th>
          </tr>
          </thead>
          <tbody>
          {righe.map((r, idx) => (
            <tr
              key={idx}
              className="border-b border-black/10 align-top"
            >
              <td className="px-2 py-1">
                <div className="whitespace-pre-line">
                  {r.descrizione || "—"}
                </div>
              </td>
              <td className="px-2 py-1 text-right">
                {r.quantita.toFixed(2)}
              </td>
              <td className="px-2 py-1 text-right">
                {r.prezzoUnitario.toFixed(2)} €
              </td>
              <td className="px-2 py-1 text-right">
                {r.scontoPercentuale
                  ? r.scontoPercentuale.toFixed(2)
                  : "0.00"}
                %
              </td>
              <td className="px-2 py-1 text-right">
                {r.totale.toFixed(2)} €
              </td>
            </tr>
          ))}

          {righe.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-2 py-4 text-center text-xs text-black/60"
              >
                Nessuna riga di preventivo.
              </td>
            </tr>
          )}
          </tbody>
        </table>
      </section>

      {/* TOTALI */}
      <section className="mb-6 flex justify-end">
        <div className="min-w-[220px] text-xs">
          <div className="flex justify-between">
            <span>Totale imponibile:</span>
            <span>{totaleImponibile.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between">
            <span>Totale IVA:</span>
            <span>{totaleIva.toFixed(2)} €</span>
          </div>
          <div className="mt-1 border-t border-black/40 pt-1 font-semibold">
            <div className="flex justify-between">
              <span>Totale preventivo:</span>
              <span>{totalePreventivo.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </section>

      {/* NOTE PER IL CLIENTE */}
      {noteCliente && (
        <section className="mb-6 text-xs">
          <div className="mb-1 font-semibold">Note</div>
          <div className="whitespace-pre-line">{noteCliente}</div>
        </section>
      )}

      {/* TESTO FINALE + FIRMA */}
      <section className="mt-4 text-xs">
        {testoFinale && (
          <div className="mb-6 whitespace-pre-line">
            {testoFinale}
          </div>
        )}

        <div className="flex justify-between">
          <div className="text-xs">
            {firmaLuogoData && (
              <div className="mb-2">{firmaLuogoData}</div>
            )}
          </div>

          <div className="text-right text-xs">
            <div className="mb-8">
              _________________________________
            </div>
            <div>{firmaNome}</div>
            {firmaRuolo && <div>{firmaRuolo}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
