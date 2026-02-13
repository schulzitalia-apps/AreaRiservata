// src/components/Mail/VarsModal.tsx
"use client";

import { cn } from "@/server-utils/lib/utils";
import { Modal } from "@/components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;

  varsText: string;
  onChangeVarsText: (v: string) => void;
  varsError?: string;

  templateKey?: string;
};

export default function VarsModal({
                                    open,
                                    onClose,
                                    varsText,
                                    onChangeVarsText,
                                    varsError,
                                    templateKey,
                                  }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Variabili"
      subtitle="Opzionale. Inserisci un oggetto JSON con i valori usati dal template {}"
      maxWidthClassName="max-w-[720px]"
      zIndexClassName="z-[80]"
      disableClose={false}
    >
      <div>
        <textarea
          value={varsText}
          onChange={(e) => onChangeVarsText(e.target.value)}
          className={cn(
            "min-h-[240px] w-full rounded-xl border border-stroke bg-transparent px-3 py-2 font-mono text-[12px] outline-none focus:border-primary",
            "dark:border-dark-3 dark:text-white"
          )}
          spellCheck={false}
        />

        {!!varsError && (
          <div className="mt-2 text-[11px] font-semibold text-red-600">
            {varsError}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-stroke px-3 py-1.5 text-xs font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            onClick={() =>
              onChangeVarsText('{\n  "name": "Mario",\n  "message": "Ciao!"\n}')
            }
          >
            Inserisci esempio
          </button>

          <button
            type="button"
            className="rounded-md border border-stroke px-3 py-1.5 text-xs font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            onClick={() => onChangeVarsText("{}")}
          >
            Svuota
          </button>

          <div className="ml-auto text-[11px] text-dark/60 dark:text-white/60">
            Esempi variabili: <span className="font-mono">{"{{name}}"}</span>,{" "}
            <span className="font-mono">{"{{message}}"}</span>,{" "}
            <span className="font-mono">{"{{thread.title}}"}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
