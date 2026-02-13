"use client";

import { useState } from "react";
import { ROLES, AppRole } from "@/types/roles";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownClose,
} from "@/components/ui/dropdown";
import { cn } from "@/server-utils/lib/utils";

export default function RoleSelect({
                                     label,
                                     value,
                                     onChange,
                                     disabled,
                                     size = "md",
                                   }: {
  label?: string;
  value: AppRole;
  onChange: (r: AppRole) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);

  const baseClasses =
    size === "sm"
      ? "px-2 py-1 text-xs rounded-md"
      : "px-3 py-2 text-sm rounded-lg";

  return (
    <div className={label ? "flex flex-col gap-1 text-sm" : ""}>
      {label && <span className="text-sm text-dark dark:text-white">{label}</span>}

      <Dropdown isOpen={open} setIsOpen={setOpen}>
        <DropdownTrigger
          className={cn(
            "flex w-full items-center justify-between border outline-none transition-colors",
            baseClasses,
            "border-stroke bg-transparent text-dark hover:bg-gray-2",
            "dark:border-dark-3 dark:bg-transparent dark:text-white dark:hover:bg-dark-2",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <span className="truncate">{value}</span>
          <span className="ml-2 text-xs opacity-70">▾</span>
        </DropdownTrigger>

        {!disabled && (
          <DropdownContent
            align="start"
            className={cn(
              "border border-stroke dark:border-dark-3 shadow-xl",
              "bg-white text-dark dark:bg-gray-dark dark:text-white",
            )}
          >
            <ul className="max-h-64 overflow-y-auto py-1 text-sm">
              {ROLES.map((r) => {
                const isActive = r === value;
                return (
                  <DropdownClose key={r}>
                    <button
                      type="button"
                      onClick={() => onChange(r)}
                      className={cn(
                        "flex w-full items-center px-3 py-1.5 text-left",
                        "bg-white dark:bg-gray-dark",
                        "hover:bg-gray-100 dark:hover:bg-dark-2",
                        "text-dark dark:text-white",
                        isActive &&
                        "font-semibold bg-primary text-white dark:bg-primary dark:text-white",
                      )}
                    >
                      {r}
                    </button>
                  </DropdownClose>
                );
              })}
            </ul>
          </DropdownContent>
        )}
      </Dropdown>
    </div>
  );
}
