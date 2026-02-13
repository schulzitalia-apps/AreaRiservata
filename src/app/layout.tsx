import "@/design/css/satoshi.css";
import "@/design/css/style.css";

import { Sidebar } from "@/components/Layouts/sidebar";
import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import { Header } from "@/components/Layouts/header";
import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";
import { platformConfig } from "@/config/platform.config";
import GlobalLoadingOverlay from "@/components/ui/GlobalLoadingOverlay";
import NavigationLoadingBridge from "@/components/ui/NavigationLoadingBridge";

export const metadata: Metadata = {
  title: {
    // Usa le variabili nominali dal config
    template: `%s | ${platformConfig.platformName} ${platformConfig.mainSectionName}`,
    default: `${platformConfig.mainSectionName} - ${platformConfig.platformName}`,
  },
  description: platformConfig.platformDescription,
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="it" suppressHydrationWarning>
    <body>

    <Providers>
      <NavigationLoadingBridge />
      <GlobalLoadingOverlay />
      <NextTopLoader color="#5750F1" showSpinner={true} />

      <div className="flex min-h-screen">
        <Sidebar />

        <div className="w-full bg-gray-2 dark:bg-[#020d1a]">
          <Header />

          <main className="isolate mx-auto w-full max-w-screen-2xl overflow-hidden p-4 md:p-6 2xl:p-10">
            {children}
          </main>
        </div>
      </div>
    </Providers>
    </body>
    </html>
  );
}
