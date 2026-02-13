"use client";

import { useState } from "react";

type Props = { onSend: (text: string) => void };

export default function MessageInput({ onSend }: Props) {
  const [value, setValue] = useState("");

  const send = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  };

  return (
    <div className="border-t-2 border-stroke dark:border-dark-3 p-4">
      <div className="flex items-center gap-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Scrivi un messaggio…"
          className="flex-1 rounded-2xl border-2 border-stroke bg-white px-5 py-3 text-base text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-black dark:text-white"
        />
        <button
          onClick={send}
          className="rounded-2xl bg-primary px-5 py-3 text-base font-bold text-white hover:opacity-90"
        >
          Invia
        </button>
      </div>
    </div>
  );
}
