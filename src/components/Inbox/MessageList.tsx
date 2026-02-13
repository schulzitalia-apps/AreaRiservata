"use client";

import { Message } from "@/server-utils/models/Inbox";
import { resolveParticipant } from "@/server-utils/mock/inbox.mock";
import Image from "next/image";
import { cn } from "@/server-utils/lib/utils";

type Props = { items: Message[] };

export default function MessageList({ items }: Props) {
  return (
    <div className="custom-scrollbar flex-1 overflow-y-auto p-6 space-y-4">
      {items.map((m) => {
        const author = resolveParticipant(m.authorId);
        const mine = m.authorId === "me";
        return (
          <div key={m.id} className={cn("flex items-start gap-4", mine && "flex-row-reverse")}>
            <Image
              src={author?.avatar ?? "/images/user/user-03.png"}
              alt={author?.name ?? "user"}
              width={48}
              height={48}
              className="size-12 rounded-full object-cover"
            />
            <div
              className={cn(
                "max-w-[78%] rounded-3xl px-5 py-3 text-base leading-relaxed",
                "border-2",
                mine
                  ? "bg-primary text-white border-primary rounded-br-xl"
                  : "bg-gray-2 text-dark dark:bg-neutral-900 dark:text-white border-stroke dark:border-dark-3 rounded-bl-xl"
              )}
              title={new Date(m.createdAt).toLocaleString()}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
