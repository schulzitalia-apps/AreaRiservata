// src/components/AtlasModuli/common/GlowButton.tsx
"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";

type GlowColor = "primary" | "success" | "danger" | "neutral" | "rose";
type GlowSize = "sm" | "md";

interface BaseProps {
  children: ReactNode;
  color?: GlowColor;
  size?: GlowSize;
  className?: string;
  disabled?: boolean;
}

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: undefined;
};

type LinkProps = BaseProps & {
  href: string;
  onClick?: () => void;
  target?: string;
  rel?: string;
};

export type GlowButtonProps = ButtonProps | LinkProps;

export function GlowButton(props: GlowButtonProps) {
  const {
    children,
    color = "primary",
    size = "sm",
    className,
    disabled,
    ...rest
  } = props as any;

  const base =
    "inline-flex items-center justify-center rounded-lg font-medium " +
    "transition-all duration-150 backdrop-blur-sm " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent " +
    "disabled:cursor-not-allowed disabled:opacity-60 " +
    "hover:scale-[1.02] hover:animate-pulse-slow active:scale-100";

  const sizeCls =
    size === "md"
      ? "px-4 py-2 text-sm"
      : "px-3 py-1.5 text-xs"; // sm default

  let colorCls = "";
  switch (color) {
    case "success":
      colorCls =
        "border-emerald-500/60 bg-emerald-500/10 text-emerald-500 " +
        "hover:bg-emerald-500/20 hover:shadow-[0_0_16px_rgba(16,185,129,0.45)] " +
        "focus-visible:ring-emerald-400/60 " +
        "dark:border-emerald-400/60 dark:bg-emerald-400/15 dark:text-emerald-200 dark:hover:bg-emerald-400/25";
      break;
    case "danger":
      colorCls =
        "border-red-500/70 bg-red-500/10 text-red-400 " +
        "hover:bg-red-500/20 hover:shadow-[0_0_16px_rgba(239,68,68,0.45)] " +
        "focus-visible:ring-red-400/60 " +
        "dark:border-red-400/70 dark:bg-red-400/15 dark:text-red-100 dark:hover:bg-red-400/25";
      break;
    case "neutral":
      colorCls =
        "border-slate-400/60 bg-slate-200/20 text-slate-700 " +
        "hover:bg-slate-200/40 hover:shadow-[0_0_12px_rgba(148,163,184,0.4)] " +
        "focus-visible:ring-slate-400/60 " +
        "dark:border-slate-400/60 dark:bg-slate-600/20 dark:text-slate-100 dark:hover:bg-slate-600/40";
      break;
    case "rose":
      colorCls =
        "border-rose-500/70 bg-rose-500/10 text-rose-500 " +
        "hover:bg-rose-500/20 hover:shadow-[0_0_16px_rgba(244,63,94,0.45)] " +
        "focus-visible:ring-rose-400/60 " +
        "dark:border-rose-400/70 dark:bg-rose-400/15 dark:text-rose-100 dark:hover:bg-rose-400/25";
      break;
    case "primary":
    default:
      colorCls =
        "border-primary/70 bg-primary/10 text-primary " +
        "hover:bg-primary/20 hover:shadow-[0_0_16px_rgba(59,130,246,0.45)] " +
        "focus-visible:ring-primary/60 " +
        "dark:border-primary/60 dark:bg-primary/20 dark:text-primary-100 dark:hover:bg-primary/30";
      break;
  }

  const classes = clsx(base, sizeCls, colorCls, className);

  if ("href" in props && props.href) {
    const { href, onClick, target, rel } = props as LinkProps;

    return (
      <Link href={href} className={classes} onClick={onClick} target={target} rel={rel}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={(rest.type as any) ?? "button"}
      disabled={disabled}
      className={classes}
      {...rest}
    >
      {children}
    </button>
  );
}
