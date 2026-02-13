"use client";

import { useClickOutside } from "@/design/hooks/use-click-outside";
import { cn } from "@/server-utils/lib/utils";
import { SetStateActionType } from "@/types/set-state-action-type";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type DropdownContextType = {
  isOpen: boolean;
  handleOpen: () => void;
  handleClose: () => void;
};

const DropdownContext = createContext<DropdownContextType | null>(null);

function useDropdownContext() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error("useDropdownContext must be used within a Dropdown");
  }
  return context;
}

type DropdownProps = {
  children: React.ReactNode;
  isOpen: boolean;
  setIsOpen: SetStateActionType<boolean>;
};

export function Dropdown({ children, isOpen, setIsOpen }: DropdownProps) {
  const triggerRef = useRef<HTMLElement | null>(null);

  function handleClose() {
    setIsOpen(false);
  }

  function handleOpen() {
    setIsOpen(true);
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      handleClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      // memorizza il focus corrente
      triggerRef.current = document.activeElement as HTMLElement;
    } else {
      // ripristina il focus sul trigger
      setTimeout(() => {
        triggerRef.current?.focus();
      }, 0);
    }
  }, [isOpen]);

  return (
    <DropdownContext.Provider value={{ isOpen, handleOpen, handleClose }}>
      <div className="relative" onKeyDown={handleKeyDown}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

type DropdownContentProps = {
  align?: "start" | "end" | "center";
  className?: string;
  children: React.ReactNode;
};

export function DropdownContent({
                                  children,
                                  align = "center",
                                  className,
                                }: DropdownContentProps) {
  const { isOpen, handleClose } = useDropdownContext();

  const contentRef = useClickOutside<HTMLDivElement>(() => {
    if (isOpen) handleClose();
  });

  const [openUpwards, setOpenUpwards] = useState(false);

  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    const rect = contentRef.current.getBoundingClientRect();
    const viewportH =
      window.innerHeight || document.documentElement.clientHeight;

    const needsUpwards = rect.bottom > viewportH - 16;
    setOpenUpwards(needsUpwards);
  }, [isOpen, contentRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={contentRef}
      role="menu"
      aria-orientation="vertical"
      className={cn(
        "pointer-events-auto absolute z-50",
        "w-full min-w-full",
        // niente max-h / overflow QUI → niente doppia scrollbar
        "rounded-lg shadow-card-3",
        openUpwards
          ? "bottom-full mb-2 origin-bottom-right"
          : "top-full mt-2 origin-top-right",
        {
          "right-0": align === "end",
          "left-0": align === "start",
          "left-1/2 -translate-x-1/2": align === "center",
        },
        className,
      )}
    >
      {children}
    </div>
  );
}

type DropdownTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

export function DropdownTrigger({
                                  children,
                                  className,
                                  ...rest
                                }: DropdownTriggerProps) {
  const { handleOpen, isOpen } = useDropdownContext();

  return (
    <button
      type="button"
      className={className}
      onClick={handleOpen}
      aria-expanded={isOpen}
      aria-haspopup="menu"
      data-state={isOpen ? "open" : "closed"}
      {...rest}
    >
      {children}
    </button>
  );
}

export function DropdownClose({ children }: PropsWithChildren) {
  const { handleClose } = useDropdownContext();

  return <div onClick={handleClose}>{children}</div>;
}
