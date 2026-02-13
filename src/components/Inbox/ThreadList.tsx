"use client";

import Image from "next/image";
import { Thread } from "@/server-utils/models/Inbox";
import { cn } from "@/server-utils/lib/utils";

type Props = {
  items: Thread[];
  selectedId?: string;
  onSelect: (id: string) => void;
  className?: string;
};

export default function ThreadList({ items, selectedId, onSelect, className }: Props) {
  return (
    <aside
      className={cn(
        "w-full max-w-[22rem] border-l-2 border-stroke dark:border-dark-3",
        "bg-white dark:bg-gray-dark",
        className
      )}
    >
      <div className="px-6 py-4 border-b-2 border-stroke dark:border-dark-3">
        <h3 className="text-xl font-bold text-dark dark:text-white">Inbox</h3>
      </div>

      <ul className="custom-scrollbar max-h-[calc(100vh-240px)] overflow-y-auto p-4 space-y-3">
        {items.map((t) => {
          const p = t.participants[0];
          return (
            <li key={t.id}>
              <button
                onClick={() => onSelect(t.id)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left transition-colors",
                  "border-stroke dark:border-dark-3",
                  selectedId === t.id
                    ? "bg-red-100/60 border-primary dark:bg-red-900/30"
                    : "hover:bg-gray-2 dark:hover:bg-neutral-900"
                )}
              >
                <Image
                  src={p?.avatar ?? "/images/user/user-03.png"}
                  alt={p?.name ?? "user"}
                  width={56}
                  height={56}
                  className="size-14 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="truncate text-lg font-semibold text-dark dark:text-white">
                      {t.title}
                    </span>
                    {!!t.unread && (
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-sm font-bold text-white">
                        {t.unread}
                      </span>
                    )}
                  </div>
                  <span className="block text-sm text-dark/70 dark:text-white/70">
                    {new Date(t.lastMessageAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
