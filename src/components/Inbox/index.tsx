"use client";

import { useEffect, useMemo, useState } from "react";
import ThreadList from "./ThreadList";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { getMessages, getThreads, messages as MESSAGES_MOCK, threads as THREADS_MOCK } from "@/server-utils/mock/inbox.mock";
import { Message } from "@/server-utils/models/Inbox";
import { useSearchParams, useRouter } from "next/navigation";

export default function InboxBox() {
  const params = useSearchParams();
  const router = useRouter();
  const initialThread = params.get("thread") ?? undefined;

  const [threads, setThreads] = useState(THREADS_MOCK);
  const [selected, setSelected] = useState<string | undefined>(initialThread ?? threads[0]?.id);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    (async () => {
      const t = await getThreads();
      setThreads(t);
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const m = await getMessages(selected);
      setMessages(m);
    })();
    // sync URL ?thread=
    const sp = new URLSearchParams(Array.from(params.entries()));
    sp.set("thread", selected);
    router.replace(`/inbox?${sp.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const onSend = (text: string) => {
    if (!selected) return;
    const newM: Message = {
      id: Math.random().toString(36).slice(2),
      authorId: "me",
      threadId: selected,
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newM]);
    MESSAGES_MOCK.push(newM);
  };

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selected),
    [threads, selected]
  );

  return (
    <div className="w-full rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      {/* header interno (opzionale) */}
      <div className="flex items-center justify-between border-b border-stroke px-4 py-3 dark:border-dark-3">
        <h3 className="text-lg font-semibold text-dark dark:text-white">
          {selectedThread?.title ?? "Richiesta"}
        </h3>
      </div>

      <div className="flex min-h-[56vh]">
        {/* area conversazione */}
        <section className="flex min-h-[56vh] flex-1 flex-col">
          <MessageList items={messages} />
          <MessageInput onSend={onSend} />
        </section>

        {/* sidebar destra: destinatari */}
        <ThreadList
          items={threads}
          selectedId={selected}
          onSelect={setSelected}
          className="hidden lg:block"
        />
      </div>
    </div>
  );
}
