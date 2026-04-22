// src/components/AtlasModuli/common/GlowButton.tsx
"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AppButton, AppLinkButton } from "@/components/ui";
import { cn } from "@/server-utils/lib/utils";

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
  } = props;

  const toneMap: Record<GlowColor, "primary" | "neutral" | "success" | "danger"> = {
    primary: "primary",
    success: "success",
    danger: "danger",
    neutral: "neutral",
    rose: "danger",
  };

  const sizeMap: Record<GlowSize, "sm" | "md"> = {
    sm: "sm",
    md: "md",
  };

  const glowClassMap: Record<GlowColor, string> = {
    primary:
      "backdrop-blur-sm hover:scale-[1.02] active:scale-100 hover:shadow-[0_0_16px_rgba(59,130,246,0.45)] dark:hover:shadow-[0_0_16px_rgba(59,130,246,0.38)]",
    success:
      "backdrop-blur-sm hover:scale-[1.02] active:scale-100 hover:shadow-[0_0_16px_rgba(16,185,129,0.45)] dark:hover:shadow-[0_0_16px_rgba(16,185,129,0.38)]",
    danger:
      "backdrop-blur-sm hover:scale-[1.02] active:scale-100 hover:shadow-[0_0_16px_rgba(239,68,68,0.45)] dark:hover:shadow-[0_0_16px_rgba(239,68,68,0.38)]",
    neutral:
      "backdrop-blur-sm hover:scale-[1.02] active:scale-100 hover:shadow-[0_0_12px_rgba(148,163,184,0.35)] dark:hover:shadow-[0_0_12px_rgba(148,163,184,0.28)]",
    rose:
      "backdrop-blur-sm hover:scale-[1.02] active:scale-100 border-rose-500/45 text-rose-600 hover:bg-rose-500/10 hover:shadow-[0_0_16px_rgba(244,63,94,0.45)] dark:border-rose-400/45 dark:text-rose-100 dark:hover:bg-rose-400/15 dark:hover:shadow-[0_0_16px_rgba(244,63,94,0.35)]",
  };

  const classes = cn(glowClassMap[color], className);

  if ("href" in props && props.href) {
    const { href, onClick, target, rel } = props;

    return (
      <AppLinkButton
        href={href}
        onClick={onClick}
        target={target}
        rel={rel}
        variant="outline"
        tone={toneMap[color]}
        size={sizeMap[size]}
        className={classes}
      >
        {children}
      </AppLinkButton>
    );
  }

  const { href: _href, ...buttonProps } = props as ButtonProps;

  return (
    <AppButton
      type={buttonProps.type ?? "button"}
      disabled={disabled}
      variant="outline"
      tone={toneMap[color]}
      size={sizeMap[size]}
      className={classes}
      {...buttonProps}
    >
      {children}
    </AppButton>
  );
}
