"use client";

import type { InputHTMLAttributes } from "react";
import { AppInput } from "./AppInput";

export type AppSearchFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export function AppSearchField(props: AppSearchFieldProps) {
  return <AppInput {...props} type="search" leadingSlot="o" />;
}
