"use client";

import { useState } from "react";
import type { Memo, TimeKey } from "../types";

export function useSpeseMemos(timeKey: TimeKey) {
  const [memosByTime, setMemosByTime] = useState<Record<TimeKey, Memo[]>>({
    mese: [],
    trimestre: [],
    semestre: [],
    anno: [],
    anno_fiscale: [],
  });

  const [memoOpen, setMemoOpen] = useState(false);
  const [memoTitle, setMemoTitle] = useState("");
  const [memoDate, setMemoDate] = useState("");
  const [memoAmount, setMemoAmount] = useState<number>(0);

  const memos = memosByTime[timeKey];

  const onAddMemo = () => {
    const title = memoTitle.trim();
    if (!title) return;
    if (!memoDate) return;

    const amt = Number(memoAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    const newMemo: Memo = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      date: memoDate,
      amount: Math.round(amt),
    };

    setMemosByTime((prev) => ({
      ...prev,
      [timeKey]: [newMemo, ...prev[timeKey]],
    }));

    setMemoTitle("");
    setMemoDate("");
    setMemoAmount(0);
    setMemoOpen(false);
  };

  return {
    memos,
    memoOpen,
    setMemoOpen,
    memoTitle,
    setMemoTitle,
    memoDate,
    setMemoDate,
    memoAmount,
    setMemoAmount,
    onAddMemo,
  };
}
