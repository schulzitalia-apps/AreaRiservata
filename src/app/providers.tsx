"use client";

import { SidebarProvider } from "@/components/Layouts/sidebar/sidebar-context";
import { ThemeProvider } from "next-themes";
import ReduxProvider from "@/components/Store/ReduxProvider";


export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark" attribute="class">
      <SidebarProvider>
        <ReduxProvider>
          {children}
        </ReduxProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
