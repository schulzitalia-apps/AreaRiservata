// src/components/DocumentBox/ListItem.tsx
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

function formatMB(kb?: number) {
  const mb = (kb ?? 0) / 1024;
  return `${mb.toFixed(2)} MB`;
}

export default function ListItem({ doc }: Props) {
  const Icon = TypeIcon[doc.type] ?? Icons.Folder;

  return (
    <div className="group grid grid-cols-12 items-center gap-3 px-4 py-3 hover:bg-gray-2/60 dark:hover:bg-dark-2/60">
      {/* Nome + icona */}
      <div className="col-span-6 flex items-center gap-3 truncate">
        <Icon className="size-5 shrink-0 text-dark/80 dark:text-white/80" />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-dark dark:text-white">
            {doc.title}
          </div>
          {doc.summary && (
            <div className="truncate text-xs text-dark/70 dark:text-white/70">
              {doc.summary}
            </div>
          )}
        </div>
      </div>

      {/* Visibilità */}
      <div className="col-span-2">
        <span className="rounded-full bg-gray-2 px-2.5 py-0.5 text-[11px] font-medium text-dark dark:bg-dark-2 dark:text-white">
          {doc.visibility === "public" ? "Pubblico" : "Personale"}
        </span>
      </div>

      {/* Dimensione */}
      <div className="col-span-2 text-dark/70 dark:text-white/70">{formatMB(doc.sizeKB)}</div>

      {/* Data + azioni (solo View) */}
      <div className="col-span-2 flex items-center justify-end gap-3 text-right">
        <time
          className="text-xs text-dark/70 dark:text-white/70"
          dateTime={doc.updatedAt}
          title={new Date(doc.updatedAt).toLocaleString()}
        >
          {new Date(doc.updatedAt).toLocaleDateString()}
        </time>

        <a href={`/api/documents/${doc.id}/view`} target="_blank" className="text-primary underline">
          View
        </a>
      </div>
    </div>
  );
}
