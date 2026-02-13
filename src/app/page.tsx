// src/app/home/page.tsx
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { CampaignVisitors } from "@/components/Charts/campaign-visitors";
import { UsedDevices } from "@/components/Charts/used-devices";
import { createTimeFrameExtractor } from "@/utils/timeframe-extractor";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { homepageConfig } from "@/config/homepage.config";
import { FloatingSection } from "@/components/Layouts/FloatingSection";

export const metadata: Metadata = {
  title: homepageConfig.seo.title,
  description: homepageConfig.seo.description,
};

type SearchParams = {
  selected_time_frame?: string | string[];
};

export default async function Page({
                                     searchParams,
                                   }: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const selectedTf =
    typeof sp.selected_time_frame === "string"
      ? sp.selected_time_frame
      : Array.isArray(sp.selected_time_frame)
        ? sp.selected_time_frame[0]
        : undefined;

  const extractTimeFrame = createTimeFrameExtractor(selectedTf);
  const usedDevicesKey = extractTimeFrame("used_devices");
  const usedDevicesValue = usedDevicesKey?.split(":")[1];

  return (
    <>
      <Breadcrumb pageName={homepageConfig.breadcrumb.pageName} />

      <div className="space-y-12 pb-12 pt-4 md:space-y-16 md:pb-16">
        {/* 1. HERO / PANORAMICA */}
        <FloatingSection
          coverSrc="/images/cover/cover-01.png"
          avatarSrc="/images/home/home-01.png"
          title={homepageConfig.hero.heading}
          subtitle={homepageConfig.hero.badgeLabel}
        >
          <div className="mx-auto max-w-[720px] text-center">
            <p className="text-[0.95rem] leading-relaxed text-dark dark:text-dark-6">
              <strong>{homepageConfig.hero.highlightIntro}</strong>{" "}
              {homepageConfig.hero.highlightRest}
            </p>

            {/* Bullet “valore rapido” */}
            <div className="mt-6 grid gap-4 text-left md:grid-cols-2">
              {homepageConfig.hero.bulletPoints.map((bullet, idx) => (
                <div
                  key={bullet.title}
                  className="
                    relative overflow-hidden rounded-2xl
                    border border-stroke bg-white/90 p-3.5 shadow-sm
                    dark:border-dark-3 dark:bg-dark-2
                  "
                >
                  {/* mini avatar per ogni bullet */}
                  <div className="absolute -left-3 -top-3 h-8 w-8 overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100 shadow-sm dark:border-dark-3 dark:bg-dark-2">
                    <Image
                      src={`/images/user/user-${(idx % 6) + 2}.png`}
                      alt="Bullet avatar"
                      width={60}
                      height={60}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="pl-5 text-[0.9rem] text-dark dark:text-dark-6">
                    <strong>{bullet.title}</strong> {bullet.text}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href={homepageConfig.hero.primaryCta.href}
                className="
                  relative overflow-hidden rounded-full border border-primary
                  bg-primary px-5 py-2.5 text-sm font-semibold text-white
                  shadow-lg shadow-primary/30 transition-transform duration-200
                  hover:-translate-y-0.5
                "
              >
                <span className="relative z-10">
                  {homepageConfig.hero.primaryCta.label}
                </span>
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/25 via-transparent to-white/15 opacity-0 transition-opacity duration-300 hover:opacity-100" />
              </Link>
              <Link
                href={homepageConfig.hero.secondaryCta.href}
                className="
                  rounded-full border border-stroke
                  bg-white/90 px-4 py-2.5 text-sm font-semibold text-dark
                  shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md
                  dark:border-dark-3 dark:bg-dark-2 dark:text-white
                "
              >
                {homepageConfig.hero.secondaryCta.label}
              </Link>
            </div>
          </div>
        </FloatingSection>

        {/* 2. PILASTRI DI VALORE */}
        <FloatingSection
          coverSrc="/images/cover/cover-04.png"
          avatarSrc="/images/home/home-02.png"
          title="Come organizziamo il tuo ecosistema"
          subtitle="I quattro pilastri della piattaforma"
        >
          <div className="grid grid-cols-12 gap-4 md:gap-5">
            {homepageConfig.valuePillars.map((pillar, index) => (
              <div
                key={pillar.title}
                className="col-span-12 md:col-span-6 xl:col-span-3"
              >
                <div
                  className="
                    relative h-full rounded-2xl border border-stroke
                    bg-white/95 p-4 shadow-sm
                    dark:border-dark-3 dark:bg-dark-2
                  "
                >
                  <div className="absolute -top-4 left-4 h-9 w-9 overflow-hidden rounded-full border-2 border-gray-200 bg-gray-100 shadow-sm dark:border-dark-3 dark:bg-dark-2">
                    <Image
                      src={`/images/home/home-0` + (index+1) + `.png`}
                      alt={pillar.title}
                      width={60}
                      height={60}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="mt-2">
                    <h3 className="mb-1.5 text-sm font-semibold text-dark dark:text-white">
                      {pillar.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-gray-700 dark:text-dark-6">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FloatingSection>

        {/* 4. ECONOMICS */}
        <FloatingSection
          coverSrc="/images/cover/cover-02.png"
          avatarSrc="/images/user/user-16.png"
          title={homepageConfig.economicsSection.title}
          subtitle="Impatto economico"
        >
          <div
            className="
              rounded-2xl border border-stroke bg-white/95
              p-4 shadow-sm
              dark:border-dark-3 dark:bg-dark-2
            "
          >
            <p className="text-sm leading-relaxed text-gray-800 dark:text-dark-6">
              <strong>{homepageConfig.economicsSection.body[0]}</strong>{" "}
              {homepageConfig.economicsSection.body[1]}
            </p>
          </div>
        </FloatingSection>

        {/* 5. TECNOLOGIA */}
        <FloatingSection
          coverSrc="/images/cover/cover-06.png"
          avatarSrc="/images/home/home-04.png"
          title={homepageConfig.techSection.title}
          subtitle="Architettura e stack"
        >
          <div
            className="
              rounded-2xl border border-stroke bg-white/95
              p-4 shadow-sm
              dark:border-dark-3 dark:bg-dark-2
            "
          >
            <ul className="space-y-1.5 text-sm text-gray-800 dark:text-dark-6">
              {homepageConfig.techSection.bulletItems.map((item) => (
                <li key={item.highlight}>
                  <strong>{item.highlight}</strong>: {item.text}
                </li>
              ))}
            </ul>
          </div>
        </FloatingSection>

        {/* 6. PROTEZIONE DATI */}
        <FloatingSection
          coverSrc="/images/cover/cover-07.png"
          avatarSrc="/images/user/user-17.png"
          title={homepageConfig.dataSecuritySection.title}
          subtitle="Protezione dati & GDPR"
        >
          <div className="grid gap-5 md:grid-cols-[minmax(0,2fr),minmax(0,1.4fr)]">
            <div
              className="
                rounded-2xl border border-stroke bg-white/95
                p-4 shadow-sm
                dark:border-dark-3 dark:bg-dark-2
              "
            >
              <div className="space-y-2.5 text-sm leading-relaxed text-gray-800 dark:text-dark-6">
                {homepageConfig.dataSecuritySection.body.map(
                  (paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ),
                )}
              </div>
            </div>

            <div
              className="
                rounded-2xl border border-stroke bg-white/95
                p-4 text-xs text-gray-800 shadow-sm
                dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6
              "
            >
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide">
                In pratica cosa significa
              </h3>
              <ul className="space-y-1.5">
                <li>
                  • Nessun link diretto ai file: ogni accesso passa dalle nostre
                  API con autenticazione e controlli di permesso.
                </li>
                <li>
                  • Storage Cloudflare R2 privato, cifrato e ospitato su
                  infrastruttura conforme agli standard europei.
                </li>
                <li>
                  • Pronti a gestire anche dati sensibili (come certificati
                  medici) con politiche di retention e accesso controllato.
                </li>
                <li>
                  • Design orientato al GDPR: sicurezza by design e by default,
                  non aggiunta a posteriori.
                </li>
              </ul>
            </div>
          </div>
        </FloatingSection>

        {/* 7. CTA FINALE */}
        <FloatingSection
          coverSrc="/images/cover/cover-01.png"
          avatarSrc="/images/user/user-18.png"
          title={homepageConfig.finalCta.title}
          subtitle="Parliamone davvero"
        >
          <div
            className="
              rounded-2xl border border-primary/60
              bg-gradient-to-r from-primary/10 via-primary/5 to-transparent
              p-4 text-sm text-dark shadow-sm
              dark:border-primary/60 dark:bg-transparent dark:text-dark-6
            "
          >
            <p className="mb-3 text-sm">
              {homepageConfig.finalCta.body}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Link
                href={homepageConfig.finalCta.primaryCta.href}
                className="
                  rounded-full border border-primary bg-primary
                  px-4 py-2.5 text-sm font-semibold text-white
                  shadow-md shadow-primary/40 transition-transform
                  hover:-translate-y-0.5 hover:shadow-xl
                "
              >
                {homepageConfig.finalCta.primaryCta.label}
              </Link>

            </div>
          </div>
        </FloatingSection>
      </div>
    </>
  );
}
