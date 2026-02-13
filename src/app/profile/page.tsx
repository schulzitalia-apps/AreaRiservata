// src/app/app/profile/page.tsx
"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchMyProfile } from "@/components/Store/slices/profileSlice";

import { AzioniOverviewPanel } from "@/components/AtlasModuli/Azioni/AzioniOverviewPanel";
import { getEventoActionUiConfig } from "@/config/actions.registry";

// ✅ RadialGauge
import { RadialGauge } from "@/components/Charts/radial-gauge";

// ✅ Dropdown UI (stesso set del tuo RadialGauge)
import {
  Dropdown,
  DropdownContent,
  DropdownClose,
  DropdownTrigger,
} from "@/components/ui/dropdown";

import { cn } from "@/server-utils/lib/utils";

const PLACEHOLDER_AVATAR = "/images/user/user-01.png";
const COVER_IMAGE = "/images/cover/cover-01.png";

type RevenueKey = "mese" | "trimestre" | "semestre" | "anno";
type ClientKey = "cliente1" | "cliente2" | "cliente3" | "cliente4";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function formatCurrencyEUR(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function mockRevenueAroundTarget(target: number) {
  // mock “random” ma plausibile: 40%..110% del target
  const factor = 0.4 + Math.random() * 0.7;
  return Math.round(target * factor);
}

export default function Page() {
  const dispatch = useAppDispatch();

  const session = useAppSelector((s) => s.session);
  const sessionUser = session.user;
  const isAuthed = session.status === "authenticated";

  const profileState = useAppSelector((s) => s.profile);
  const profile = profileState.data;

  useEffect(() => {
    if (isAuthed && profileState.status === "idle") {
      dispatch(fetchMyProfile());
    }
  }, [isAuthed, profileState.status, dispatch]);

  const displayName = useMemo(() => {
    return (
      profile?.fullName ||
      sessionUser?.name ||
      sessionUser?.email ||
      "Account"
    );
  }, [profile?.fullName, sessionUser?.name, sessionUser?.email]);

  const roleLabel = sessionUser?.role || "—";
  const phone = profile?.phone || "—";
  const bio = profile?.bio || "—";

  const avatarSrc = profile?.avatarKey || PLACEHOLDER_AVATAR;

  // Tipi di azione (categorie) presi dal registry:
  const azioniTypes = useMemo(
    () =>
      getEventoActionUiConfig().map((cfg) => ({
        slug: cfg.eventType,
        label: cfg.label,
        tone: cfg.tone,
      })),
    [],
  );

  // -----------------------------
  // ✅ MOCKUP: CLIENTI + FATTURATO
  // -----------------------------

  const clientOptions = useMemo(
    () =>
      [
        { key: "cliente1", label: "LUNA SRL" },
        { key: "cliente2", label: "GM INFISSI" },
        { key: "cliente3", label: "FORTEZZA" },
        { key: "cliente4", label: "LIBERATI SNC" },
      ] as const,
    [],
  );

  const [activeClient, setActiveClient] = useState<ClientKey>("cliente1");
  const [clientOpen, setClientOpen] = useState(false);

  const activeClientOption = useMemo(() => {
    return clientOptions.find((c) => c.key === activeClient) ?? clientOptions[0];
  }, [activeClient, clientOptions]);

  const fatturatoOptions = useMemo(
    () =>
      [
        { key: "mese", label: "Mese", subLabel: "Questo mese" },
        { key: "trimestre", label: "Trimestre", subLabel: "Ultimi 3 mesi" },
        { key: "semestre", label: "Semestre", subLabel: "Ultimi 6 mesi" },
        { key: "anno", label: "Anno", subLabel: "Ultimi 12 mesi" },
      ] as const,
    [],
  );

  // Target per cliente (mock)
  const targetsByClient = useMemo(() => {
    return {
      cliente1: { mese: 100000, trimestre: 300000, semestre: 750000, anno: 1900000 },
      cliente2: { mese: 65000, trimestre: 220000, semestre: 510000, anno: 1200000 },
      cliente3: { mese: 140000, trimestre: 380000, semestre: 900000, anno: 2200000 },
      cliente4: { mese: 45000, trimestre: 160000, semestre: 360000, anno: 900000 },
    } satisfies Record<ClientKey, Record<RevenueKey, number>>;
  }, []);

  // Valori random per cliente+timeframe (stabili finché non ricarichi la pagina)
  const mockByClient = useMemo(() => {
    const buildClient = (client: ClientKey) => {
      const t = targetsByClient[client];
      return {
        mese: mockRevenueAroundTarget(t.mese),
        trimestre: mockRevenueAroundTarget(t.trimestre),
        semestre: mockRevenueAroundTarget(t.semestre),
        anno: mockRevenueAroundTarget(t.anno),
      };
    };

    return {
      cliente1: buildClient("cliente1"),
      cliente2: buildClient("cliente2"),
      cliente3: buildClient("cliente3"),
      cliente4: buildClient("cliente4"),
    } satisfies Record<ClientKey, Record<RevenueKey, number>>;
  }, [targetsByClient]);

  // Dati RadialGauge (dipendono dal cliente selezionato)
  const fatturatoGaugeData = useMemo(() => {
    const targets = targetsByClient[activeClient];
    const actuals = mockByClient[activeClient];

    const build = (k: RevenueKey) => {
      const target = targets[k];
      const actual = actuals[k];
      const percent = clamp((actual / target) * 100);

      return {
        value: percent,
        subtitle: `${formatCurrencyEUR(actual)} / ${formatCurrencyEUR(
          target,
        )} (${Math.round(percent)}%)`,
      };
    };

    return {
      mese: build("mese"),
      trimestre: build("trimestre"),
      semestre: build("semestre"),
      anno: build("anno"),
    } satisfies Record<RevenueKey, { value: number; subtitle: string }>;
  }, [activeClient, targetsByClient, mockByClient]);

  return (
    <div className="mx-auto w-full max-w-[970px]">
      <Breadcrumb pageName="Profilo" />

      <div className="overflow-hidden rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        {/* COVER */}
        <div className="relative z-20 h-35 md:h-65">
          <Image
            src={COVER_IMAGE}
            alt="profile cover"
            className="h-full w-full rounded-tl-[10px] rounded-tr-[10px] object-cover object-center"
            width={970}
            height={260}
          />
        </div>

        {/* Avatar + Info */}
        <div className="px-4 pb-6 text-center lg:pb-8 xl:pb-11.5">
          {/* AVATAR — bordo spesso + glow, interno solido */}
          <div className="relative z-30 mx-auto -mt-22 h-32 w-32 sm:h-44 sm:w-44">
            <div
              className="
                h-full w-full rounded-full p-[4px]
                border-[4px] border-transparent
                shadow-[0_0_25px_4px_rgba(59,130,246,0.55)]
                dark:shadow-[0_0_30px_6px_rgba(59,130,246,0.75)]
              "
            >
              <div
                className="
                  h-full w-full overflow-hidden rounded-full
                  border-[6px] border-gray-200 bg-gray-100
                  dark:border-gray-700 dark:bg-dark-2
                "
              >
                <Image
                  src={avatarSrc}
                  width={200}
                  height={200}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Nome + Ruolo */}
          <div className="mt-4">
            <h3 className="mb-1 text-heading-6 font-bold text-dark dark:text-white">
              {displayName}
            </h3>

            <p className="font-medium text-gray-600 dark:text-dark-6">
              {roleLabel}
            </p>

            {/* ⭐⭐ PANNELLO AZIONI — sotto nome/ruolo ⭐⭐ */}
            {isAuthed && (
              <div className="mt-10">
                <AzioniOverviewPanel types={azioniTypes} />
              </div>
            )}

            {/* ✅ MOCKUP: CLIENTE + BUDGET ORDINI */}
            {isAuthed && (
              <div className="mt-10 mx-auto max-w-[720px] text-left">
                {/* Header "Cliente" con dropdown */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-600 dark:text-dark-6">
                      Seleziona cliente
                    </div>
                    <div className="text-xl font-bold text-dark dark:text-white">
                      {activeClientOption.label}
                    </div>
                  </div>

                  <Dropdown isOpen={clientOpen} setIsOpen={setClientOpen}>
                    <DropdownTrigger
                      className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-full border border-primary/70 px-4 text-sm font-medium",
                        "text-white",
                        "hover:border-primary",
                        "dark:border-primary/70",
                      )}
                    >
                      <span>{activeClientOption.label}</span>
                      <span className="text-white/80">▾</span>
                    </DropdownTrigger>

                    <DropdownContent
                      align="end"
                      className={cn(
                        "overflow-hidden border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark",
                        "w-44 rounded-xl",
                      )}
                    >
                      <div className="py-1">
                        {clientOptions.map((opt) => {
                          const isActive = opt.key === activeClient;
                          return (
                            <DropdownClose key={opt.key}>
                              <button
                                type="button"
                                onClick={() => setActiveClient(opt.key)}
                                className={cn(
                                  "flex w-full items-center justify-between px-3 py-2 text-sm",
                                  "text-dark hover:bg-stroke/40 dark:text-white dark:hover:bg-dark-3",
                                  isActive && "font-semibold",
                                )}
                              >
                                <span>{opt.label}</span>
                                {isActive ? (
                                  <span className="text-primary">●</span>
                                ) : null}
                              </button>
                            </DropdownClose>
                          );
                        })}
                      </div>
                    </DropdownContent>
                  </Dropdown>
                </div>

                {/* Gauge */}
                <RadialGauge<RevenueKey>
                  title="Budget Ordini"
                  subtitle="Avanzamento rispetto al target"
                  options={fatturatoOptions as any}
                  data={fatturatoGaugeData as any}
                  defaultKey="mese"
                  size="jumbo"
                  colorFrom="#5750F1"
                  colorTo="#0ABEF9"
                />
              </div>
            )}

            <br />
            <br />

            {/* BOX SU DI ME — bordo glow + bordo solido interno */}
            <div
              className="
                mx-auto mt-6 max-w-[720px]
                rounded-2xl p-[3px]
                shadow-[0_0_25px_2px_rgba(59,130,246,0.4)]
                dark:shadow-[0_0_30px_3px_rgba(59,130,246,0.55)]
              "
            >
              <div
                className="
                  rounded-xl border-[3px]
                  border-gray-300 bg-gray-50
                  p-5
                  dark:border-gray-700 dark:bg-[#0e1218]
                "
              >
                <h4 className="mb-2 text-base font-semibold text-dark dark:text-white">
                  Su di me
                </h4>

                <p className="text-[0.95rem] leading-relaxed text-dark dark:text-dark-6">
                  {bio}
                </p>

                <hr className="my-4 border-stroke dark:border-dark-3" />

                <div className="grid gap-2 text-sm text-gray-700 dark:text-dark-6 sm:grid-cols-2">
                  <div>
                    <span className="font-medium text-dark dark:text-white">
                      Telefono:
                    </span>{" "}
                    {phone}
                  </div>
                  <div>
                    <span className="font-medium text-dark dark:text-white">
                      Email:
                    </span>{" "}
                    {sessionUser?.email || "—"}
                  </div>
                </div>
              </div>
            </div>
            {/* END cornice */}
          </div>
        </div>
      </div>
    </div>
  );
}
