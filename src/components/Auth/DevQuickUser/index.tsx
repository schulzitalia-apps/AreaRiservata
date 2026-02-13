"use client";

import { useEffect, useState } from "react";
import type { Notice } from "./types";
import InlineAlert from "./ui/InlineAlert";
import InviteCreateBox from "./sections/InviteCreateBox";
import UsersListBox from "./sections/UsersListBox";

export default function DevQuickUser() {
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <div className="space-y-6">
      <InlineAlert notice={notice} onClose={() => setNotice(null)} />

      <InviteCreateBox
        onNotice={setNotice}
        onAfterInvite={() => {
          // qui non faccio nulla: UsersListBox ha già pulsante Aggiorna
          // se vuoi auto-refresh, possiamo passare una callback “invalidate users”
        }}
      />

      <UsersListBox onNotice={setNotice} />
    </div>
  );
}
