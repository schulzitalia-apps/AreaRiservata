"use client";

import { AppCard, type AppCardProps } from "./AppCard";

export type AppPanelProps = Omit<AppCardProps, "surface" | "elevation">;

export function AppPanel(props: AppPanelProps) {
  return <AppCard surface="subtle" elevation="flat" {...props} />;
}
