// src/components/AtlasModuli/common/ReferencePreviewCell.tsx
"use client";

import { MouseEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import type { ReferenceConfig } from "@/config/anagrafiche.fields.catalog";

export function ReferencePill({
                                targetId,
                                fieldLabel,
                                config,
                                previewLabel,
                              }: {
  targetId: string;
  fieldLabel: string;
  config: ReferenceConfig;
  previewLabel?: string | null;
}) {
  const { kind, targetSlug, resourceBasePath } = config;

  const base =
    resourceBasePath ||
    (kind === "anagrafica"
      ? "anagrafiche"
      : kind === "aula"
        ? "aule"
        : "eventi");

  const href = `/${base}/${targetSlug}/${targetId}`;

  // se previewLabel esiste e non è vuoto → usalo, altrimenti fallback id
  const text =
    previewLabel && String(previewLabel).trim().length > 0
      ? previewLabel
      : targetId;

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    // dimensioni "box scheda"
    const width = 350;
    const height = 500;

    // cerco di centrarla un minimo sullo schermo corrente
    const screenLeft =
      typeof window.screenLeft !== "undefined" ? window.screenLeft : window.screenX;
    const screenTop =
      typeof window.screenTop !== "undefined" ? window.screenTop : window.screenY;

    const innerWidth = window.innerWidth || document.documentElement.clientWidth;
    const innerHeight = window.innerHeight || document.documentElement.clientHeight;

    const left = screenLeft + (innerWidth - width) / 2;
    const top = screenTop + (innerHeight - height) / 2;

    window.open(
      href,
      "_blank",
      [
        "noopener",
        "noreferrer",
        `width=${Math.round(width)}`,
        `height=${Math.round(height)}`,
        `left=${Math.round(left)}`,
        `top=${Math.round(top)}`,
        "resizable=yes",
        "scrollbars=yes",
        "toolbar=no",
        "location=no",
        "status=no",
        "menubar=no",
      ].join(","),
    );
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="
        inline-flex items-center gap-1
        rounded-full border px-2 py-1 text-xs
        border-primary text-primary hover:bg-primary/10
        dark:text-red-400 dark:border-red-400 dark:hover:bg-red-400/10
        transition-colors
      "
    >
      <span className="font-semibold">{fieldLabel}:</span>
      <span className="truncate max-w-[180px]">{text}</span>
      <ArrowUpRight className="h-3 w-3" />
    </a>
  );
}
