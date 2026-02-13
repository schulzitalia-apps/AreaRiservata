// src/components/ui/select.tsx
"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/server-utils/lib/utils";

type TupleOption = readonly [string, string];
type ObjectOption = { value: string; label: string };

type SelectProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<TupleOption> | ReadonlyArray<ObjectOption>;

  placeholder?: string; // voce "vuota" sempre selezionabile (value="")
  disabled?: boolean;
  required?: boolean; // solo UI (badge), NON blocca la selezione vuota

  menuZIndex?: number;
  viewportPadding?: number;
  menuGap?: number;
  defaultMaxHeight?: number;
};

function normalizeOptions(options: SelectProps["options"]): ObjectOption[] {
  if (!options?.length) return [];
  const first = options[0] as any;

  if (Array.isArray(first)) {
    return (options as ReadonlyArray<TupleOption>).map(([value, label]) => ({
      value: String(value),
      label: String(label),
    }));
  }

  return (options as ReadonlyArray<ObjectOption>).map((o) => ({
    value: String(o.value),
    label: String(o.label),
  }));
}

type Placement = "bottom" | "top";

export function Select({
                         label,
                         value,
                         onChange,
                         options,
                         placeholder = "Seleziona…",
                         disabled = false,
                         required = false,
                         menuZIndex = 9999,
                         viewportPadding = 8,
                         menuGap = 8,
                         defaultMaxHeight = 220,
                       }: SelectProps) {
  const itemsRaw = useMemo(() => normalizeOptions(options), [options]);

  // ✅ "Seleziona…" sempre presente e selezionabile -> value = ""
  const items = useMemo(() => {
    const placeholderItem: ObjectOption = { value: "", label: placeholder };
    return [placeholderItem, ...itemsRaw];
  }, [itemsRaw, placeholder]);

  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = items.find((o) => o.value === value) ?? null;
  const currentLabel = current?.label ?? placeholder;

  // ---------- posizionamento portal ----------
  const [placement, setPlacement] = useState<Placement>("bottom");
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [maxHeight, setMaxHeight] = useState<number>(defaultMaxHeight);

  const computePosition = () => {
    const btn = triggerRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width = rect.width;

    const spaceBelow = vh - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;

    const preferBottom = spaceBelow >= 140 || spaceBelow >= spaceAbove;
    const nextPlacement: Placement = preferBottom ? "bottom" : "top";

    const available =
      nextPlacement === "bottom" ? spaceBelow - menuGap : spaceAbove - menuGap;

    const mh = Math.max(120, Math.min(defaultMaxHeight, Math.floor(available)));
    setMaxHeight(mh);

    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      vw - viewportPadding - width,
    );

    // top provvisorio (se top, correggiamo dopo aver misurato l’altezza reale del menu)
    const top =
      nextPlacement === "bottom"
        ? rect.bottom + menuGap
        : Math.max(viewportPadding, rect.top - menuGap);

    setPlacement(nextPlacement);
    setMenuStyle({
      position: "fixed",
      left,
      top,
      width,
      zIndex: menuZIndex,
    });

    // correzione finale per placement=top dopo render
    requestAnimationFrame(() => {
      const m = menuRef.current;
      const b = triggerRef.current;
      if (!m || !b) return;

      const bRect = b.getBoundingClientRect();
      const mH = m.getBoundingClientRect().height;

      if (nextPlacement === "top") {
        const realTop = Math.max(viewportPadding, bRect.top - menuGap - mH);
        setMenuStyle((s) => ({ ...s, top: realTop }));
      }
    });
  };

  // quando apri (o cambiano opzioni/label) posiziona
  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items.length, currentLabel]);

  // ✅ REPOSITION su scroll/resize: resta SEMPRE ancorata al trigger (no close)
  useEffect(() => {
    if (!open) return;

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => computePosition());
    };

    const onResize = () => schedule();
    const onScroll = () => schedule(); // capture: prende anche scroll dei container

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onScroll, true);

    // se il trigger cambia size (layout responsive), riposiziona
    const ro =
      "ResizeObserver" in window
        ? new ResizeObserver(() => schedule())
        : null;

    if (ro && triggerRef.current) ro.observe(triggerRef.current);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize as any);
      window.removeEventListener("scroll", onScroll as any, true);
      if (ro) ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ---------- chiusura SOLO click fuori ----------
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;

      const btn = triggerRef.current;
      const menu = menuRef.current;

      if (btn && btn.contains(t)) return;
      if (menu && menu.contains(t)) return;

      setOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // ---------- keyboard navigation (NO hover tracking) ----------
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    const idx = items.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    const el = menu.querySelector<HTMLElement>(
      `[data-select-idx="${activeIndex}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const handleSelect = (newValue: string) => {
    onChange(newValue); // ✅ "" passa correttamente
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(items.length - 1, Math.max(0, i + 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = items[activeIndex];
      if (opt) handleSelect(opt.value);
      return;
    }
  };

  const field = (
    <div className="relative">
      {/* TRIGGER */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm outline-none",
          "border-stroke bg-transparent text-dark hover:bg-gray-2",
          "dark:border-dark-3 dark:bg-transparent dark:text-white dark:hover:bg-dark-2",
          disabled &&
          "cursor-not-allowed opacity-65 hover:bg-transparent dark:hover:bg-transparent",
        )}
      >
        <span className={cn("truncate", value === "" && "text-gray-6 dark:text-dark-5")}>
          {currentLabel}
        </span>
        <span className="ml-2 text-xs opacity-70">▾</span>
      </button>

      {/* MENU (Portal) */}
      {open && mounted
        ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            tabIndex={-1}
            onKeyDown={onMenuKeyDown}
            style={menuStyle}
            className={cn(
              "rounded-lg border shadow-card-3",
              "bg-white text-dark border-stroke",
              "dark:bg-dark-2 dark:text-dark-6 dark:border-dark-3",
            )}
          >
            <ul className="py-1 text-sm overflow-y-auto" style={{ maxHeight }}>
              {items.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isActive = idx === activeIndex;

                return (
                  <li key={`${opt.value}__${idx}`}>
                    <button
                      type="button"
                      data-select-idx={idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(opt.value);
                      }}
                      className={cn(
                        "flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors",
                        "text-dark dark:text-dark-6",
                        "hover:bg-gray-2 dark:hover:bg-dark-3",
                        // active solo da tastiera (non segue il mouse)
                        isActive && "bg-gray-2 dark:bg-dark-3",
                        // highlight selezionata (tema)
                        isSelected &&
                        "font-semibold bg-primary/10 text-primary ring-1 ring-primary/30 hover:bg-primary/10 dark:bg-primary/20 dark:text-primary dark:ring-primary/40",
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                    </button>
                  </li>
                );
              })}

              {items.length === 0 && (
                <li className="px-3 py-1.5 text-sm text-gray-6 dark:text-dark-5">
                  Nessuna opzione disponibile
                </li>
              )}
            </ul>
          </div>,
          document.body,
        )
        : null}
    </div>
  );

  if (!label) return field;

  return (
    <label className="flex flex-col gap-1 text-sm text-dark dark:text-white">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        {required && <span className="text-xs text-red-light">Obbligatorio</span>}
      </div>
      {field}
    </label>
  );
}

export default Select;
