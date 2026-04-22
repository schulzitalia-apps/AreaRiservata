"use client";

import { useEffect, useState } from "react";
import type { Notice } from "./types";
import InlineAlert from "./ui/InlineAlert";
import InviteCreateBox from "./sections/InviteCreateBox";
import UsersListBox from "./sections/UsersListBox";

export default function DevQuickUser() {
  const [notice, setNotice] = useState<Notice>(null);
  const [usersRefreshToken, setUsersRefreshToken] = useState(0);

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
          setUsersRefreshToken((prev) => prev + 1);
        }}
      />

      <UsersListBox onNotice={setNotice} refreshToken={usersRefreshToken} />
    </div>
  );
}
