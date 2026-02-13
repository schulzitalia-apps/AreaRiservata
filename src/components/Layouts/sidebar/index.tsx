// src/components/Layouts/sidebar/index.tsx
"use client";

import { Logo } from "@/components/logo";
import { cn } from "@/server-utils/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildNavData } from "./data";
import { ChevronUp } from "./icons";
import { MenuItem } from "./menu-item";
import { useSidebarContext } from "./sidebar-context";
import { useAppSelector } from "@/components/Store/hooks";
import type { AppRole } from "@/types/roles";

function buildPublicMenu() {
  return [];
}

function ScrollHint({
                      direction,
                      onClick,
                    }: {
  direction: "up" | "down";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "down" ? "Scorri in giù" : "Scorri in su"}
      className={cn(
        "pointer-events-auto mx-auto flex h-8 w-8 items-center justify-center rounded-full",
        "bg-white/10 text-white/80 backdrop-blur hover:bg-white/15",
        "animate-bounce",
      )}
      title={direction === "down" ? "Scorri" : "Torna su"}
    >
      <ChevronUp
        className={cn("h-3 w-3", direction === "down" && "rotate-180")}
        aria-hidden="true"
      />
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { setIsOpen, isOpen, isMobile, toggleSidebar, mode, setMode, cycleMode } =
    useSidebarContext();

  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isHovering, setIsHovering] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);

  const isAuthed = useAppSelector((s) => s.session.status === "authenticated");

  const role = useAppSelector(
    (s) => (s.session.user?.role as AppRole | null) ?? null,
  );

  const MENU = useMemo(
    () => (isAuthed ? buildNavData(role) : buildPublicMenu()),
    [isAuthed, role],
  );

  const toggleExpanded = (title: string) =>
    setExpandedItems((prev) => (prev.includes(title) ? [] : [title]));

  // Desktop modes
  const desktopExpanded =
    mode === "expanded" || (mode === "hover" && isHovering);

  // Mobile: sempre full quando aperta (come originale)
  const expandedView = isMobile ? true : desktopExpanded;

  // Desktop widths
  const DESKTOP_EXPANDED_W = "w-[290px]";
  const DESKTOP_COLLAPSED_W = "w-[86px]";

  const modeLabel =
    mode === "expanded" ? "Aperta" : mode === "collapsed" ? "Icone" : "Hover";

  useEffect(() => {
    MENU.some((section: any) =>
      section.items.some((item: any) =>
        (item.items || []).some((subItem: any) => {
          if (subItem.url === pathname) {
            if (!expandedItems.includes(item.title)) toggleExpanded(item.title);
            return true;
          }
          return false;
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, MENU]);

  // In collapsed, se clicchi un gruppo con submenu -> espando (desktop)
  const ensureExpandedForSubmenu = (groupTitle: string) => {
    if (isMobile) return;
    if (mode === "collapsed") {
      setMode("expanded");
      setExpandedItems([groupTitle]);
    }
  };

  // collapsed desktop?
  const isCompactDesktop = !isMobile && !expandedView;

  // icone più “aria” + perfettamente centrate
  const compactItemClass =
    "mx-auto flex h-12 w-12 items-center justify-center rounded-xl px-0 py-0 gap-0";

  // in compatto: nascondo scrollbar (via “barrette”) ma lascio scroll
  const hideScrollbarClass =
    "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  // calcolo se posso scrollare (solo compatto desktop)
  useEffect(() => {
    if (!isCompactDesktop) return;

    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setCanScrollUp(scrollTop > 2);
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 2);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      el.removeEventListener("scroll", update as any);
      window.removeEventListener("resize", update);
    };
  }, [isCompactDesktop, MENU]);

  const scrollByAmount = (dir: "up" | "down") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(180, Math.floor(el.clientHeight * 0.35));
    el.scrollBy({ top: dir === "down" ? amount : -amount, behavior: "smooth" });
  };

  return (
    <>
      {/* overlay mobile - come originale */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-dark/90"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        onMouseEnter={() => mode === "hover" && !isMobile && setIsHovering(true)}
        onMouseLeave={() =>
          mode === "hover" && !isMobile && setIsHovering(false)
        }
        className={cn(
          "max-w-[290px] overflow-hidden border-r border-stroke bg-gray transition-[width] duration-200 ease-linear dark:border-stroke-dark dark:bg-dark",
          isMobile ? "fixed bottom-0 top-0 z-50" : "sticky top-0 h-screen",
          // Mobile identico (w-full / w-0), Desktop a modalità
          isMobile
            ? isOpen
              ? "w-full"
              : "w-0"
            : expandedView
              ? DESKTOP_EXPANDED_W
              : DESKTOP_COLLAPSED_W,
        )}
        aria-label="Main navigation"
        aria-hidden={isMobile ? !isOpen : false}
        inert={isMobile ? (!isOpen as any) : undefined}
      >
        {/* ✅ in compatto niente padding (header flush). padding lo mettiamo sul menu */}
        <div
          className={cn(
            "flex h-full flex-col py-10",
            isCompactDesktop ? "px-0" : "pl-[25px] pr-[7px]",
          )}
        >
          {/* HEADER (flush in compatto) */}
          <div className={cn(isCompactDesktop ? "px-0" : "pr-4.5")}>
            <Link
              href={"/"}
              onClick={() => isMobile && toggleSidebar()}
              className={cn(
                "block px-0 py-2.5 min-[850px]:py-0",
                isCompactDesktop && "flex justify-center",
              )}
              aria-label="Home"
              title="Home"
            >
              {/* box più grande e logo centrato */}
              <div
                className={cn(
                  isCompactDesktop
                    ? "flex h-14 w-full items-center justify-center"
                    : "",
                )}
              >
                <div className={cn(isCompactDesktop && "w-[64px] max-w-full")}>
                  <Logo />
                </div>
              </div>
            </Link>

            {/* ✅ Toggle: in compatto è rettangolo bordo-bordo */}
            {!isMobile && (
              <button
                type="button"
                onClick={cycleMode}
                className={cn(
                  "mt-5 border border-stroke/50 bg-white/5 transition hover:bg-white/10 dark:border-stroke-dark",
                  "text-xs font-semibold text-dark dark:text-white",
                  isCompactDesktop
                    ? "w-full mx-0 rounded-none px-2 py-2 text-[11px]"
                    : "inline-flex w-full items-center justify-center rounded-full px-3 py-1.5",
                )}
                title="Clicca per cambiare modalità"
                aria-label="Cambia modalità sidebar"
              >
                <span className="opacity-80">Sidebar mode:</span>
                <span className="ml-1 font-bold">{modeLabel}</span>
              </button>
            )}
          </div>

          {/* MENU */}
          <div
            ref={scrollRef}
            className={cn(
              "mt-6 flex-1 overflow-y-auto min-[850px]:mt-10",
              // ✅ in compatto padding SOLO qui (icone centrate, header flush)
              isCompactDesktop
                ? cn("px-2", hideScrollbarClass)
                : "custom-scrollbar pr-3",
            )}
          >
            {/* hint scroll: solo compatto desktop */}
            {isCompactDesktop && canScrollUp && (
              <div className="sticky top-2 z-30 pointer-events-none">
                <div className="pointer-events-auto">
                  <ScrollHint direction="up" onClick={() => scrollByAmount("up")} />
                </div>
              </div>
            )}

            {MENU.map((section: any) => (
              <div
                key={section.label}
                className={cn("mb-6", isCompactDesktop && "mb-4")}
              >
                <h2
                  className={cn(
                    "mb-5 text-sm font-medium text-dark-4 dark:text-dark-6",
                    isCompactDesktop && "sr-only",
                  )}
                >
                  {section.label}
                </h2>

                <nav role="navigation" aria-label={section.label}>
                  <ul className={cn("space-y-2", isCompactDesktop && "space-y-3")}>
                    {section.items.map((item: any) => (
                      <li key={item.title}>
                        {item.items?.length ? (
                          <div>
                            <MenuItem
                              isActive={item.items.some(
                                ({ url }: any) => url === pathname,
                              )}
                              tooltip={isCompactDesktop ? item.title : undefined}
                              className={cn(isCompactDesktop && compactItemClass)}
                              onClick={() => {
                                ensureExpandedForSubmenu(item.title);
                                toggleExpanded(item.title);
                              }}
                            >
                              <item.icon className="size-6 shrink-0" aria-hidden="true" />

                              <span
                                className={cn(
                                  "text-gray-7 dark:text-dark-6",
                                  isCompactDesktop && "sr-only",
                                )}
                              >
                                {item.title}
                              </span>

                              {expandedView && (
                                <ChevronUp
                                  className={cn(
                                    "ml-auto rotate-180 transition-transform",
                                    expandedItems.includes(item.title) && "rotate-0",
                                  )}
                                  aria-hidden="true"
                                />
                              )}
                            </MenuItem>

                            {expandedView && expandedItems.includes(item.title) && (
                              <ul
                                className="ml-9 mr-0 space-y-1.5 pb-[15px] pr-0 pt-2"
                                role="menu"
                              >
                                {item.items.map((subItem: any) => (
                                  <li key={subItem.title} role="none">
                                    <MenuItem
                                      as="link"
                                      href={subItem.url}
                                      isActive={pathname === subItem.url}
                                    >
                                      <span className="text-gray-7 dark:text-dark-6">
                                        {subItem.title}
                                      </span>
                                    </MenuItem>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ) : (
                          (() => {
                            const href =
                              "url" in item
                                ? (item.url as string)
                                : "/" +
                                item.title
                                  .toLowerCase()
                                  .split(" ")
                                  .join("-");

                            return (
                              <MenuItem
                                as="link"
                                href={href}
                                isActive={pathname === href}
                                tooltip={isCompactDesktop ? item.title : undefined}
                                className={cn(
                                  "flex items-center gap-3 py-3",
                                  isCompactDesktop && compactItemClass,
                                )}
                              >
                                <item.icon className="size-6 shrink-0" aria-hidden="true" />
                                <span
                                  className={cn(
                                    "text-gray-7 dark:text-dark-6",
                                    isCompactDesktop && "sr-only",
                                  )}
                                >
                                  {item.title}
                                </span>
                              </MenuItem>
                            );
                          })()
                        )}
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            ))}

            {/* hint scroll bottom: solo compatto desktop */}
            {isCompactDesktop && canScrollDown && (
              <div className="sticky bottom-2 z-30 pointer-events-none pb-2">
                <div className="pointer-events-auto">
                  <ScrollHint
                    direction="down"
                    onClick={() => scrollByAmount("down")}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
