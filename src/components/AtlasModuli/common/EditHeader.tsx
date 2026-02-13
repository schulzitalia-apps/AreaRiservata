// src/components/AtlasModuli/common/EditHeader.tsx
"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FloatingSection } from "@/components/Layouts/FloatingSection";

type EditHeaderProps = {
  backHref: string;
  title: ReactNode;
  subtitle?: ReactNode;
  coverSrc: string;
  avatarSrc: string;
  saving?: boolean;
  showSaveButton?: boolean; // per Anagrafiche possiamo nasconderlo
};

export function EditHeader({
                             backHref,
                             title,
                             subtitle,
                             coverSrc,
                             avatarSrc,
                             saving,
                             showSaveButton = true,
                           }: EditHeaderProps) {
  const router = useRouter();

  return (
    <FloatingSection
      coverSrc={coverSrc}
      avatarSrc={avatarSrc}
      title={title}
      subtitle={subtitle}
    >
      <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
        <div className="text-xs text-dark/60 dark:text-white/60">
          {/* Spazio per eventuale descrizione futura */}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="rounded-lg border border-stroke px-4 py-2 text-sm text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            Indietro
          </button>

          {showSaveButton && (
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Salvataggio…" : "Salva"}
            </button>
          )}
        </div>
      </div>
    </FloatingSection>
  );
}
