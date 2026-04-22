"use client";

import type { ReactNode } from "react";
import { Modal } from "./Modal";

export type AppModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
  disableClose?: boolean;
};

const sizeMap = {
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

export function AppModal({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
  size = "lg",
  disableClose,
}: AppModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={footer}
      disableClose={disableClose}
      maxWidthClassName={sizeMap[size]}
      className="rounded-2xl"
    >
      {children}
    </Modal>
  );
}
