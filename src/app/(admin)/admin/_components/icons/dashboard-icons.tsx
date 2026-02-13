import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 56 56"
      width={56}
      height={56}
      fill="none"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/**
 * Ring “premium”:
 * - fill leggerissimo (per dark ok, per light quasi invisibile)
 * - stroke accent colorato
 * - stroke interno neutro (currentColor con bassa opacità)
 */
function Ring({ accent }: { accent: string }) {
  return (
    <>
      <rect x="7" y="7" width="42" height="42" rx="14" fill="rgba(0,0,0,0.02)" />
      <rect
        x="7"
        y="7"
        width="42"
        height="42"
        rx="14"
        stroke={accent}
        strokeWidth="2"
        strokeOpacity="0.95"
      />
      <rect
        x="9.5"
        y="9.5"
        width="37"
        height="37"
        rx="12.5"
        stroke="currentColor"
        strokeOpacity="0.14"
        strokeWidth="1"
      />
    </>
  );
}

/* ===== Accent palette (same everywhere) ===== */
const ACCENT = {
  users: "rgba(56,189,248,0.95)",   // cyan
  docs: "rgba(167,139,250,0.95)",   // purple
  groups: "rgba(251,146,60,0.95)",  // orange
  mail: "rgba(52,211,153,0.95)",    // green
};

/* =======================
   ACTION ICONS (outline)
   (stesso “family” delle stats, ma glyph più “action”)
======================= */

export function ActionUsers(props: P) {
  return (
    <IconBase {...props}>
      <Ring accent={ACCENT.users} />
      {/* user */}
      <path
        d="M28 28.2a6.4 6.4 0 1 0 0-12.8 6.4 6.4 0 0 0 0 12.8Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M18.8 40.9c1.6-5.7 6.2-8.3 9.2-8.3s7.6 2.6 9.2 8.3"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* plus (action) */}
      <path
        d="M39.8 18.6v7.6M36 22.4h7.6"
        stroke={ACCENT.users}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function ActionDocumentUpload(props: P) {
  return (
    <IconBase {...props}>
      <Ring accent={ACCENT.docs} />
      {/* doc */}
      <path
        d="M21 17.6c0-1.2 1-2.2 2.2-2.2h10l6.8 6.8v16.2c0 1.2-1 2.2-2.2 2.2H23.2c-1.2 0-2.2-1-2.2-2.2V17.6Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M33.2 15.4v5.6c0 1.1.9 2 2 2h5.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      {/* upload arrow (action) */}
      <path
        d="M28 37.2V27"
        stroke={ACCENT.docs}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M24.6 30.4 28 27l3.4 3.4"
        stroke={ACCENT.docs}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}

export function ActionGroups(props: P) {
  return (
    <IconBase {...props}>
      <Ring accent={ACCENT.groups} />
      {/* layers */}
      <path
        d="M18.4 24.7 28 19.2l9.6 5.5L28 30.2l-9.6-5.5Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M19 31 28 36l9-5"
        stroke={ACCENT.groups}
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 36.3 28 41l8-4.7"
        stroke={ACCENT.groups}
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </IconBase>
  );
}

export function ActionMail(props: P) {
  return (
    <IconBase {...props}>
      <Ring accent={ACCENT.mail} />
      {/* paper plane (action) */}
      <path
        d="M18.6 28.1 39.6 19.5c1-.4 2 .6 1.5 1.6l-8.6 21c-.3.9-1.6 1-2.2.2l-4.6-6.2-6.2-4.6c-.8-.6-.7-1.9.1-2.2Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M25.7 35.7 41 20.4"
        stroke={ACCENT.mail}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

/* =======================
   STAT ICONS (outline)
   (glyph più “metric”: niente plus/upload/plane)
======================= */

export function StatUsers(props: P) {
  return (
    <IconBase {...props}>
      <Ring accent={ACCENT.users} />
      <path
        d="M28 28.2a6.4 6.4 0 1 0 0-12.8 6.4 6.4 0 0 0 0 12.8Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M18.8 40.9c1.6-5.7 6.2-8.3 9.2-8.3s7.6 2.6 9.2 8.3"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function StatDocuments(props: P) {
  return (
    <IconBase {...props}>
      <Ring accent={ACCENT.docs} />
      {/* doc + lines (metric) */}
      <path
        d="M21 17.6c0-1.2 1-2.2 2.2-2.2h10l6.8 6.8v16.2c0 1.2-1 2.2-2.2 2.2H23.2c-1.2 0-2.2-1-2.2-2.2V17.6Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M33.2 15.4v5.6c0 1.1.9 2 2 2h5.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <path
        d="M25 28h10.6M25 32h10.6M25 36h7.2"
        stroke={ACCENT.docs}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </IconBase>
  );
}

export function StatGroups(props: P) {
  return (
    <IconBase {...props}>
      <Ring accent={ACCENT.groups} />
      <path
        d="M18.4 24.7 28 19.2l9.6 5.5L28 30.2l-9.6-5.5Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M19 31 28 36l9-5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <path
        d="M20 36.3 28 41l8-4.7"
        stroke={ACCENT.groups}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </IconBase>
  );
}

export function StatMail(props: P) {
  return (
    <IconBase {...props}>
      <Ring accent={ACCENT.mail} />
      {/* inbox/envelope (metric) */}
      <path
        d="M19.4 22.2c0-1.2 1-2.2 2.2-2.2h12.8c1.2 0 2.2 1 2.2 2.2v13.6c0 1.2-1 2.2-2.2 2.2H21.6c-1.2 0-2.2-1-2.2-2.2V22.2Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M20.8 23.4 28 28.8l7.2-5.4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <path
        d="M22 35.1h6.2c.8 0 1.2.4 1.6 1.1.3.7.6 1 1.6 1h4.4"
        stroke={ACCENT.mail}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}
