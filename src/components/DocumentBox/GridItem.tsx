// src/components/DocumentBox/GridItem.tsx
"use client";

import { type DocumentItem } from "@/components/Store/models/documents";
import * as Icons from "@/components/DocumentBox/icons";

type Props = { doc: DocumentItem };

const TypeIcon: Record<DocumentItem["type"], React.ComponentType<any>> = {
  pdf: Icons.FileText,
  image: Icons.Image,
  docx: Icons.FileWord,
  xlsx: Icons.FileExcel,
  txt: Icons.FileText,
  other: Icons.Folder,
};

export default function GridItem({ doc }: Props) {
  const Icon = TypeIcon[doc.type] ?? Icons.Folder;

  const openView = () => {
    window.open(`/api/documents/${doc.id}/view`, "_blank");
  };

  return (
    <button
      type="button"
      onClick={openView}
      className={[
        "group relative w-full rounded-xl border border-stroke bg-white p-5 shadow-1",
        "transition-colors duration-200 hover:border-primary hover:bg-red-50",
        "dark:border-dark-3 dark:bg-gray-dark",
        "dark:hover:bg-red-900/20 dark:hover:border-primary",
        "aspect-[4/3]",
        "flex flex-col justify-between text-left",
      ].join(" ")}
    >
      <div className="mb-3 flex items-center gap-3">
        <Icon className="size-10 shrink-0 text-dark/80 group-hover:text-primary/60 dark:text-white/80" />
        <span className="rounded-full bg-gray-2 px-2.5 py-1.5 text-[12px] font-medium text-dark dark:bg-dark-2 dark:text-white">
          {doc.visibility === "public" ? "Pubblico" : "Personale"}
        </span>
      </div>

      <div className="min-h-[2.75rem]">
        <span
          title={doc.title}
          className={[
            "line-clamp-2 text-base font-semibold leading-snug text-dark",
            "group-hover:text-primary",
            "dark:text-white",
          ].join(" ")}
        >
          {doc.title}
        </span>
        {doc.summary && (
          <div className="mt-1 line-clamp-1 text-xs text-dark/70 dark:text-white/70">
            {doc.summary}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-dark/70 dark:text-white/70">
        <span>{(doc.sizeKB / 1024).toFixed(2)} MB</span>
        <time dateTime={doc.updatedAt}>{new Date(doc.updatedAt).toLocaleDateString()}</time>
      </div>
    </button>
  );
}
