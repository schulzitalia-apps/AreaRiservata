"use client";

import { useEffect, useState } from "react";
import type { Notice, UserAdmin } from "../types";
import { Modal } from "@/components/ui/Modal";
import { apiGetBarcodeActionByUser, apiSetBarcodeAction } from "../api";

import {
  BARCODE_ACTIONS_CONFIG,
  type BarcodeActionId,
} from "@/config/barcode.config";

export default function UserBarcodeActionManager({
                                                   user,
                                                   onNotice,
                                                 }: {
  user: UserAdmin;
  onNotice: (n: Notice) => void;
}) {
  const [open, setOpen] = useState(false);

  const [selectedActionId, setSelectedActionId] = useState<BarcodeActionId>(
    (BARCODE_ACTIONS_CONFIG[0]?.id as BarcodeActionId) ?? "lettura",
  );

  const [busy, setBusy] = useState(false);
  const [lastBarcodeId, setLastBarcodeId] = useState<string | null>(null);

  // ✅ Quando apro il modal, rileggo dal backend l'azione già salvata e la pre-seleziono.
  useEffect(() => {
    if (!open) return;

    // reset UI "salvataggio" (è uno stato locale)
    setLastBarcodeId(null);

    (async () => {
      try {
        const j = await apiGetBarcodeActionByUser(user.id);
        if (j?.actionId) {
          setSelectedActionId(j.actionId);
        }
      } catch {
        // opzionale: non mostro errore qui per non essere invasivo
      }
    })();
  }, [open, user.id]);

  async function handleSave() {
    if (busy) return;
    setBusy(true);
    try {
      const { id } = await apiSetBarcodeAction({
        userId: user.id,
        actionId: selectedActionId,
      });

      setLastBarcodeId(id);

      const actionLabel =
        BARCODE_ACTIONS_CONFIG.find((a) => a.id === selectedActionId)?.label ??
        selectedActionId;

      onNotice({
        type: "success",
        text: `Azione "${actionLabel}" associata all'utente`,
      });
    } catch (e: any) {
      onNotice({
        type: "error",
        text: e?.message || "Errore associazione azione",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
      >
        Azione barcode
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Azione barcode per ${user.name || user.email}`}
        subtitle={
          <span>
            Ruolo: <span className="font-mono">{user.role}</span> · ID:{" "}
            <span className="break-all font-mono text-[10px]">{user.id}</span>
          </span>
        }
        maxWidthClassName="max-w-xl"
      >
        <div className="space-y-4 text-sm">
          <div>
            <label className="text-[11px] font-medium text-dark dark:text-white">
              Seleziona azione
            </label>

            <select
              className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6"
              value={selectedActionId}
              onChange={(e) =>
                setSelectedActionId(e.target.value as BarcodeActionId)
              }
            >
              {BARCODE_ACTIONS_CONFIG.map((a) => (
                <option
                  key={a.id}
                  value={a.id}
                  className="bg-white text-dark dark:bg-dark-2 dark:text-dark-6"
                >
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? "Salvo..." : "Associa azione all'utente"}
          </button>

          {lastBarcodeId && (
            <div className="mt-2 rounded-md bg-gray-2 px-3 py-2 text-[11px] text-dark/80 dark:bg-dark-2 dark:text-white/80">
              <div className="font-semibold">Barcode creato</div>
              <div className="mt-0.5">
                ID barcode (da usare per generare il codice a barre o per
                configurazioni future):
              </div>
              <div className="mt-1 break-all font-mono text-[10px]">
                {lastBarcodeId}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
