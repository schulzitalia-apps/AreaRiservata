// components/Common/VisibilityBadge.tsx
export function VisibilityBadge({ role }: { role?: string | null }) {
  const label = role || "Solo proprietario";
  return (
    <span className="inline-flex items-center rounded-full bg-gray-1 px-2 py-0.5 text-[11px] text-dark/70 dark:bg-dark-2 dark:text-white/70">
      {label}
    </span>
  );
}
