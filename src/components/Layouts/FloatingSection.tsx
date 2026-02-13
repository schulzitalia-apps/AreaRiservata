// src/components/Layouts/FloatingSection.tsx
"use client";

import Image from "next/image";
import type { ReactNode } from "react";

export type FloatingSectionHeaderVariant =
  | "cover-avatar"
  | "avatar-only"
  | "none";

export type FloatingSectionAvatarSize = "small" | "medium" | "large";

export type FloatingSectionProps = {
  coverSrc?: string;
  avatarSrc?: string;

  headerVariant?: FloatingSectionHeaderVariant;
  avatarSize?: FloatingSectionAvatarSize;
  hoverEffect?: boolean;

  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FloatingSection({
                                  coverSrc,
                                  avatarSrc,
                                  title,
                                  subtitle,
                                  children,
                                  className,
                                  headerVariant = "cover-avatar",
                                  avatarSize = "medium",
                                  hoverEffect = true,
                                }: FloatingSectionProps) {
  const isCoverAvatar = headerVariant === "cover-avatar";
  const isAvatarOnly = headerVariant === "avatar-only";
  const isNone = headerVariant === "none";

  /* -------------------------------- AVATAR SIZES ---------------------------- */

  const avatarSizeClasses: Record<FloatingSectionAvatarSize, string> = {
    small: "h-16 w-16 sm:h-20 sm:w-20",
    medium: "h-24 w-24 sm:h-28 sm:w-28",
    large: "h-32 w-32 sm:h-40 sm:w-40",
  };

  const avatarWrapperSize = avatarSizeClasses[avatarSize];

  /* --------------------------- CONTENT TOP PADDING -------------------------- */

  const contentTopPaddingBySize: Record<FloatingSectionAvatarSize, string> = {
    small: "pt-10",
    medium: "pt-14",
    large: "pt-20",
  };

  const contentTopPadding = isAvatarOnly
    ? contentTopPaddingBySize[avatarSize]
    : "";

  /* ----------------------- TOP OFFSET (spazio sopra card) ------------------- */
  const topOffset =
    isAvatarOnly && avatarSize === "large"
      ? "mt-28 sm:mt-36"
      : isAvatarOnly && avatarSize === "medium"
        ? "mt-20 sm:mt-28"
        : isAvatarOnly && avatarSize === "small"
          ? "mt-16 sm:mt-20"
          : "";

  const avatarAlt =
    typeof title === "string" ? title : "Floating section avatar";

  const renderAvatarInner = () => (
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
          src={avatarSrc!}
          width={200}
          height={200}
          alt={avatarAlt}
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );

  /* ---------------------- HEADER: COVER + AVATAR --------------------------- */

  const renderCoverAvatarHeader = () => {
    if (!isCoverAvatar) return null;

    return (
      <>
        {coverSrc && (
          <div className="relative h-32 w-full md:h-56">
            <Image
              src={coverSrc}
              alt="section cover"
              width={970}
              height={260}
              className="h-full w-full rounded-t-[16px] object-cover object-center"
            />
          </div>
        )}

        {avatarSrc && (
          <div className="px-4 pb-2 text-center md:px-6">
            <div className="-mt-16 flex justify-center">
              <div className={`relative z-30 ${avatarWrapperSize}`}>
                {renderAvatarInner()}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  /* ----------------------------- HOVER FX ---------------------------------- */

  const hoverClasses = hoverEffect
    ? [
      "transform-gpu",
      "transition-all",
      "duration-500",
      "ease-[cubic-bezier(0.22,0.61,0.36,1)]",
      "hover:-translate-y-1",
      "hover:scale-[1.02]",
      "hover:shadow-2xl",
    ].join(" ")
    : "";

  /* ----------------------------- RENDER ------------------------------------ */

  return (
    <section
      className={`
        relative
        mx-auto w-full max-w-[970px]
        ${topOffset}
        ${hoverClasses}
        ${className ?? ""}
      `}
    >
      {/* AVATAR “MEZZO FUORI” */}
      {isAvatarOnly && avatarSrc && (
        <div
          className={`
            pointer-events-none
            absolute left-1/2 top-0
            -translate-x-1/2 -translate-y-1/2
            ${avatarWrapperSize}
            z-30
          `}
        >
          {renderAvatarInner()}
        </div>
      )}

      <div className="overflow-hidden rounded-[16px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        {renderCoverAvatarHeader()}

        <div
          className={`
            px-4 pb-6 text-center md:px-6 lg:pb-8
            ${contentTopPadding}
          `}
        >
          <div className={isNone ? "mt-6" : "mt-5"}>
            <h2 className="mb-1 text-heading-6 font-bold text-dark dark:text-white">
              {title}
            </h2>

            {subtitle && (
              <div className="mt-2 text-sm text-gray-600 dark:text-dark-6">
                {subtitle}
              </div>
            )}

            <div className="mt-6 text-left text-sm text-dark/90 dark:text-dark-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
